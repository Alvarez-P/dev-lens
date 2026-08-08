import { Injectable } from '@nestjs/common';
import { posix } from 'path';
import {
  SourceFile,
  ClassDeclaration,
  MethodDeclaration,
  ParameterDeclaration,
  Decorator,
} from 'ts-morph';
import { Language } from '../../../domain/language.vo';
import { ParseResult } from '../../../domain/parse-result.vo';
import {
  IrProject,
  IrProjectProps,
  IrPackageProps,
  IrModuleProps,
  IrClassProps,
  IrDependencyProps,
  IrRelationshipProps,
  IrParamProps,
  LifecycleEntry,
  LifecycleKind,
  TypedParam,
} from '../../../domain/ir-nodes';
import { DecoratorRoleRegistry } from '../decorator-role-registry';

const HTTP_METHODS: ReadonlyMap<string, string> = new Map([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Delete', 'DELETE'],
  ['Patch', 'PATCH'],
  ['Options', 'OPTIONS'],
  ['Head', 'HEAD'],
  ['All', 'ALL'],
]);

/** Roles that classify a method decorator as a lifecycle step on an endpoint. */
const LIFECYCLE_KINDS: ReadonlySet<string> = new Set([
  'guard',
  'pipe',
  'interceptor',
  'middleware',
]);

/** Roles that classify a parameter decorator for the typedParams projection. */
const PARAMETER_ROLES: ReadonlySet<string> = new Set(['body', 'param', 'query', 'headers']);

const DEFAULT_PACKAGE = 'default';

interface DecoratorRoleInfo {
  className: string;
  role: string;
  routePrefix?: string;
}

interface MethodData {
  name: string;
  visibility: string;
  isStatic: boolean;
  parameters: string[];
  decorators: string[];
  params: IrParamProps[];
  returnType: string;
}

interface EndpointData {
  name: string;
  httpMethod: string;
  path: string;
  parameters: string[];
  lifecycle: LifecycleEntry[];
  typedParams: TypedParam[];
}

interface PendingClass {
  name: string;
  isAbstract: boolean;
  isExported: boolean;
  role: string | null;
  routePrefix: string | null;
  extends: string | null;
  implements: string[];
  methods: MethodData[];
  endpoints: EndpointData[];
  decorators: string[];
  constructorParams: IrParamProps[];
}

interface PendingModule {
  filePath: string;
  moduleName: string;
  moduleFqn: string;
  classes: PendingClass[];
  interfaces: { name: string; isExported: boolean }[];
  functions: { name: string; isAsync: boolean; isExported: boolean }[];
  imports: string[];
}

export interface TypeScriptIrBuildOptions {
  projectName?: string;
  rootPath?: string;
}

export interface IrBuildDiagnostic {
  filePath: string;
  message: string;
}

export interface IrBuildResult {
  ir: IrProject;
  diagnostics: IrBuildDiagnostic[];
}

@Injectable()
export class TypeScriptIrBuilder {
  constructor(private readonly roleRegistry: DecoratorRoleRegistry) {}

  build(parseResults: ParseResult[], options: TypeScriptIrBuildOptions = {}): IrBuildResult {
    const projectName = options.projectName?.trim() || 'project';
    const rootPath = options.rootPath?.trim() || '/';
    const diagnostics: IrBuildDiagnostic[] = [];
    const pendingModules: PendingModule[] = [];
    const packageFqn = `${projectName}:${DEFAULT_PACKAGE}`;

    for (const result of parseResults) {
      if (!result.isSuccess || result.ast === null) {
        const message =
          result.diagnostics.map((diagnostic) => diagnostic.message).join('; ') || 'Parse failed';

        diagnostics.push({ filePath: result.filePath, message });
        continue;
      }

      const pendingModule = this.buildModule(
        result.ast as SourceFile,
        result,
        packageFqn,
        rootPath,
      );

      if (pendingModule !== null) {
        pendingModules.push(pendingModule);
      }
    }

    const modules = this.dedupeModules(pendingModules);
    const modulePathToFqn = new Map<string, string>();

    for (const mod of modules) {
      modulePathToFqn.set(this.normalizeModulePath(mod.filePath), mod.moduleFqn);
    }

    const props = this.toProjectProps(
      modules,
      modulePathToFqn,
      projectName,
      rootPath,
      parseResults,
    );
    const ir = IrProject.create(props);

    return { ir, diagnostics };
  }

