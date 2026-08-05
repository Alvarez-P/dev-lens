import { ValueObject } from '../../../shared/domain/value-object';
import { Language } from './language.vo';

export interface IrProjectProps {
  name: string;
  rootPath: string;
  language: Language;
  packages: IrPackageProps[];
  dependencies?: IrDependencyProps[];
  relationships?: IrRelationshipProps[];
}

export interface IrPackageProps {
  name: string;
  version?: string;
  modules: IrModuleProps[];
}

export interface IrModuleProps {
  name: string;
  path: string;
  classes?: IrClassProps[];
  interfaces?: IrInterfaceProps[];
  functions?: IrFunctionProps[];
}

export interface IrClassProps {
  name: string;
  isAbstract?: boolean;
  isExported?: boolean;
  role?: string;
  extends?: string;
  implements?: string[];
  methods?: IrMethodProps[];
  endpoints?: IrEndpointProps[];
}

export interface IrInterfaceProps {
  name: string;
  isExported?: boolean;
}

export interface IrFunctionProps {
  name: string;
  isAsync?: boolean;
  isExported?: boolean;
}

export interface IrMethodProps {
  name: string;
  visibility: string;
  isStatic?: boolean;
  parameters: string[];
}

export interface IrEndpointProps {
  name: string;
  httpMethod: string;
  path: string;
  parameters: string[];
}

export interface IrDependencyProps {
  source: string;
  target: string;
  type: string;
}

export interface IrRelationshipProps {
  kind: string;
  from: string;
  to: string;
}

export interface IrProjectJson {
  name: string;
  rootPath: string;
  language: { name: string; extension: string };
  packages: IrPackageProps[];
  dependencies?: IrDependencyProps[];
  relationships?: IrRelationshipProps[];
}

export class IrProject extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly rootPath: string,
    public readonly language: Language,
    public readonly packages: readonly IrPackage[],
    public readonly dependencies: readonly IrDependency[],
    public readonly relationships: readonly IrRelationship[],
  ) {
    super();
  }

  get fqn(): string {
    return this.name;
  }

  static create(props: IrProjectProps): IrProject {
    const name = props.name.trim();
    const rootPath = props.rootPath.trim();

    if (!name) {
      throw new Error('Project name must not be empty');
    }

    if (!rootPath) {
      throw new Error('Project root path must not be empty');
    }

    const packages = Object.freeze(props.packages.map((pkg) => IrPackage.create(name, pkg)));
    const dependencies = Object.freeze(
      (props.dependencies ?? []).map((dependency) => IrDependency.create(dependency)),
    );
    const relationships = Object.freeze(
      (props.relationships ?? []).map((relationship) => IrRelationship.create(relationship)),
    );

    return new IrProject(name, rootPath, props.language, packages, dependencies, relationships);
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.name,
      this.rootPath,
      this.language,
      this.packages,
      this.dependencies,
      this.relationships,
    ];
  }

  toJSON(): IrProjectJson {
    return {
      name: this.name,
      rootPath: this.rootPath,
      language: { name: this.language.name, extension: this.language.extension },
      packages: this.packages.map((pkg) => pkg.toJSON()),
      dependencies: this.dependencies.map((dependency) => dependency.toJSON()),
      relationships: this.relationships.map((relationship) => relationship.toJSON()),
    };
  }
}

export class IrPackage extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly version: string | null,
    public readonly modules: readonly IrModule[],
    public readonly fqn: string,
  ) {
    super();
  }

  static create(projectFqn: string, props: IrPackageProps): IrPackage {
    const name = props.name.trim();

    if (!name) {
      throw new Error('Package name must not be empty');
    }

    const fqn = `${projectFqn}:${name}`;
    const modules = Object.freeze(props.modules.map((module) => IrModule.create(fqn, module)));

    return new IrPackage(name, props.version?.trim() || null, modules, fqn);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.version, this.modules, this.fqn];
  }

  toJSON(): IrPackageProps {
    return {
      name: this.name,
      version: this.version ?? undefined,
      modules: this.modules.map((module) => module.toJSON()),
    };
  }
}

