// Main XFlow SDK class - Primary client interface
// Hides all Temporal complexity from clients

import { v4 as uuidv4 } from 'uuid';
import { XFlowConfig, WorkerConfig, WorkflowSpec, WorkflowResult, WorkerStage } from '../types/index';
import { registry } from './registry';
import { ConnectionManager } from './connection-manager';
import { WorkerFactory } from './worker-factory';
import { WorkflowExecutor } from './workflow-executor';

/**
 * Main XFlow SDK class
 * 
 * @example
 * ```typescript
 * const xflow = new XFlow({
 *   temporalAddress: 'your-temporal-server.com'
 * });
 * 
 * await xflow.startWorkers();
 * const result = await xflow.executeWorkflow(workflowSpec);
 * ```
 */
export class XFlow {
  private config: XFlowConfig;
  private connectionManager: ConnectionManager;
  private workerFactory: WorkerFactory;
  private workflowExecutor: WorkflowExecutor;
  private workers: Map<WorkerStage, any> = new Map(); // Store running workers
  private isInitialized: boolean = false;

  constructor(config: XFlowConfig) {
    this.config = this.validateAndNormalizeConfig(config);
    this.connectionManager = new ConnectionManager(this.config);
    this.workerFactory = new WorkerFactory(this.connectionManager);
    this.workflowExecutor = new WorkflowExecutor(this.connectionManager);
  }

  /**
   * Initialize the XFlow SDK
   * Sets up connections and validates configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 Initializing XFlow SDK...');
    
    try {
      // Test connection to Temporal
      await this.connectionManager.testConnection();
      console.log('✅ Connection to Temporal server verified');

      // Validate registered functions
      const stats = registry.getStats();
      console.log(`📋 Found ${stats.totalFunctions} registered functions:`, stats.byStage);

      this.isInitialized = true;
      console.log('✅ XFlow SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize XFlow SDK:', error);
      throw new Error(`XFlow initialization failed: ${error}`);
    }
  }

  /**
   * Start workers for specific stages or all stages
   */
  async startWorkers(workerConfig?: WorkerConfig): Promise<void> {
    await this.ensureInitialized();

    const config = {
      stage: 'all' as WorkerStage | 'all',
      taskQueuePrefix: 'xflow',
      maxConcurrentActivities: 100,
      ...workerConfig
    };

    console.log('🔧 Starting XFlow workers...');

    try {
      if (config.stage === 'all') {
        // Start all three worker stages
        for (const stage of [1, 2, 3] as WorkerStage[]) {
          await this.startWorkerStage(stage, config);
        }
      } else {
        // Start specific worker stage
        await this.startWorkerStage(config.stage, config);
      }

      console.log('✅ All workers started successfully');
    } catch (error) {
      console.error('❌ Failed to start workers:', error);
      throw new Error(`Worker startup failed: ${error}`);
    }
  }

  /**
   * Start a specific worker stage
   */
  private async startWorkerStage(stage: WorkerStage, config: WorkerConfig): Promise<void> {
    const functions = registry.getFunctionsByStage(stage);
    
    if (functions.length === 0) {
      console.log(`⚠️  No functions registered for stage ${stage}, skipping worker`);
      return;
    }

    console.log(`🔧 Starting worker for stage ${stage} with ${functions.length} functions:`, 
      functions.map(f => f.name));

    const worker = await this.workerFactory.createWorker({
      stage,
      taskQueue: `${config.taskQueuePrefix}-stage${stage}-queue`,
      maxConcurrentActivities: config.maxConcurrentActivities
    });

    this.workers.set(stage, worker);

    // Start the worker in the background
    worker.run().catch((error: any) => {
      console.error(`❌ Worker ${stage} crashed:`, error);
      this.workers.delete(stage);
    });

    console.log(`✅ Worker ${stage} started on queue: ${config.taskQueuePrefix}-stage${stage}-queue`);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(spec: WorkflowSpec): Promise<WorkflowResult> {
    await this.ensureInitialized();

    const workflowId = `workflow_${uuidv4()}`;
    console.log(`🎯 Executing workflow: ${spec.name} (ID: ${workflowId})`);

    // Validate that all functions in the workflow are registered
    const functionNames = spec.stages.map(stage => stage.function);
    const validation = registry.validateWorkflowFunctions(functionNames);
    
    if (!validation.valid) {
      throw new Error(
        `Workflow validation failed. Missing functions: ${validation.missing.join(', ')}. ` +
        `Make sure all functions are decorated with @xflowFunction.`
      );
    }

    try {
      const startTime = Date.now();
      const result = await this.workflowExecutor.execute(workflowId, spec);
      const duration = Date.now() - startTime;

      const workflowResult: WorkflowResult = {
        workflowId,
        status: result.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        stages: result.stages,
        duration,
        error: result.status === 'FAILED' ? result.error : undefined
      };

      console.log(`✅ Workflow completed: ${spec.name} in ${duration}ms`);
      return workflowResult;
    } catch (error) {
      console.error(`❌ Workflow failed: ${spec.name}`, error);
      throw new Error(`Workflow execution failed: ${error}`);
    }
  }

  /**
   * Get information about registered functions
   */
  getRegisteredFunctions() {
    return registry.getStats();
  }

  /**
   * Get running worker information
   */
  getWorkerStatus() {
    const runningWorkers = Array.from(this.workers.keys());
    const allStages = [1, 2, 3] as WorkerStage[];
    
    return {
      running: runningWorkers,
      stopped: allStages.filter(stage => !runningWorkers.includes(stage)),
      total: allStages.length,
      functionsPerStage: {
        stage1: registry.getFunctionsByStage(1).length,
        stage2: registry.getFunctionsByStage(2).length,
        stage3: registry.getFunctionsByStage(3).length
      }
    };
  }

  /**
   * Shutdown all workers and cleanup
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down XFlow SDK...');

    // Shutdown all workers synchronously since shutdown() returns void
    Array.from(this.workers.values()).forEach(worker => {
      try {
        worker.shutdown();
      } catch (err: any) {
        console.error('Error shutting down worker:', err);
      }
    });

    this.workers.clear();
    console.log('✅ XFlow SDK shutdown complete');
  }

  /**
   * Test connection to Temporal server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.connectionManager.testConnection();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get SDK configuration (sanitized)
   */
  getConfig() {
    return {
      temporalAddress: this.config.temporalAddress,
      useSSL: this.config.useSSL,
      jwtTokenPath: this.config.jwtTokenPath || './xflow-token.jwt',
      autoDiscoverCertificates: this.config.autoDiscoverCertificates ?? true
    };
  }

  /**
   * Ensure SDK is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Validate and normalize configuration
   */
  private validateAndNormalizeConfig(config: XFlowConfig): XFlowConfig {
    if (!config.temporalAddress) {
      throw new Error('temporalAddress is required');
    }

    // Auto-detect SSL from address
    const useSSL = config.useSSL ?? (
      config.temporalAddress.startsWith('https://') || 
      config.temporalAddress.includes('github.dev') ||
      config.temporalAddress.includes(':443')
    );

    return {
      ...config,
      useSSL,
      jwtTokenPath: config.jwtTokenPath || './xflow-token.jwt',
      autoDiscoverCertificates: config.autoDiscoverCertificates ?? true
    };
  }
}

// Export a convenience function for quick setup
export function createXFlow(config: XFlowConfig): XFlow {
  return new XFlow(config);
} 