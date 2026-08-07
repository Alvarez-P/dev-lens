import { NodeType } from '@/modules/knowledge-graph/domain/node-type.enum';

describe('NodeType enum', () => {
  it('should define the exact graph node taxonomy', () => {
    expect(Object.values(NodeType)).toEqual([
      'Project',
      'Package',
      'Module',
      'Controller',
      'Service',
      'Repository',
      'Entity',
      'DTO',
      'Interface',
      'Endpoint',
      'ExternalDependency',
      'Guard',
      'Pipe',
      'Interceptor',
      'Middleware',
      'Unknown',
    ]);
  });

  it('should expose each node type as a string value', () => {
    expect(NodeType.PROJECT).toBe('Project');
    expect(NodeType.PACKAGE).toBe('Package');
    expect(NodeType.MODULE).toBe('Module');
    expect(NodeType.CONTROLLER).toBe('Controller');
    expect(NodeType.SERVICE).toBe('Service');
    expect(NodeType.REPOSITORY).toBe('Repository');
    expect(NodeType.ENTITY).toBe('Entity');
    expect(NodeType.DTO).toBe('DTO');
    expect(NodeType.INTERFACE).toBe('Interface');
    expect(NodeType.ENDPOINT).toBe('Endpoint');
    expect(NodeType.EXTERNAL_DEPENDENCY).toBe('ExternalDependency');
    expect(NodeType.GUARD).toBe('Guard');
    expect(NodeType.PIPE).toBe('Pipe');
    expect(NodeType.INTERCEPTOR).toBe('Interceptor');
    expect(NodeType.MIDDLEWARE).toBe('Middleware');
    expect(NodeType.UNKNOWN).toBe('Unknown');
  });
});