export class IrModule extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly path: string,
    public readonly classes: readonly IrClass[],
    public readonly interfaces: readonly IrInterface[],
    public readonly functions: readonly IrFunction[],
    public readonly fqn: string,
  ) {
    super();
  }

  static create(packageFqn: string, props: IrModuleProps): IrModule {
    const name = props.name.trim();
    const path = props.path.trim();

    if (!name) {
      throw new Error('Module name must not be empty');
    }

    if (!path) {
      throw new Error(`Module "${name}" path must not be empty`);
    }

    const fqn = `${packageFqn}:${name}`;
    const classes = Object.freeze(props.classes?.map((cls) => IrClass.create(fqn, cls)) ?? []);
    const interfaces = Object.freeze(
      props.interfaces?.map((iface) => IrInterface.create(fqn, iface)) ?? [],
    );
    const functions = Object.freeze(props.functions?.map((fn) => IrFunction.create(fqn, fn)) ?? []);

    return new IrModule(name, path, classes, interfaces, functions, fqn);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.path, this.classes, this.interfaces, this.functions, this.fqn];
  }

  toJSON(): IrModuleProps {
    return {
      name: this.name,
      path: this.path,
      classes: this.classes.map((cls) => cls.toJSON()),
      interfaces: this.interfaces.map((iface) => iface.toJSON()),
      functions: this.functions.map((fn) => fn.toJSON()),
    };
  }
}

export class IrClass extends ValueObject {
  public readonly name: string;
  public readonly isAbstract: boolean;
  public readonly isExported: boolean;
  public readonly role: string | null;
  public readonly extends: string | null;
  public readonly implements: readonly string[];
  public readonly methods: readonly IrMethod[];
  public readonly endpoints: readonly IrEndpoint[];
  public readonly fqn: string;

  private constructor(
    name: string,
    isAbstract: boolean,
    isExported: boolean,
    role: string | null,
    extendsClass: string | null,
    implementsInterfaces: readonly string[],
    methods: readonly IrMethod[],
    endpoints: readonly IrEndpoint[],
    fqn: string,
  ) {
    super();
    this.name = name;
    this.isAbstract = isAbstract;
    this.isExported = isExported;
    this.role = role;
    this.extends = extendsClass;
    this.implements = implementsInterfaces;
    this.methods = methods;
    this.endpoints = endpoints;
    this.fqn = fqn;
  }

  static create(moduleFqn: string, props: IrClassProps): IrClass {
    const name = props.name.trim();

    if (!name) {
      throw new Error('Class name must not be empty');
    }

    const fqn = `${moduleFqn}#${name}`;
    const methods = Object.freeze(
      props.methods?.map((method) => IrMethod.create(fqn, method)) ?? [],
    );
    const endpoints = Object.freeze(
      props.endpoints?.map((endpoint) => IrEndpoint.create(fqn, endpoint)) ?? [],
    );
    const implemented = Object.freeze([...(props.implements ?? [])].map((value) => value.trim()));

    return new IrClass(
      name,
      props.isAbstract ?? false,
      props.isExported ?? false,
      props.role?.trim() || null,
      props.extends?.trim() || null,
      implemented,
      methods,
      endpoints,
      fqn,
    );
  }

  protected getEqualityComponents(): unknown[] {
    return [
      this.name,
      this.isAbstract,
      this.isExported,
      this.role,
      this.extends,
      this.implements,
      this.methods,
      this.endpoints,
      this.fqn,
    ];
  }

  toJSON(): IrClassProps {
    return {
      name: this.name,
      isAbstract: this.isAbstract,
      isExported: this.isExported,
      role: this.role ?? undefined,
      extends: this.extends ?? undefined,
      implements: [...this.implements],
      methods: this.methods.map((method) => method.toJSON()),
      endpoints: this.endpoints.map((endpoint) => endpoint.toJSON()),
    };
  }
}

export class IrInterface extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly isExported: boolean,
    public readonly fqn: string,
  ) {
    super();
  }

  static create(moduleFqn: string, props: IrInterfaceProps): IrInterface {
    const name = props.name.trim();

    if (!name) {
      throw new Error('Interface name must not be empty');
    }

    return new IrInterface(name, props.isExported ?? false, `${moduleFqn}#${name}`);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.isExported, this.fqn];
  }

  toJSON(): IrInterfaceProps {
    return {
      name: this.name,
      isExported: this.isExported,
    };
  }
}

