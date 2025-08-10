// Internal types for XFlow SDK implementation
// These are not exposed to clients

import { XFlowFunctionOptions, WorkerStage } from './index';

/**
 * Internal registry entry for decorated functions
 */
export interface RegisteredXFlowFunction {
  name: string;
  stage: WorkerStage;
  originalFunction: Function;
  options: XFlowFunctionOptions;
  metadata?: {
    fileName?: string;
    lineNumber?: number;
    registeredAt: Date;
  };
}

/**
 * Internal connection options for Temporal
 */
export interface TemporalConnectionOptions {
  address: string;
  tls?: {
    serverRootCACertificate?: Buffer;
    clientCertPair?: {
      crt: Buffer;
      key: Buffer;
    };
    serverNameOverride?: string;
  };
  metadata?: {
    authorization?: string;
  };
}

/**
 * Internal worker options for creating Temporal workers
 */
export interface InternalWorkerOptions {
  stage: WorkerStage;
  taskQueue: string;
  connection: any; // NativeConnection from @temporalio/worker
  activities: Record<string, Function>;
  workflowsPath: string;
  maxConcurrentActivityTaskExecutions?: number;
  maxConcurrentWorkflowTaskExecutions?: number;
}

/**
 * Internal activity execution context
 */
export interface ActivityExecutionContext {
  functionName: string;
  params: Record<string, any>;
  stage: WorkerStage;
  workflowId?: string;
  stageId?: string;
  activityId?: string;
}

/**
 * Internal workflow execution input for Temporal
 */
export interface InternalWorkflowInput {
  workflowId: string;
  spec: any; // WorkflowSpec but using 'any' to avoid circular imports
}

/**
 * Internal stage execution result
 */
export interface InternalStageResult {
  stageId: string;
  status: 'COMPLETED' | 'FAILED';
  result?: any;
  error?: string;
  startTime: Date;
  endTime: Date;
  executedBy: string; // Which worker stage executed this
}

/**
 * Function routing information
 */
export interface FunctionRoute {
  functionName: string;
  stage: WorkerStage;
  taskQueue: string;
  timeout?: string;
}

/**
 * SSL certificate file paths
 */
export interface CertificatePaths {
  clientCert: string;
  clientKey: string;
  caCert: string;
}

/**
 * JWT token information
 */
export interface JWTInfo {
  token: string;
  source: 'file' | 'config' | 'environment';
  path?: string;
} 