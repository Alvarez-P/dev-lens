import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RepositoryRepository } from '../../repositories/infrastructure/persistence/repositories/repository.repository';
import { RepositoryId } from '../../repositories/domain/repository-id.vo';
import { MemberRepository } from '../../identity/infrastructure/persistence/repositories/member.repository';

interface AuthenticatedRequest {
  params: { repoId?: string };
  user?: { userId?: string };
}

@Injectable()
export class RepoMembershipGuard implements CanActivate {
  constructor(
    private readonly repositoryRepository: RepositoryRepository,
    private readonly memberRepository: MemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const repoId = request.params?.repoId;

    if (!repoId) {
      throw new ForbiddenException('Repository identifier is required');
    }

    const repository = await this.repositoryRepository.findById(RepositoryId.from(repoId));

    if (repository === null) {
      throw new ForbiddenException(`Access denied to repository "${repoId}"`);
    }

    if (repository.ownerId === userId) {
      return true;
    }

    if (
      repository.organizationId !== null &&
      (await this.isMember(userId, 'organization', repository.organizationId))
    ) {
      return true;
    }

    if (
      repository.workspaceId !== null &&
      (await this.isMember(userId, 'workspace', repository.workspaceId))
    ) {
      return true;
    }

    throw new ForbiddenException(`Access denied to repository "${repoId}"`);
  }

  private async isMember(userId: string, entityType: string, entityId: string): Promise<boolean> {
    const members = await this.memberRepository.findByEntity(entityType, entityId);

    return members.some((member) => member.userId === userId);
  }
}
