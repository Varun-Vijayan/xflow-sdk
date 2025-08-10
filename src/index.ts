// XFlow SDK - Main export file
// Public APIs for clients

// Main SDK class
export { XFlow, createXFlow } from './core/xflow';

// Decorator for marking functions
export { xflowFunction, isXFlowFunction, getXFlowOptions, getOriginalFunction } from './decorators/xflow-function';

// Public types that clients need
export {
  // Configuration types
  XFlowConfig,
  WorkerConfig,
  SSLCertificates,
  
  // Function decoration types
  XFlowFunctionOptions,
  WorkerStage,
  XFlowHooks,
  XFlowHook,
  XFlowContext,
  
  // Workflow types
  WorkflowSpec,
  WorkflowStage,
  WorkflowResult,
  WorkflowExecution,
  WorkflowExecutionStage,
  
  // Status enums
  StageStatus
} from './types/index';

// Registry access (for advanced users)
export { registry } from './core/registry';

// Common hook implementations
export {
  logStart,
  logSuccess, 
  logFailure,
  logFinish
} from './hooks/common-hooks';

// Version info
export const VERSION = '1.0.0'; 