import { WorkflowClient } from '@temporalio/client';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowSpec, WorkflowExecutionStage, StageStatus, WorkflowStage } from '../types/index';
import { InternalWorkflowInput, InternalStageResult } from '../types/internal';
import { ConnectionManager } from './connection-manager';
import { registry } from './registry';

/**
 * Executes workflows by orchestrating function calls across distributed worker stages
 */
export class WorkflowExecutor {
  private connectionManager: ConnectionManager;
  private client: WorkflowClient | null = null;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Execute a workflow specification
   */
  async execute(workflowId: string, spec: WorkflowSpec): Promise<{
    status: 'COMPLETED' | 'FAILED';
    stages: WorkflowExecutionStage[];
    error?: string;
  }> {
    console.log(`🎯 Starting workflow execution: ${spec.name} (${workflowId})`);

    try {
      const client = await this.getClient();

      const input: InternalWorkflowInput = {
        workflowId,
        spec
      };

      const handle = await client.start('executeDistributedWorkflow', {
        args: [input],
        taskQueue: 'xflow-orchestration-queue',
        workflowId: `xflow-${workflowId}`,
        workflowRunTimeout: '1 hour',
        workflowTaskTimeout: '1 minute'
      });

      console.log(`📋 Workflow started with Temporal ID: ${handle.workflowId}`);

      const result = await handle.result();
      const stages = this.convertStageResults(result, spec);
      const allCompleted = stages.every(stage => stage.status === StageStatus.COMPLETED);
      
      console.log(`✅ Workflow ${spec.name} ${allCompleted ? 'completed' : 'failed'}`);
      
      return {
        status: allCompleted ? 'COMPLETED' : 'FAILED',
        stages,
        error: allCompleted ? undefined : 'One or more stages failed'
      };

    } catch (error) {
      console.error(`❌ Workflow execution failed: ${spec.name}`, error);
      
      const stages = spec.stages.map(stage => ({
        ...stage,
        status: StageStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        error: `Workflow failed: ${error}`,
        executedBy: 'none'
      }));

      return {
        status: 'FAILED',
        stages,
        error: `Workflow execution failed: ${error}`
      };
    }
  }

  private async getClient(): Promise<WorkflowClient> {
    if (this.client) {
      return this.client;
    }

    const connection = await this.connectionManager.getConnection();
    this.client = new WorkflowClient({
      connection,
      namespace: 'default'
    });

    return this.client;
  }

  private convertStageResults(
    internalResults: InternalStageResult[], 
    spec: WorkflowSpec
  ): WorkflowExecutionStage[] {
    return spec.stages.map(originalStage => {
      const result = internalResults.find(r => r.stageId === originalStage.id);
      
      if (!result) {
        return {
          ...originalStage,
          status: StageStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          error: 'Stage not executed due to workflow failure',
          executedBy: 'none'
        };
      }

      return {
        ...originalStage,
        status: result.status === 'COMPLETED' ? StageStatus.COMPLETED : StageStatus.FAILED,
        startTime: result.startTime,
        endTime: result.endTime,
        result: result.result,
        error: result.error,
        executedBy: result.executedBy
      };
    });
  }

  /**
   * Close the client connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.connection.close();
      this.client = null;
      console.log('🔌 Workflow client connection closed');
    }
  }
}

/**
 * Distributed workflow implementation for Temporal
 */
export async function executeDistributedWorkflow(input: InternalWorkflowInput): Promise<InternalStageResult[]> {
  const { workflowId, spec } = input;
  const results: InternalStageResult[] = [];
  const completedStages = new Set<string>();
  
  console.log(`Starting distributed workflow execution: ${workflowId} - ${spec.name}`);
  
  const stageMap = new Map<string, any>();
  spec.stages.forEach((stage: WorkflowStage) => stageMap.set(stage.id, stage));
  
  while (completedStages.size < spec.stages.length) {
    const readyStages = spec.stages.filter((stage: WorkflowStage) => {
      if (completedStages.has(stage.id)) return false;
      if (!stage.dependsOn || stage.dependsOn.length === 0) return true;
      return stage.dependsOn.every((depId: string) => completedStages.has(depId));
    });
    
    if (readyStages.length === 0) {
      throw new Error('Circular dependency detected or no stages ready to execute');
    }
    
    const stagePromises = readyStages.map(async (stage: WorkflowStage): Promise<InternalStageResult> => {
      const startTime = new Date();
      
      try {
        console.log(`Executing stage: ${stage.id} - ${stage.function}`);
        
        const workerStage = registry.getStageForFunction(stage.function);
        if (!workerStage) {
          throw new Error(`Function '${stage.function}' not found in registry`);
        }
        
        const result = await executeOnWorkerStage(workerStage, stage.function, stage.params);
        const endTime = new Date();
        
        console.log(`Stage ${stage.id} completed successfully on worker ${workerStage}`);
        
        return {
          stageId: stage.id,
          status: 'COMPLETED',
          result,
          startTime,
          endTime,
          executedBy: `stage${workerStage}`
        };
      } catch (error: any) {
        const endTime = new Date();
        console.error(`Stage ${stage.id} failed:`, error);
        
        return {
          stageId: stage.id,
          status: 'FAILED',
          error: error.message,
          startTime,
          endTime,
          executedBy: 'unknown'
        };
      }
    });
    
    const stageResults = await Promise.all(stagePromises);
    
    stageResults.forEach(result => {
      results.push(result);
      if (result.status === 'COMPLETED') {
        completedStages.add(result.stageId);
      }
    });
    
    const failedResults = stageResults.filter(r => r.status === 'FAILED');
    if (failedResults.length > 0) {
      console.error(`Workflow ${workflowId} failed due to stage failures:`, failedResults);
      const remainingStages = spec.stages.filter((stage: WorkflowStage) => !completedStages.has(stage.id));
      remainingStages.forEach((stage: WorkflowStage) => {
        if (!stageResults.some(r => r.stageId === stage.id)) {
          results.push({
            stageId: stage.id,
            status: 'FAILED',
            error: 'Dependency stage failed',
            startTime: new Date(),
            endTime: new Date(),
            executedBy: 'none'
          });
        }
      });
      break;
    }
  }
  
  console.log(`Distributed workflow ${workflowId} execution completed`);
  return results;
}

/**
 * Execute a function on the appropriate worker stage using Temporal's proxyActivities
 */
async function executeOnWorkerStage(
  workerStage: number, 
  functionName: string, 
  params: Record<string, any>
): Promise<any> {
  const { proxyActivities } = await import('@temporalio/workflow');
  
  const activities = proxyActivities<Record<string, any>>({
    startToCloseTimeout: '5 minutes',
    heartbeatTimeout: '30 seconds',
    taskQueue: `xflow-stage${workerStage}-queue`,
  });
  
  const executorName = `executeStage${workerStage}Activity`;
  return await activities[executorName](functionName, params);
} 