  private buildModule(
    sourceFile: SourceFile,
    result: ParseResult,
    packageFqn: string,
    rootPath: string,
  ): PendingModule | null {
    const moduleName = this.toModuleName(result.filePath, rootPath);

    if (!moduleName) {
      return null;
    }

    const moduleFqn = `${packageFqn}:${moduleName}`;
    const decoratorRoles = this.getDecoratorRoles(result.metadata);

    const classes: PendingClass[] = [];

    for (const classDeclaration of sourceFile.getClasses()) {
      const pendingClass = this.buildClass(classDeclaration, decoratorRoles);

      if (pendingClass !== null) {
        classes.push(pendingClass);
      }
    }

    const interfaces = sourceFile
      .getInterfaces()
      .map((iface) => ({ name: iface.getName(), isExported: iface.isExported() }))
      .filter((iface) => Boolean(iface.name));

    const functions = sourceFile
      .getFunctions()
      .map((fn) => ({
        name: fn.getName(),
        isAsync: fn.isAsync(),
        isExported: fn.isExported(),
      }))
      .filter((fn): fn is { name: string; isAsync: boolean; isExported: boolean } =>
        Boolean(fn.name),
      );

    const imports = sourceFile.getImportDeclarations().map((imp) => imp.getModuleSpecifierValue());

    return {
      filePath: result.filePath,
      moduleName,
      moduleFqn,
      classes,
      interfaces,
      functions,
      imports,
    };
  }

  private buildClass(
    classDeclaration: ClassDeclaration,
    decoratorRoles: Map<string, DecoratorRoleInfo>,
  ): PendingClass | null {
    const name = classDeclaration.getName();

    if (!name) {
      return null;
    }

    const roleInfo = this.lookupRole(classDeclaration, name, decoratorRoles);
    const role = roleInfo?.role ?? null;
    const routePrefix = roleInfo?.routePrefix ?? null;
    const extendsName = classDeclaration.getExtends()?.getExpression().getText() ?? null;
    const implementsNames = classDeclaration
      .getImplements()
      .map((imp) => imp.getExpression().getText());
    const decorators = classDeclaration.getDecorators().map((decorator) => decorator.getText());
    const constructorParams = this.buildConstructorParams(classDeclaration);

    const methods: MethodData[] = [];
    const endpoints: EndpointData[] = [];

    for (const method of classDeclaration.getMethods()) {
      const methodName = method.getName();

      if (!methodName) {
        continue;
      }

      methods.push(this.buildMethod(method, methodName));
      endpoints.push(...this.buildEndpoints(method, methodName, routePrefix));
    }

    return {
      name,
      isAbstract: classDeclaration.isAbstract(),
      isExported: classDeclaration.isExported(),
      role,
      routePrefix,
      extends: extendsName,
      implements: implementsNames,
      methods,
      endpoints,
      decorators,
      constructorParams,
    };
  }

  private buildConstructorParams(classDeclaration: ClassDeclaration): IrParamProps[] {
    const constructor = classDeclaration.getConstructors()[0];

    if (constructor === undefined) {
      return [];
    }

    return constructor.getParameters().map((param) => ({
      name: param.getName(),
      type: this.parameterType(param),
      decorators: param.getDecorators().map((decorator) => decorator.getText()),
    }));
  }

  private buildMethod(method: MethodDeclaration, name: string): MethodData {
    const visibility = method.hasModifier('private')
      ? 'private'
      : method.hasModifier('protected')
        ? 'protected'
        : 'public';

    return {
      name,
      visibility,
      isStatic: method.isStatic(),
      parameters: method.getParameters().map((param) => param.getName()),
      decorators: method.getDecorators().map((decorator) => decorator.getText()),
      params: method.getParameters().map((param) => ({
        name: param.getName(),
        type: this.parameterType(param),
        decorators: param.getDecorators().map((decorator) => decorator.getText()),
      })),
      returnType: method.getReturnTypeNode()?.getText() ?? 'void',
    };
  }

  private parameterType(param: { getTypeNode(): { getText(): string } | undefined }): string {
    return param.getTypeNode()?.getText() ?? 'any';
  }

  private buildEndpoints(
    method: MethodDeclaration,
    methodName: string,
    routePrefix: string | null,
  ): EndpointData[] {
    const endpoints: EndpointData[] = [];
    const parameters = method.getParameters().map((param) => param.getName());
    const lifecycle = this.projectLifecycle(method);
    const typedParams = this.projectTypedParams(method);

    for (const decorator of method.getDecorators()) {
      const httpMethod = HTTP_METHODS.get(decorator.getName());

      if (httpMethod === undefined) {
        continue;
      }

      endpoints.push({
        name: methodName,
        httpMethod,
        path: this.buildEndpointPath(routePrefix, this.getDecoratorPath(decorator)),
        parameters,
        lifecycle,
        typedParams,
      });
    }

    return endpoints;
  }

