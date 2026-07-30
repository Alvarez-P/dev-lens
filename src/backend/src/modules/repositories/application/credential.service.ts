import { Injectable, Inject } from '@nestjs/common';
import { Credential, CredentialId, CredentialType, GitProvider } from '../domain';
import {
  CredentialNotFoundError,
  CredentialAccessDeniedError,
  CredentialInvalidError,
} from '../domain/repository-errors';
import { CredentialEncryptionService } from '../infrastructure/encryption/credential-encryption.service';
import { CredentialRepository } from '../infrastructure/persistence/repositories/credential.repository';
import {
  CreateCredentialDto,
  UpdateCredentialDto,
  CredentialResponseDto,
  ValidateCredentialResultDto,
} from './dto/credential.dto';
import { GitProviderInterface } from '../infrastructure/git/provider.interface';
import { GitProviderFactory } from '../infrastructure/git/provider.factory';

@Injectable()
export class CredentialService {
  constructor(
    private readonly credentialRepo: CredentialRepository,
    private readonly encryptionService: CredentialEncryptionService,
    private readonly providerFactory: GitProviderFactory,
  ) {}

  async create(dto: CreateCredentialDto, userId: string): Promise<CredentialResponseDto> {
    const encryptedValue = this.encryptionService.encrypt(dto.value);
    const provider = dto.provider as GitProvider;
    const type = dto.type as CredentialType;

    const credential = Credential.create(
      userId,
      provider,
      dto.name,
      encryptedValue,
      type,
      dto.expiresAt ? new Date(dto.expiresAt) : null,
    );

    await this.credentialRepo.save(credential);

    return this.toResponse(credential);
  }

  async findById(id: string, userId: string): Promise<CredentialResponseDto> {
    const credential = await this.credentialRepo.findById(CredentialId.from(id));
    if (!credential) {
      throw new CredentialNotFoundError(id);
    }
    if (credential.ownerId !== userId) {
      throw new CredentialAccessDeniedError(id);
    }
    return this.toResponse(credential);
  }

  async findByUser(userId: string): Promise<CredentialResponseDto[]> {
    const credentials = await this.credentialRepo.findByOwnerId(userId);
    return credentials.map((c) => this.toResponse(c));
  }

  async update(
    id: string,
    dto: UpdateCredentialDto,
    userId: string,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialRepo.findById(CredentialId.from(id));
    if (!credential) {
      throw new CredentialNotFoundError(id);
    }
    if (credential.ownerId !== userId) {
      throw new CredentialAccessDeniedError(id);
    }

    if (dto.name !== undefined) {
      credential.updateLabel(dto.name);
    }

    await this.credentialRepo.save(credential);
    return this.toResponse(credential);
  }

  async delete(id: string, userId: string): Promise<void> {
    const credential = await this.credentialRepo.findById(CredentialId.from(id));
    if (!credential) {
      throw new CredentialNotFoundError(id);
    }
    if (credential.ownerId !== userId) {
      throw new CredentialAccessDeniedError(id);
    }

    await this.credentialRepo.delete(CredentialId.from(id));
  }

  async validate(id: string, userId: string): Promise<ValidateCredentialResultDto> {
    const credential = await this.credentialRepo.findById(CredentialId.from(id));
    if (!credential) {
      throw new CredentialNotFoundError(id);
    }
    if (credential.ownerId !== userId) {
      throw new CredentialAccessDeniedError(id);
    }

    if (credential.isExpired()) {
      return { valid: false, message: 'Credential has expired' };
    }

    try {
      const decrypted = this.encryptionService.decrypt(credential.encryptedValue);
      const provider = this.providerFactory.getProvider(credential.provider);

      const isValid = await provider.validateCredentials('', decrypted);

      return {
        valid: isValid,
        message: isValid ? 'Credential is valid' : 'Credential is invalid',
      };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  private toResponse(credential: Credential): CredentialResponseDto {
    return {
      id: credential.id.toString(),
      ownerId: credential.ownerId,
      provider: credential.provider,
      name: credential.name,
      type: credential.type,
      createdAt: credential.createdAt.toISOString(),
      expiresAt: credential.expiresAt?.toISOString() ?? null,
    };
  }
}
