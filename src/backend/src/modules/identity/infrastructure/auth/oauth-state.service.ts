import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const STATE_TTL_SECONDS = 300; // 5 minutes

interface OAuthStatePayload {
  state: string;
}

@Injectable()
export class OAuthStateService {
  constructor(private readonly jwtService: JwtService) {}

  sign(state: string): string {
    return this.jwtService.sign({ state } satisfies OAuthStatePayload, {
      expiresIn: STATE_TTL_SECONDS,
    });
  }

  verify(token: string): string {
    const payload = this.jwtService.verify<OAuthStatePayload>(token);
    return payload.state;
  }
}
