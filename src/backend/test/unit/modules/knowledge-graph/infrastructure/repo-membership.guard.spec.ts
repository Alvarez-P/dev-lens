import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RepoMembershipGuard } from '@/modules/knowledge-graph/guards/repo-membership.guard';
import { Repository, RepositoryUrl } from '@/modules/repositories/domain';
import { GitProvider } from '@/modules/repositories/domain/git-provider.enum';
import { MemberTypeOrmEntity } from '@/modules/identity/infrastructure/persistence/typeorm/member.typeorm-entity';

function makeRepository(overrides: {
  ownerId?: string;
  organizationId?: string | null;
  workspaceId?: string | null;
}): Repository {
  return Repository.create(
    'my-repo',
    RepositoryUrl.create('https://github.com/acme/my-repo.git'),
    GitProvider.GITHUB,
    overrides.ownerId ?? 'owner-1',
    'main',
    overrides.workspaceId ?? null,
    overrides.organizationId ?? null,
  );
}

function member(userId: string): MemberTypeOrmEntity {
  const entity = new MemberTypeOrmEntity();
  entity.userId = userId;
  return entity;
}

function buildHarness() {
  const repositoryRepository = { findById: jest.fn() };
  const memberRepository = { findByEntity: jest.fn() };

  const guard = new RepoMembershipGuard(repositoryRepository as never, memberRepository as never);

  return { guard, repositoryRepository, memberRepository };
}

function mockContext(user: { userId?: string } | undefined, repoId = 'repo-1'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ params: { repoId }, user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RepoMembershipGuard', () => {
  it('allows the repository owner', async () => {
    const { guard, repositoryRepository, memberRepository } = buildHarness();
    repositoryRepository.findById.mockResolvedValue(makeRepository({ ownerId: 'owner-1' }));

    await expect(guard.canActivate(mockContext({ userId: 'owner-1' }))).resolves.toBe(true);

    expect(memberRepository.findByEntity).not.toHaveBeenCalled();
  });

  it('allows a member of the organization that owns the repository', async () => {
    const { guard, repositoryRepository, memberRepository } = buildHarness();
    repositoryRepository.findById.mockResolvedValue(
      makeRepository({ ownerId: 'owner-1', organizationId: 'org-1' }),
    );
    memberRepository.findByEntity.mockResolvedValue([member('user-1'), member('user-2')]);

    await expect(guard.canActivate(mockContext({ userId: 'user-2' }))).resolves.toBe(true);

    expect(memberRepository.findByEntity).toHaveBeenCalledWith('organization', 'org-1');
  });

  it('allows a member of the workspace that owns the repository', async () => {
    const { guard, repositoryRepository, memberRepository } = buildHarness();
    repositoryRepository.findById.mockResolvedValue(
      makeRepository({ ownerId: 'owner-1', workspaceId: 'ws-1' }),
    );
    memberRepository.findByEntity.mockResolvedValue([member('user-1')]);

    await expect(guard.canActivate(mockContext({ userId: 'user-1' }))).resolves.toBe(true);

    expect(memberRepository.findByEntity).toHaveBeenCalledWith('workspace', 'ws-1');
  });

  it('rejects a user who is not a member with ForbiddenException', async () => {
    const { guard, repositoryRepository } = buildHarness();
    repositoryRepository.findById.mockResolvedValue(makeRepository({ ownerId: 'owner-1' }));

    await expect(guard.canActivate(mockContext({ userId: 'stranger' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a request with no authenticated user with UnauthorizedException', async () => {
    const { guard, repositoryRepository } = buildHarness();

    await expect(guard.canActivate(mockContext(undefined))).rejects.toThrow(UnauthorizedException);

    expect(repositoryRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects access when the repository does not exist', async () => {
    const { guard, repositoryRepository } = buildHarness();
    repositoryRepository.findById.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext({ userId: 'owner-1' }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