  /**
   * Project method-level lifecycle decorators (@UseGuards, @UsePipes,
   * @UseInterceptors, @Middleware) onto ordered lifecycle entries. Each
   * decorator argument becomes one entry, preserving declaration order.
   */
  private projectLifecycle(method: MethodDeclaration): LifecycleEntry[] {
    const lifecycle: LifecycleEntry[] = [];

    for (const decorator of method.getDecorators()) {
      const role = this.roleRegistry.get(decorator.getName());

      if (role === null || !LIFECYCLE_KINDS.has(role)) {
        continue;
      }

      for (const argument of decorator.getCallExpression()?.getArguments() ?? []) {
        lifecycle.push({ kind: role as LifecycleKind, classRef: argument.getText() });
      }
    }

    return lifecycle;
  }

  /**
   * Project method parameters onto ordered typedParams entries. The decorator
   * is the first NestJS parameter decorator (@Body/@Param/@Query/@Headers),
   * or null when the parameter is undecorated.
   */
  private projectTypedParams(method: MethodDeclaration): TypedParam[] {
    return method.getParameters().map((param) => ({
      name: param.getName(),
      typeAnnotation: this.parameterType(param),
      decorator: this.resolveParameterDecorator(param),
    }));
  }

  private resolveParameterDecorator(param: ParameterDeclaration): string | null {
    for (const decorator of param.getDecorators()) {
      const role = this.roleRegistry.get(decorator.getName());

      if (role !== null && PARAMETER_ROLES.has(role)) {
        return `@${decorator.getName()}`;
      }
    }

    return null;
  }

