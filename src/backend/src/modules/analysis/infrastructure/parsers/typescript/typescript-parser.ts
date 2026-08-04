import { Project, SourceFile, ClassDeclaration } from 'ts-morph';
import { ParsedFile } from '../../../domain/parsed-file.vo';
import { Diagnostic, DiagnosticSeverity, ParseResult } from '../../../domain/parse-result.vo';
import { LanguageParser } from '../../../domain/interfaces/language-parser.interface';
import { DecoratorRoleRegistry } from '../decorator-role-registry';

interface DecoratorRoleInfo {
  className: string;
  role: string;
  routePrefix?: string;
}

const ROLE_INTERFACES: ReadonlyMap<string, string> = new Map([
  ['CanActivate', 'guard'],
  ['NestInterceptor', 'interceptor'],
  ['PipeTransform', 'pipe'],
]);

export class TypeScriptParser implements LanguageParser {
  private readonly project: Project;

  constructor(private readonly roleRegistry: DecoratorRoleRegistry) {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { skipLibCheck: true, noEmit: true, allowJs: true },
    });
  }

  parse(file: ParsedFile): ParseResult {
    const sourceFile = this.project.createSourceFile(file.path, file.content, { overwrite: true });

    const syntacticDiagnostics = this.project
      .getProgram()
      .compilerObject.getSyntacticDiagnostics(sourceFile.compilerNode);

    if (syntacticDiagnostics.length > 0) {
      const diagnostics = syntacticDiagnostics.map((diagnostic) => {
        const position = sourceFile.compilerNode.getLineAndCharacterOfPosition(diagnostic.start);

        return Diagnostic.create({
          severity: DiagnosticSeverity.Error,
          message: String(diagnostic.messageText),
          line: position.line + 1,
        });
      });

      return ParseResult.failure({
        filePath: file.path,
        language: file.language,
        diagnostics,
      });
    }

    const decoratorRoles = this.classifyDecorators(sourceFile);

    return ParseResult.success({
      filePath: file.path,
      language: file.language,
      ast: sourceFile,
      metadata: { decoratorRoles },
    });
  }

  private classifyDecorators(sourceFile: SourceFile): DecoratorRoleInfo[] {
    const roles: DecoratorRoleInfo[] = [];

    for (const classDeclaration of sourceFile.getClasses()) {
      for (const decorator of classDeclaration.getDecorators()) {
        const name = decorator.getName();
        const baseRole = this.roleRegistry.get(name);

        if (baseRole === null) {
          continue;
        }

        const role = this.resolveRole(baseRole, classDeclaration);
        const info: DecoratorRoleInfo = {
          className: classDeclaration.getName() ?? '<anonymous>',
          role,
        };

        if (role === 'controller') {
          const routePrefix = this.extractRoutePrefix(decorator);

          if (routePrefix !== undefined) {
            info.routePrefix = routePrefix;
          }
        }

        roles.push(info);
      }
    }

    return roles;
  }

  private resolveRole(baseRole: string, classDeclaration: ClassDeclaration): string {
    if (baseRole !== 'service') {
      return baseRole;
    }

    const implementedInterfaces = classDeclaration.getImplements().map((imp) => imp.getText());

    for (const [interfaceName, role] of ROLE_INTERFACES) {
      if (implementedInterfaces.includes(interfaceName)) {
        return role;
      }
    }

    return baseRole;
  }

  private extractRoutePrefix(decorator: {
    getCallExpression(): { getArguments(): { getText(): string }[] } | undefined;
  }): string | undefined {
    const callExpression = decorator.getCallExpression();

    if (callExpression === undefined) {
      return undefined;
    }

    const firstArgument = callExpression.getArguments()[0];

    if (firstArgument === undefined) {
      return undefined;
    }

    return firstArgument.getText().replace(/^['"]|['"]$/g, '');
  }
}
