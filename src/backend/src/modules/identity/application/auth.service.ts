import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../../../config/config.service';
import { PasswordService } from '../infrastructure/auth/password.service';

import { User } from '../domain/user.entity';
import { Email } from '../domain/email.vo';
import { UserId } from '../domain/user-id.vo';
import { UserRepository } from '../infrastructure/persistence/repositories/user.repository';
import { DomainEventDispatcher } from '../../../shared/domain/domain-event-dispatcher';

import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  AuthResponseDto,
  UserProfileResponseDto,
} from './dto/auth.dto';

import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  InvalidTokenError,
  UserNotFoundError,
} from '../domain/identity-errors';

interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn = 900;
  private readonly refreshTokenExpiresIn = 604800;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('DOMAIN_EVENT_DISPATCHER')
    private readonly eventDispatcher: DomainEventDispatcher,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = Email.create(dto.email);
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new UserAlreadyExistsError(dto.email);
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = User.create(email, passwordHash, dto.firstName, dto.lastName);
    await this.userRepository.save(user);

    await this.eventDispatcher.dispatchBatch(user.domainEvents);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = Email.create(dto.email);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    user.recordLogin();
    await this.userRepository.save(user);
    await this.eventDispatcher.dispatchBatch(user.domainEvents);

    return this.buildAuthResponse(user);
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(dto.refreshToken, {
        secret: this.configService.auth.jwtSecret,
      });
    } catch {
      throw new InvalidTokenError();
    }

    if (payload.type !== 'refresh') {
      throw new InvalidTokenError();
    }

    const user = await this.userRepository.findById(UserId.from(payload.sub));
    if (!user) {
      throw new InvalidTokenError();
    }

    if (!user.refreshTokenHash) {
      throw new InvalidTokenError();
    }

    const storedHashValid = await this.passwordService.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );
    if (!storedHashValid) {
      throw new InvalidTokenError();
    }

    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<void> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.clearRefreshToken();
    await this.userRepository.save(user);
  }

  async verifyEmail(token: string): Promise<void> {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(token, {
        secret: this.configService.auth.jwtSecret,
      });
    } catch {
      throw new InvalidTokenError();
    }

    if (payload.type !== 'email-verify') {
      throw new InvalidTokenError();
    }

    const user = await this.userRepository.findById(UserId.from(payload.sub));
    if (!user) {
      throw new UserNotFoundError(payload.sub);
    }

    user.verifyEmail();
    await this.userRepository.save(user);
    await this.eventDispatcher.dispatchBatch(user.domainEvents);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const emailVo = Email.create(email);
    const user = await this.userRepository.findByEmail(emailVo);
    if (!user) {
      return;
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id.toString(), type: 'password-reset' },
      {
        secret: this.configService.auth.jwtSecret,
        expiresIn: '1h',
      },
    );

    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwtService.verify<{ sub: string; type: string }>(token, {
        secret: this.configService.auth.jwtSecret,
      });
    } catch {
      throw new InvalidTokenError();
    }

    if (payload.type !== 'password-reset') {
      throw new InvalidTokenError();
    }

    const user = await this.userRepository.findById(UserId.from(payload.sub));
    if (!user) {
      throw new InvalidTokenError();
    }

    const newHash = await this.passwordService.hash(newPassword);
    user.updatePassword(newHash);
    await this.userRepository.save(user);
  }

  async getMe(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(UserId.from(userId));
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return this.toProfileResponse(user);
  }

  async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const accessToken = this.jwtService.sign(
      {
        sub: user.id.toString(),
        email: user.email.toString(),
        type: 'access',
      } satisfies TokenPayload,
      {
        secret: this.configService.auth.jwtSecret,
        expiresIn: this.accessTokenExpiresIn,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id.toString(),
        email: user.email.toString(),
        type: 'refresh',
      } satisfies TokenPayload,
      {
        secret: this.configService.auth.jwtSecret,
        expiresIn: this.refreshTokenExpiresIn,
      },
    );

    const refreshTokenHash = await this.passwordService.hash(refreshToken);
    user.setRefreshToken(refreshTokenHash);
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user: this.toProfileResponse(user),
    };
  }

  private toProfileResponse(user: User): UserProfileResponseDto {
    return {
      id: user.id.toString(),
      email: user.email.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
