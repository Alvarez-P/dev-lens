import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../../../../config/config.service';

interface JwtPayload {
  sub: string;
  email: string;
  type: string;
}

/**
 * Passport JWT strategy.
 * Extracts and validates JWT tokens from the Authorization header.
 * Returns the user payload on success which is attached to the request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.auth.jwtSecret,
    });
  }

  /**
   * Called by Passport after the token is verified.
   * The returned value is attached to request.user.
   * Only access tokens are allowed through this strategy.
   */
  async validate(payload: JwtPayload): Promise<{ userId: string; email: string }> {
    // Only validate access tokens — refresh tokens must use the refresh endpoint
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
