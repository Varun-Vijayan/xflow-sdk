// Core types for XFlow SDK - Clean interfaces for clients

/**
 * Worker tier for function execution (infrastructure level)
 * Functions are distributed across 3 physical worker tiers:
 * Tier 1: Validation, Security, Logging
 * Tier 2: Business Logic, Data Processing, External APIs  
 * Tier 3: Notifications, Finalization, Cleanup
 * 
 * Note: Workflows can have unlimited steps - each step executes on one of these 3 tiers
 */
export type WorkerStage = 1 | 2 | 3;

/**
 * Execution status of a workflow stage
 */
export enum StageStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Context object passed to hooks during function execution
 */
export interface XFlowContext {
  id: string;
  name: string;
  stage: WorkerStage;
  inputs: Record<string, any>;
  output?: any;
  error?: Error;
  startTime: Date;
  endTime?: Date;
  workflowId?: string;
  stageId?: string;
}

/**
 * Hook function type for observability
 */
export type XFlowHook = (ctx: XFlowContext) => void | Promise<void>;

/**
 * Observability hooks for function execution
 */
export interface XFlowHooks {
  onStart?: XFlowHook;
  onSuccess?: XFlowHook;
  onFailure?: XFlowHook;
  onFinish?: XFlowHook;
}

/**
 * Configuration for decorating functions with @xflowFunction
 */
export interface XFlowFunctionOptions {
  /** Function name (defaults to method name) */
  name?: string;
  /** Worker stage (1, 2, or 3) */
  stage: WorkerStage;
  /** Timeout for function execution (e.g., '5 minutes', '30 seconds') */
  timeout?: string;
  /** Observability hooks */
  hooks?: XFlowHooks;
}

/**
 * A single stage in a workflow definition
 */
export interface WorkflowStage {
  /** Unique identifier for this stage */
  id: string;
  /** Name of the decorated function to execute */
  function: string;
  /** Parameters to pass to the function */
  params: Record<string, any>;
  /** Array of stage IDs this stage depends on */
  dependsOn?: string[];
}

/**
 * Complete workflow specification
 */
export interface WorkflowSpec {
  /** Human-readable workflow name */
  name: string;
  /** Optional description */
  description?: string;
  /** Array of stages to execute */
  stages: WorkflowStage[];
}

/**
 * Runtime execution state of a workflow stage
 */
export interface WorkflowExecutionStage extends WorkflowStage {
  status: StageStatus;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  result?: any;
  executedBy?: string; // Which worker stage executed this
}

/**
 * Complete workflow execution result
 */
export interface WorkflowExecution {
  id: string;
  spec: WorkflowSpec;
  stages: WorkflowExecutionStage[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startTime: Date;
  endTime?: Date;
}

/**
 * SSL/TLS certificate configuration
 */
export interface SSLCertificates {
  /** Path to client certificate file */
  clientCert: string;
  /** Path to client private key file */
  clientKey: string;
  /** Path to CA certificate file */
  caCert: string;
  /** Server name override for certificate validation */
  serverName?: string;
}

/**
 * XFlow SDK configuration
 */
export interface XFlowConfig {
  /** Address of your Temporal server */
  temporalAddress: string;
  /** Whether to use SSL/TLS (default: auto-detect from address) */
  useSSL?: boolean;
  /** JWT token for authentication (optional if provided via file) */
  jwtToken?: string;
  /** Path to JWT token file (default: './xflow-token.jwt') */
  jwtTokenPath?: string;
  /** SSL certificate configuration */
  certificates?: SSLCertificates;
  /** Whether to auto-discover certificates in ./certs/ directory */
  autoDiscoverCertificates?: boolean;
}

/**
 * Worker configuration for starting workers
 */
export interface WorkerConfig {
  /** Which worker stage to start (1, 2, 3, or 'all') */
  stage: WorkerStage | 'all';
  /** Optional custom task queue prefix (default: 'xflow') */
  taskQueuePrefix?: string;
  /** Maximum concurrent activities per worker */
  maxConcurrentActivities?: number;
}

/**
 * Result of executing a workflow
 */
export interface WorkflowResult {
  /** Unique workflow execution ID */
  workflowId: string;
  /** Final execution status */
  status: 'COMPLETED' | 'FAILED';
  /** Results from each stage */
  stages: WorkflowExecutionStage[];
  /** Total execution time in milliseconds */
  duration: number;
  /** Error message if workflow failed */
  error?: string;
} 