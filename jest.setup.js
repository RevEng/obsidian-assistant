// This file is run before each test file
// It can be used to set up global test environment, mocks, etc.

// Suppress console.error and console.warn during tests
global.console.error = jest.fn();
global.console.warn = jest.fn();

// Mock fetch API
global.fetch = jest.fn();

// Add any other global mocks or setup needed for tests