export class IrFunction extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly isAsync: boolean,
    public readonly isExported: boolean,
    public readonly fqn: string,
  ) {
    super();
  }

  static create(moduleFqn: string, props: IrFunctionProps): IrFunction {
    const name = props.name.trim();

    if (!name) {
      throw new Error('Function name must not be empty');
    }

    return new IrFunction(
      name,
      props.isAsync ?? false,
      props.isExported ?? false,
      `${moduleFqn}#${name}`,
    );
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.isAsync, this.isExported, this.fqn];
  }

  toJSON(): IrFunctionProps {
    return {
      name: this.name,
      isAsync: this.isAsync,
      isExported: this.isExported,
    };
  }
}

export class IrMethod extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly visibility: string,
    public readonly isStatic: boolean,
    public readonly parameters: readonly string[],
    public readonly fqn: string,
  ) {
    super();
  }

  static create(classFqn: string, props: IrMethodProps): IrMethod {
    const name = props.name.trim();
    const visibility = props.visibility.trim();

    if (!name) {
      throw new Error('Method name must not be empty');
    }

    if (!visibility) {
      throw new Error(`Method "${name}" visibility must not be empty`);
    }

    const parameters = Object.freeze(props.parameters.map((parameter) => parameter.trim()));

    return new IrMethod(
      name,
      visibility,
      props.isStatic ?? false,
      parameters,
      `${classFqn}.${name}`,
    );
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.visibility, this.isStatic, this.parameters, this.fqn];
  }

  toJSON(): IrMethodProps {
    return {
      name: this.name,
      visibility: this.visibility,
      isStatic: this.isStatic,
      parameters: [...this.parameters],
    };
  }
}

export class IrEndpoint extends ValueObject {
  private constructor(
    public readonly name: string,
    public readonly httpMethod: string,
    public readonly path: string,
    public readonly parameters: readonly string[],
    public readonly fqn: string,
  ) {
    super();
  }

  static create(classFqn: string, props: IrEndpointProps): IrEndpoint {
    const name = props.name.trim();
    const httpMethod = props.httpMethod.trim().toUpperCase();
    const path = props.path.trim();

    if (!name) {
      throw new Error('Endpoint name must not be empty');
    }

    if (!httpMethod) {
      throw new Error('Endpoint httpMethod must not be empty');
    }

    if (!path) {
      throw new Error('Endpoint path must not be empty');
    }

    const parameters = Object.freeze(props.parameters.map((parameter) => parameter.trim()));

    return new IrEndpoint(name, httpMethod, path, parameters, `${classFqn}.${httpMethod}:${path}`);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.name, this.httpMethod, this.path, this.parameters, this.fqn];
  }

  toJSON(): IrEndpointProps {
    return {
      name: this.name,
      httpMethod: this.httpMethod,
      path: this.path,
      parameters: [...this.parameters],
    };
  }
}

export class IrDependency extends ValueObject {
  private constructor(
    public readonly source: string,
    public readonly target: string,
    public readonly type: string,
    public readonly fqn: string,
  ) {
    super();
  }

  static create(props: IrDependencyProps): IrDependency {
    const source = props.source.trim();
    const target = props.target.trim();
    const type = props.type.trim();

    if (!source) {
      throw new Error('Dependency source must not be empty');
    }

    if (!target) {
      throw new Error('Dependency target must not be empty');
    }

    if (!type) {
      throw new Error('Dependency type must not be empty');
    }

    return new IrDependency(source, target, type, `${source}->${target}`);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.source, this.target, this.type, this.fqn];
  }

  toJSON(): IrDependencyProps {
    return {
      source: this.source,
      target: this.target,
      type: this.type,
    };
  }
}

export class IrRelationship extends ValueObject {
  private constructor(
    public readonly kind: string,
    public readonly from: string,
    public readonly to: string,
    public readonly fqn: string,
  ) {
    super();
  }

  static create(props: IrRelationshipProps): IrRelationship {
    const kind = props.kind.trim();
    const from = props.from.trim();
    const to = props.to.trim();

    if (!kind) {
      throw new Error('Relationship kind must not be empty');
    }

    if (!from) {
      throw new Error('Relationship from must not be empty');
    }

    if (!to) {
      throw new Error('Relationship to must not be empty');
    }

    return new IrRelationship(kind, from, to, `${from}->${to}:${kind}`);
  }

  protected getEqualityComponents(): unknown[] {
    return [this.kind, this.from, this.to, this.fqn];
  }

  toJSON(): IrRelationshipProps {
    return {
      kind: this.kind,
      from: this.from,
      to: this.to,
    };
  }
}
