// Jest setup file for XFlow SDK tests

// Global test timeout (since we're dealing with async operations)
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup any global test utilities here 