  private getDecoratorPath(decorator: Decorator): string | null {
    const argumentsList = decorator.getCallExpression()?.getArguments();

    if (!argumentsList || argumentsList.length === 0) {
      return null;
    }

    return argumentsList[0].getText().replace(/^['"]|['"]$/g, '');
  }

  private buildEndpointPath(routePrefix: string | null, methodPath: string | null): string {
    const prefix = routePrefix ? routePrefix.replace(/^\/+|\/+$/g, '') : '';
    const path = methodPath ? methodPath.replace(/^\/+|\/+$/g, '') : '';

    return `/${[prefix, path].filter(Boolean).join('/')}`;
  }

  private lookupRole(
    classDeclaration: ClassDeclaration,
    name: string,
    decoratorRoles: Map<string, DecoratorRoleInfo>,
  ): DecoratorRoleInfo | null {
    const fromMetadata = decoratorRoles.get(name);

    if (fromMetadata) {
      return fromMetadata;
    }

    for (const decorator of classDeclaration.getDecorators()) {
      const role = this.roleRegistry.get(decorator.getName());

      if (role !== null) {
        return { className: name, role };
      }
    }

    return null;
  }

  private getDecoratorRoles(metadata: Record<string, unknown>): Map<string, DecoratorRoleInfo> {
    const rolesByClass = new Map<string, DecoratorRoleInfo>();
    const roles = metadata.decoratorRoles;

    if (!Array.isArray(roles)) {
      return rolesByClass;
    }

    for (const entry of roles as DecoratorRoleInfo[]) {
      rolesByClass.set(entry.className, entry);
    }

    return rolesByClass;
  }

  private dedupeModules(pendingModules: PendingModule[]): PendingModule[] {
    const unique = new Map<string, PendingModule>();

    for (const mod of pendingModules) {
      if (!unique.has(mod.filePath)) {
        unique.set(mod.filePath, mod);
      }
    }

    return [...unique.values()];
  }

  private toProjectProps(
    modules: PendingModule[],
    modulePathToFqn: Map<string, string>,
    projectName: string,
    rootPath: string,
    parseResults: ParseResult[],
  ): IrProjectProps {
    const language = this.resolveLanguage(parseResults);
    const dependencies: IrDependencyProps[] = [];
    const relationships: IrRelationshipProps[] = [];
    const seenDependencies = new Set<string>();

    for (const mod of modules) {
      for (const specifier of mod.imports) {
        // Skip Node.js built-in modules — they don't live in our graph
        if (specifier.startsWith('node:')) continue;

        const target = this.resolveImportTarget(specifier, mod.filePath, modulePathToFqn);
        const key = `${mod.moduleFqn}|${target}|import`;

        if (!seenDependencies.has(key)) {
          seenDependencies.add(key);
          dependencies.push({ source: mod.moduleFqn, target, type: 'import' });
        }
      }

      for (const cls of mod.classes) {
        const classFqn = `${mod.moduleFqn}#${cls.name}`;

        if (cls.extends !== null) {
          const resolvedExtends = this.resolveClassReference(cls.extends, mod);

          if (resolvedExtends !== cls.extends) {
            relationships.push({ kind: 'extends', from: classFqn, to: resolvedExtends });
          }
        }

        for (const implemented of cls.implements) {
          const resolvedImplements = this.resolveInterfaceReference(implemented, mod);

          if (resolvedImplements !== implemented) {
            relationships.push({ kind: 'implements', from: classFqn, to: resolvedImplements });
          }
        }
      }
    }

    return {
      name: projectName,
      rootPath,
      language,
      packages: this.toPackageProps(modules, modulePathToFqn),
      dependencies,
      relationships,
    };
  }

  private toPackageProps(
    modules: PendingModule[],
    modulePathToFqn: Map<string, string>,
  ): IrPackageProps[] {
    if (modules.length === 0) {
      return [];
    }

    return [
      {
        name: DEFAULT_PACKAGE,
        modules: modules.map((mod) => this.toModuleProps(mod, modulePathToFqn)),
      },
    ];
  }

  private toModuleProps(mod: PendingModule, modulePathToFqn: Map<string, string>): IrModuleProps {
    const imports = this.resolveModuleImports(mod, modulePathToFqn);

    return {
      name: mod.moduleName,
      path: mod.filePath,
      classes: mod.classes.map((cls) => this.toClassProps(cls, mod)),
      interfaces: mod.interfaces.map((iface) => ({
        name: iface.name,
        isExported: iface.isExported,
      })),
      functions: mod.functions.map((fn) => ({
        name: fn.name,
        isAsync: fn.isAsync,
        isExported: fn.isExported,
      })),
      imports,
    };
  }

  /**
   * Resolve import specifiers to FQNs (REQ-CA-002): external packages stay as
   * bare names, relative imports resolve to their module FQN when the target
   * module was parsed. Deduplicated, declaration order preserved.
   */
  private resolveModuleImports(mod: PendingModule, modulePathToFqn: Map<string, string>): string[] {
    const resolved: string[] = [];

    for (const specifier of mod.imports) {
      const target = this.resolveImportTarget(specifier, mod.filePath, modulePathToFqn);

      if (!resolved.includes(target)) {
        resolved.push(target);
      }
    }

    return resolved;
  }

  private toClassProps(cls: PendingClass, mod: PendingModule): IrClassProps {
    return {
      name: cls.name,
      isAbstract: cls.isAbstract,
      isExported: cls.isExported,
      role: cls.role ?? undefined,
      extends: cls.extends !== null ? this.resolveClassReference(cls.extends, mod) : undefined,
      implements: cls.implements.map((name) => this.resolveInterfaceReference(name, mod)),
      methods: cls.methods.map((method) => ({ ...method })),
      endpoints: cls.endpoints.map((endpoint) => ({ ...endpoint })),
      decorators: cls.decorators,
      constructorParams: cls.constructorParams.map((param) => ({ ...param })),
    };
  }

  private resolveImportTarget(
    specifier: string,
    sourceFilePath: string,
    modulePathToFqn: Map<string, string>,
  ): string {
    if (!specifier.startsWith('.')) {
      return specifier;
    }

    const sourceDir = posix.dirname(sourceFilePath);
    const resolved = posix.normalize(posix.join(sourceDir, specifier));
    const target = modulePathToFqn.get(this.normalizeModulePath(resolved));

    return target ?? specifier;
  }

  private resolveClassReference(name: string, mod: PendingModule): string {
    const resolved = `${mod.moduleFqn}#${name}`;

    return mod.classes.some((cls) => cls.name === name) ? resolved : name;
  }

  private resolveInterfaceReference(name: string, mod: PendingModule): string {
    const resolved = `${mod.moduleFqn}#${name}`;

    return mod.interfaces.some((iface) => iface.name === name) ? resolved : name;
  }

  private resolveLanguage(parseResults: ParseResult[]): Language {
    const firstSuccess = parseResults.find((result) => result.isSuccess);

    return firstSuccess?.language ?? Language.create('typescript', '.ts');
  }

  private toModuleName(filePath: string, rootPath: string): string {
    const relative = filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length).replace(/^\/+/, '')
      : filePath;

    return this.normalizeModulePath(relative);
  }

  private normalizeModulePath(filePath: string): string {
    return filePath.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '');
  }
}
