// Worker Factory for XFlow SDK
// Creates Temporal workers with automatic activity discovery

import { Worker } from '@temporalio/worker';
import { WorkerStage } from '../types/index';
import { InternalWorkerOptions } from '../types/internal';
import { ConnectionManager } from './connection-manager';
import { registry } from './registry';

/**
 * Creates Temporal workers that automatically discover and register decorated functions
 * Matches the POC's worker patterns with SSL + JWT authentication
 */
export class WorkerFactory {
  private connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Create a worker for a specific stage
   */
  async createWorker(options: {
    stage: WorkerStage;
    taskQueue: string;
    maxConcurrentActivities?: number;
  }): Promise<Worker> {
    const { stage, taskQueue, maxConcurrentActivities = 100 } = options;

    console.log(`🔧 Creating worker for stage ${stage}...`);

    // Get connection with SSL + JWT
    const connection = await this.connectionManager.getConnection();

    // Get activities for this worker stage from registry
    const activities = registry.generateActivitiesForStage(stage);
    const functionCount = Object.keys(activities).length - 1; // Subtract the executor function

    console.log(`📋 Worker ${stage} will handle ${functionCount} user functions:`, 
      Object.keys(activities).filter(name => !name.startsWith('executeStage')));

    // Get workflows path - we need to provide the distributed workflow
    const workflowsPath = this.getWorkflowsPath();

    // Create the worker (matches POC pattern)
    const worker = await Worker.create({
      connection,
      workflowsPath,
      activities,
      taskQueue,
      maxConcurrentActivityTaskExecutions: maxConcurrentActivities,
      maxConcurrentWorkflowTaskExecutions: 100,
    });

    console.log(`✅ Worker ${stage} created successfully for queue: ${taskQueue}`);
    return worker;
  }

  /**
   * Create workers for all stages that have registered functions
   */
  async createAllWorkers(options: {
    taskQueuePrefix?: string;
    maxConcurrentActivities?: number;
  } = {}): Promise<Map<WorkerStage, Worker>> {
    const { taskQueuePrefix = 'xflow', maxConcurrentActivities = 100 } = options;
    const workers = new Map<WorkerStage, Worker>();

    console.log('🔧 Creating workers for all stages...');

    for (const stage of [1, 2, 3] as WorkerStage[]) {
      const functions = registry.getFunctionsByStage(stage);
      
      if (functions.length === 0) {
        console.log(`⚠️  No functions registered for stage ${stage}, skipping worker`);
        continue;
      }

      const worker = await this.createWorker({
        stage,
        taskQueue: `${taskQueuePrefix}-stage${stage}-queue`,
        maxConcurrentActivities
      });

      workers.set(stage, worker);
    }

    // Create orchestration worker for workflows
    await this.createOrchestrationWorker(taskQueuePrefix);

    console.log(`✅ Created ${workers.size} stage workers`);
    return workers;
  }

  /**
   * Create the orchestration worker that handles workflow execution
   */
  async createOrchestrationWorker(taskQueuePrefix: string = 'xflow'): Promise<Worker> {
    console.log('🎭 Creating orchestration worker...');

    const connection = await this.connectionManager.getConnection();
    const workflowsPath = this.getWorkflowsPath();

    const worker = await Worker.create({
      connection,
      workflowsPath,
      activities: {}, // Orchestration worker doesn't need activities
      taskQueue: `${taskQueuePrefix}-orchestration-queue`,
      maxConcurrentWorkflowTaskExecutions: 50,
    });

    console.log('✅ Orchestration worker created successfully');
    return worker;
  }

  /**
   * Get the path to workflow definitions
   * This points to our distributed workflow implementation
   */
  private getWorkflowsPath(): string {
    // Point to our workflow executor file that contains executeDistributedWorkflow
    return require.resolve('./workflow-executor');
  }

  /**
   * Start a worker and handle its lifecycle
   */
  async startWorker(worker: Worker, stage?: WorkerStage): Promise<void> {
    const stageLabel = stage ? ` ${stage}` : '';
    console.log(`🚀 Starting worker${stageLabel}...`);

    // Handle shutdown gracefully
    const setupGracefulShutdown = () => {
      const shutdown = async () => {
        console.log(`🛑 Shutting down worker${stageLabel}...`);
        await worker.shutdown();
        console.log(`✅ Worker${stageLabel} shutdown complete`);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
      process.on('SIGUSR2', shutdown); // For nodemon
    };

    setupGracefulShutdown();

    try {
      // Run the worker (this will block until shutdown)
      await worker.run();
    } catch (error) {
      console.error(`❌ Worker${stageLabel} failed:`, error);
      throw error;
    }
  }

  /**
   * Start all workers for stages that have functions
   */
  async startAllWorkers(options: {
    taskQueuePrefix?: string;
    maxConcurrentActivities?: number;
  } = {}): Promise<void> {
    const workers = await this.createAllWorkers(options);
    const orchestrationWorker = await this.createOrchestrationWorker(options.taskQueuePrefix);

    console.log('🚀 Starting all workers...');

    // Start all workers in parallel
    const workerPromises = Array.from(workers.entries()).map(([stage, worker]) =>
      this.startWorker(worker, stage)
    );

    // Start orchestration worker
    workerPromises.push(this.startWorker(orchestrationWorker));

    // Wait for any worker to exit (which would be an error)
    try {
      await Promise.race(workerPromises);
    } catch (error) {
      console.error('❌ A worker failed, shutting down all workers:', error);
      
      // Shutdown all workers synchronously since shutdown() returns void
      Array.from(workers.values()).forEach(worker => {
        try {
          worker.shutdown();
        } catch (err: any) {
          console.error('Error shutting down worker:', err);
        }
      });
      
      try {
        orchestrationWorker.shutdown();
      } catch (err: any) {
        console.error('Error shutting down orchestration worker:', err);
      }
      
      throw error;
    }
  }

  /**
   * Get worker creation statistics
   */
  getWorkerStats() {
    return {
      stage1Functions: registry.getFunctionsByStage(1).length,
      stage2Functions: registry.getFunctionsByStage(2).length,
      stage3Functions: registry.getFunctionsByStage(3).length,
      totalFunctions: registry.getStats().totalFunctions,
      connectionStatus: this.connectionManager.getStatus()
    };
  }
} 