import { registry } from '../src/core/registry';

// Clear registry before testing
beforeAll(() => {
  (registry as any).functions.clear();
  (registry as any).stageMap.forEach((set: Set<string>) => set.clear());
});

describe('XFlow Function Decorator', () => {
  test('should work with dynamic import', async () => {
    // Dynamically import and apply decorator to avoid compilation issues
    const { xflowFunction } = await import('../src/decorators/xflow-function');
    
    // Create a test class to hold our decorated method
    class TestClass {
      @xflowFunction({ stage: 1, name: 'decoratedFunction' })
      async decoratedFunction(data: { value: string }) {
        return { processed: data.value.toUpperCase() };
      }
    }

    // Verify the function was registered
    const registered = registry.getFunction('decoratedFunction');
    expect(registered).toBeDefined();
    expect(registered?.name).toBe('decoratedFunction');
    expect(registered?.stage).toBe(1);

    // Test the decorated function still works
    const instance = new TestClass();
    const result = await instance.decoratedFunction({ value: 'hello' });
    expect(result).toEqual({ processed: 'HELLO' });
  });
}); 