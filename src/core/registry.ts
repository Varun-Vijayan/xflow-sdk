// Function registry for XFlow SDK
// Tracks all decorated functions and handles routing

import { WorkerStage, XFlowFunctionOptions } from '../types/index';
import { RegisteredXFlowFunction, FunctionRoute } from '../types/internal';

/**
 * Global registry of all decorated XFlow functions
 */
class XFlowRegistry {
  private functions: Map<string, RegisteredXFlowFunction> = new Map();
  private stageMap: Map<WorkerStage, Set<string>> = new Map([
    [1, new Set()],
    [2, new Set()],
    [3, new Set()]
  ]);

  /**
   * Register a function from the @xflowFunction decorator
   */
  register(
    name: string,
    stage: WorkerStage,
    originalFunction: Function,
    options: XFlowFunctionOptions,
    metadata?: {
      fileName?: string;
      lineNumber?: number;
    }
  ): void {
    // Check for name conflicts
    if (this.functions.has(name)) {
      const existing = this.functions.get(name)!;
      throw new Error(
        `Function name conflict: '${name}' is already registered for stage ${existing.stage}. ` +
        `Function names must be unique across all stages.`
      );
    }

    // Register the function
    const registration: RegisteredXFlowFunction = {
      name,
      stage,
      originalFunction,
      options,
      metadata: {
        ...metadata,
        registeredAt: new Date()
      }
    };

    this.functions.set(name, registration);
    this.stageMap.get(stage)!.add(name);

    console.log(`[XFlow Registry] Registered function '${name}' for stage ${stage}`);
  }

  /**
   * Get a registered function by name
   */
  getFunction(name: string): RegisteredXFlowFunction | undefined {
    return this.functions.get(name);
  }

  /**
   * Get all functions for a specific worker stage
   */
  getFunctionsByStage(stage: WorkerStage): RegisteredXFlowFunction[] {
    const functionNames = this.stageMap.get(stage) || new Set();
    return Array.from(functionNames)
      .map(name => this.functions.get(name)!)
      .filter(Boolean);
  }

  /**
   * Get all registered functions
   */
  getAllFunctions(): RegisteredXFlowFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Generate activities object for a specific worker stage
   * This is used when creating Temporal workers
   */
  generateActivitiesForStage(stage: WorkerStage): Record<string, Function> {
    const stageFunctions = this.getFunctionsByStage(stage);
    const activities: Record<string, Function> = {};

    stageFunctions.forEach(({ name, originalFunction }) => {
      activities[name] = originalFunction;
    });

    // Add the stage execution dispatcher
    activities[`executeStage${stage}Activity`] = this.createStageExecutor(stage);

    return activities;
  }

  /**
   * Create a stage executor function (matches POC pattern)
   * This function routes incoming function calls to the right registered function
   */
  private createStageExecutor(stage: WorkerStage) {
    return async (functionName: string, params: Record<string, any>): Promise<any> => {
      console.log(`[Worker-${stage}] Executing ${functionName} with params:`, params);

      const registeredFunction = this.getFunction(functionName);
      
      if (!registeredFunction) {
        throw new Error(`Function '${functionName}' not found in registry`);
      }

      if (registeredFunction.stage !== stage) {
        throw new Error(
          `Function '${functionName}' is registered for stage ${registeredFunction.stage}, ` +
          `but worker stage ${stage} is trying to execute it`
        );
      }

      // Execute the original function
      return await registeredFunction.originalFunction(params);
    };
  }

  /**
   * Get function routing information for workflow orchestration
   */
  getFunctionRoutes(): FunctionRoute[] {
    return this.getAllFunctions().map(func => ({
      functionName: func.name,
      stage: func.stage,
      taskQueue: `xflow-stage${func.stage}-queue`,
      timeout: func.options.timeout || '5 minutes'
    }));
  }

  /**
   * Determine which worker stage should handle a function
   */
  getStageForFunction(functionName: string): WorkerStage | null {
    const func = this.getFunction(functionName);
    return func ? func.stage : null;
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const stats = {
      totalFunctions: this.functions.size,
      byStage: {
        stage1: this.stageMap.get(1)!.size,
        stage2: this.stageMap.get(2)!.size,
        stage3: this.stageMap.get(3)!.size
      },
      functions: this.getAllFunctions().map(f => ({
        name: f.name,
        stage: f.stage,
        timeout: f.options.timeout,
        registeredAt: f.metadata?.registeredAt
      }))
    };

    return stats;
  }

  /**
   * Clear the registry (useful for testing)
   */
  clear(): void {
    this.functions.clear();
    this.stageMap.forEach(set => set.clear());
  }

  /**
   * Validate that all functions in a workflow are registered
   */
  validateWorkflowFunctions(functionNames: string[]): { valid: boolean; missing: string[] } {
    const missing = functionNames.filter(name => !this.functions.has(name));
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Global singleton registry instance
export const registry = new XFlowRegistry();

// Export the class for testing
export { XFlowRegistry };