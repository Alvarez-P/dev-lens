import { Controller, Get, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { OAuthService } from '../../application/oauth.service';
import { OAuthStateService } from '../auth/oauth-state.service';
import { ProviderRegistry } from '../auth/provider-registry';
import { ConfigService } from '../../../../config/config.service';
import { Public } from '../../../../shared/infrastructure/decorators/public.decorator';
import { InvalidOAuthState, UserNotFoundError } from '../../domain/identity-errors';

@ApiTags('Auth - OAuth')
@Controller({ path: 'auth/oauth', version: '1' })
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly oauthStateService: OAuthStateService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly configService: ConfigService,
  ) {}

  @Get(':provider')
  @Public()
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Redirect to OAuth provider authorization page' })
  @ApiResponse({ status: 302, description: 'Redirect to provider' })
  @ApiResponse({ status: 400, description: 'Unknown provider' })
  async redirectToProvider(
    @Param('provider') provider: string,
    @Res() res: Response,
  ): Promise<void> {
    const state = randomUUID();
    const signedState = this.oauthStateService.sign(state);

    let adapter;
    try {
      adapter = this.providerRegistry.resolve(provider);
    } catch {
      throw new InvalidOAuthState();
    }
    const redirectUri = this.buildRedirectUri(provider);
    const authorizationUrl = adapter.getAuthorizationUrl(signedState, redirectUri);

    res.redirect(authorizationUrl);
  }

  @Get(':provider/callback')
  @Public()
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Handle OAuth callback and exchange code for JWT' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with JWT' })
  @ApiResponse({ status: 400, description: 'Invalid state or code' })
  async handleCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code) {
      throw new InvalidOAuthState();
    }

    let adapter;
    try {
      adapter = this.providerRegistry.resolve(provider);
    } catch {
      throw new InvalidOAuthState();
    }

    // Validate the CSRF state parameter (signed JWT)
    try {
      this.oauthStateService.verify(state);
    } catch {
      throw new InvalidOAuthState();
    }

    const redirectUri = this.buildRedirectUri(provider);
    const result = await this.oauthService.authenticateWithProvider(provider, code, redirectUri);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectTarget = `${frontendUrl}/?oauth=success&accessToken=${encodeURIComponent(result.accessToken)}&refreshToken=${encodeURIComponent(result.refreshToken)}`;

    res.redirect(redirectTarget);
  }

  private buildRedirectUri(provider: string): string {
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '3001'}`;
    return `${baseUrl}/api/v1/auth/oauth/${provider}/callback`;
  }
}
