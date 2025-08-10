import { registry } from '../src/core/registry';

describe('XFlow Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    (registry as any).functions.clear();
    (registry as any).stageMap.forEach((set: Set<string>) => set.clear());
  });

  test('should register functions directly', () => {
    const mockFunction = async (data: any) => ({ result: 'test' });
    
    registry.register('testFunction', 1, mockFunction, { stage: 1, name: 'testFunction' });
    
    const registered = registry.getFunction('testFunction');
    expect(registered).toBeDefined();
    expect(registered?.name).toBe('testFunction');
    expect(registered?.stage).toBe(1);
  });

  test('should prevent duplicate function names', () => {
    const mockFunction1 = async (data: any) => ({ result: 'first' });
    const mockFunction2 = async (data: any) => ({ result: 'second' });
    
    registry.register('duplicateFunction', 1, mockFunction1, { stage: 1, name: 'duplicateFunction' });
    
    expect(() => {
      registry.register('duplicateFunction', 2, mockFunction2, { stage: 2, name: 'duplicateFunction' });
    }).toThrow('Function name conflict');
  });

  test('should organize functions by stage', () => {
    const mockFunction1 = async (data: any) => ({ result: 'stage1' });
    const mockFunction2 = async (data: any) => ({ result: 'stage2' });
    
    registry.register('stage1Function', 1, mockFunction1, { stage: 1, name: 'stage1Function' });
    registry.register('stage2Function', 2, mockFunction2, { stage: 2, name: 'stage2Function' });

    const stage1Functions = registry.getFunctionsByStage(1);
    const stage2Functions = registry.getFunctionsByStage(2);

    expect(stage1Functions).toHaveLength(1);
    expect(stage1Functions[0].name).toBe('stage1Function');
    
    expect(stage2Functions).toHaveLength(1);
    expect(stage2Functions[0].name).toBe('stage2Function');
  });

  test('should validate workflow functions', () => {
    const mockFunction = async (data: any) => ({ result: 'exists' });
    
    registry.register('existingFunction', 1, mockFunction, { stage: 1, name: 'existingFunction' });

    const validation = registry.validateWorkflowFunctions(['existingFunction', 'missingFunction']);
    
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('missingFunction');
  });

  test('should generate activities for stage', () => {
    const mockFunction = async (data: any) => ({ result: 'business' });
    
    registry.register('businessFunction', 2, mockFunction, { stage: 2, name: 'businessFunction' });

    const activities = registry.generateActivitiesForStage(2);
    
    expect(activities).toHaveProperty('businessFunction');
    expect(activities).toHaveProperty('executeStage2Activity');
    expect(typeof activities.businessFunction).toBe('function');
    expect(typeof activities.executeStage2Activity).toBe('function');
  });

  test('should return all registered functions', () => {
    const mockFunction1 = async (data: any) => ({ result: 'test1' });
    const mockFunction2 = async (data: any) => ({ result: 'test2' });
    
    registry.register('function1', 1, mockFunction1, { stage: 1, name: 'function1' });
    registry.register('function2', 2, mockFunction2, { stage: 2, name: 'function2' });

    const allFunctions = registry.getAllFunctions();
    expect(allFunctions).toHaveLength(2);
    expect(allFunctions.map(f => f.name)).toContain('function1');
    expect(allFunctions.map(f => f.name)).toContain('function2');
  });

  test('should provide registry stats', () => {
    const mockFunction1 = async (data: any) => ({ result: 'test1' });
    const mockFunction2 = async (data: any) => ({ result: 'test2' });
    const mockFunction3 = async (data: any) => ({ result: 'test3' });
    
    registry.register('stage1Func', 1, mockFunction1, { stage: 1, name: 'stage1Func' });
    registry.register('stage2Func1', 2, mockFunction2, { stage: 2, name: 'stage2Func1' });
    registry.register('stage2Func2', 2, mockFunction3, { stage: 2, name: 'stage2Func2' });

    const stats = registry.getStats();
    expect(stats.totalFunctions).toBe(3);
    expect(stats.byStage.stage1).toBe(1);
    expect(stats.byStage.stage2).toBe(2);
    expect(stats.byStage.stage3).toBe(0);
  });
}); 