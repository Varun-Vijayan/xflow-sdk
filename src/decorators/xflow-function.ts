// @xflowFunction decorator for XFlow SDK
// This is what clients use to mark their functions

import { v4 as uuidv4 } from 'uuid';
import { XFlowFunctionOptions, XFlowContext, StageStatus } from '../types/index';
import { registry } from '../core/registry';

/**
 * Decorator to mark functions for XFlow execution
 * 
 * @example
 * ```typescript
 * @xflowFunction({ stage: 1, name: 'validateUser' })
 * async function validateUser(data: { email: string }) {
 *   // Your validation logic
 *   return { valid: true };
 * }
 * ```
 */
export function xflowFunction(options: XFlowFunctionOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalFunction = descriptor.value;
    const functionName = options.name || propertyKey;

    // Validate options
    if (!options.stage || options.stage < 1 || options.stage > 3) {
      throw new Error(`Invalid stage: ${options.stage}. Must be 1, 2, or 3.`);
    }

    // Register the function in the global registry
    try {
      registry.register(
        functionName,
        options.stage,
        originalFunction,
        options,
        {
          fileName: getCallerFileName(),
          lineNumber: getCallerLineNumber()
        }
      );
    } catch (error) {
      throw new Error(`Failed to register function '${functionName}': ${error}`);
    }

    // Wrap the function with observability hooks
    descriptor.value = async function (...args: any[]) {
      const context: XFlowContext = {
        id: uuidv4(),
        name: functionName,
        stage: options.stage,
        inputs: Object.fromEntries(args.map((val, i) => [`arg${i}`, val])),
        startTime: new Date()
      };

      const hooks = options.hooks || {};

      try {
        // Execute onStart hook
        if (hooks.onStart) {
          await hooks.onStart(context);
        }

        // Execute the original function
        const result = await originalFunction.apply(this, args);

        // Update context with success
        context.output = result;
        context.endTime = new Date();

        // Execute onSuccess hook
        if (hooks.onSuccess) {
          await hooks.onSuccess(context);
        }

        return result;

      } catch (error) {
        // Update context with error
        context.error = error as Error;
        context.endTime = new Date();

        // Execute onFailure hook
        if (hooks.onFailure) {
          try {
            await hooks.onFailure(context);
          } catch (hookError) {
            console.error('Error in onFailure hook:', hookError);
          }
        }

        throw error;

      } finally {
        // Always execute onFinish hook
        if (hooks.onFinish) {
          try {
            await hooks.onFinish(context);
          } catch (hookError) {
            console.error('Error in onFinish hook:', hookError);
          }
        }
      }
    };

    // Preserve original function metadata
    Object.defineProperty(descriptor.value, 'name', { value: functionName });
    Object.defineProperty(descriptor.value, '__xflow_original', { value: originalFunction });
    Object.defineProperty(descriptor.value, '__xflow_options', { value: options });

    return descriptor;
  };
}

/**
 * Get the file name of the caller (for debugging)
 */
function getCallerFileName(): string {
  try {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    // Look for the first line that's not in this file
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('xflow-function.ts') && !line.includes('registry.ts')) {
        const match = line.match(/\((.+):\d+:\d+\)/);
        if (match) {
          return match[1].split('/').pop() || 'unknown';
        }
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get the line number of the caller (for debugging)
 */
function getCallerLineNumber(): number {
  try {
    const stack = new Error().stack;
    if (!stack) return 0;
    
    const lines = stack.split('\n');
    // Look for the first line that's not in this file
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('xflow-function.ts') && !line.includes('registry.ts')) {
        const match = line.match(/:(\d+):\d+\)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Helper function to check if a function is an XFlow function
 */
export function isXFlowFunction(fn: any): boolean {
  return typeof fn === 'function' && '__xflow_options' in fn;
}

/**
 * Helper function to get XFlow options from a function
 */
export function getXFlowOptions(fn: any): XFlowFunctionOptions | null {
  if (isXFlowFunction(fn)) {
    return fn.__xflow_options;
  }
  return null;
}

/**
 * Helper function to get the original function before decoration
 */
export function getOriginalFunction(fn: any): Function | null {
  if (isXFlowFunction(fn)) {
    return fn.__xflow_original;
  }
  return null;
} 