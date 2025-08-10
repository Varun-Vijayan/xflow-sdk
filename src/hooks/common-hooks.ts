// Common hook implementations for XFlow functions
// Ready-to-use observability hooks

import { XFlowHook } from '../types/index';

/**
 * Log when a function starts executing
 */
export const logStart: XFlowHook = (ctx) => {
  console.log(`[XFlow] Starting ${ctx.name} (stage ${ctx.stage}) - ID: ${ctx.id}`);
};

/**
 * Log when a function completes successfully
 */
export const logSuccess: XFlowHook = (ctx) => {
  const duration = ctx.endTime ? ctx.endTime.getTime() - ctx.startTime.getTime() : 0;
  console.log(`[XFlow] ✅ ${ctx.name} completed in ${duration}ms`);
};

/**
 * Log when a function fails
 */
export const logFailure: XFlowHook = (ctx) => {
  const duration = ctx.endTime ? ctx.endTime.getTime() - ctx.startTime.getTime() : 0;
  console.error(`[XFlow] ❌ ${ctx.name} failed after ${duration}ms:`, ctx.error?.message);
};

/**
 * Log when a function finishes (success or failure)
 */
export const logFinish: XFlowHook = (ctx) => {
  const duration = ctx.endTime ? ctx.endTime.getTime() - ctx.startTime.getTime() : 0;
  const status = ctx.error ? 'FAILED' : 'SUCCESS';
  console.log(`[XFlow] 🏁 ${ctx.name} finished with ${status} (${duration}ms)`);
};

/**
 * Detailed logging hook that shows inputs and outputs
 */
export const logDetailed: XFlowHook = (ctx) => {
  const duration = ctx.endTime ? ctx.endTime.getTime() - ctx.startTime.getTime() : 0;
  
  if (ctx.error) {
    console.error(`[XFlow] ${ctx.name} FAILED (${duration}ms)`, {
      id: ctx.id,
      stage: ctx.stage,
      inputs: ctx.inputs,
      error: ctx.error.message
    });
  } else {
    console.log(`[XFlow] ${ctx.name} SUCCESS (${duration}ms)`, {
      id: ctx.id,
      stage: ctx.stage,
      inputs: ctx.inputs,
      output: ctx.output
    });
  }
};

/**
 * Performance monitoring hook that only logs slow functions
 */
export const logSlow = (thresholdMs: number = 1000): XFlowHook => (ctx) => {
  if (!ctx.endTime) return;
  
  const duration = ctx.endTime.getTime() - ctx.startTime.getTime();
  if (duration > thresholdMs) {
    console.warn(`[XFlow] 🐌 SLOW FUNCTION: ${ctx.name} took ${duration}ms (threshold: ${thresholdMs}ms)`);
  }
};

/**
 * Error tracking hook that sends errors to external monitoring
 */
export const trackErrors = (errorTracker?: (error: Error, context: any) => void): XFlowHook => (ctx) => {
  if (ctx.error && errorTracker) {
    errorTracker(ctx.error, {
      functionName: ctx.name,
      stage: ctx.stage,
      id: ctx.id,
      inputs: ctx.inputs,
      workflowId: ctx.workflowId,
      stageId: ctx.stageId
    });
  }
};

/**
 * Metrics collection hook
 */
export const collectMetrics = (metricsCollector?: (metric: any) => void): XFlowHook => (ctx) => {
  if (!ctx.endTime || !metricsCollector) return;
  
  const duration = ctx.endTime.getTime() - ctx.startTime.getTime();
  metricsCollector({
    name: ctx.name,
    stage: ctx.stage,
    duration,
    success: !ctx.error,
    timestamp: ctx.startTime.toISOString(),
    workflowId: ctx.workflowId
  });
}; 