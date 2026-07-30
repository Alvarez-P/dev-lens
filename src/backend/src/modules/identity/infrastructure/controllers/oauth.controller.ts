import { Controller, Get, Post, Param, Query, Body, Res, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { OAuthService } from '../../application/oauth.service';
import { OAuthStateService } from '../auth/oauth-state.service';
import { ProviderRegistry } from '../auth/provider-registry';
import { TokenEncryptionService } from '../encryption/token-encryption.service';
import { ConfigService } from '../../../../config/config.service';
import { Public } from '../../../../shared/infrastructure/decorators/public.decorator';
import {
  InvalidOAuthState,
  UnknownOAuthProvider,
  MissingOAuthCode,
} from '../../domain/identity-errors';
import {
  OAUTH_ROUTES,
  OAUTH_BASE_PATH,
  HTTP_STATUS,
  ENV_KEYS,
  DEFAULT_FRONTEND_URL,
  DEFAULT_PORT,
} from '../../constants';

interface TokenExchangeResponse {
  accessToken: string;
  refreshToken: string;
}

@ApiTags('Auth - OAuth')
@Controller({ path: OAUTH_BASE_PATH, version: '1' })
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly oauthStateService: OAuthStateService,
    private readonly providerRegistry: ProviderRegistry,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly configService: ConfigService,
  ) {}

  @Get(OAUTH_ROUTES.REDIRECT)
  @Public()
  @HttpCode(HTTP_STATUS.FOUND)
  @ApiOperation({ summary: 'Redirect to OAuth provider authorization page' })
  @ApiResponse({ status: HTTP_STATUS.FOUND, description: 'Redirect to provider' })
  @ApiResponse({ status: HTTP_STATUS.BAD_REQUEST, description: 'Unknown provider' })
  async redirectToProvider(
    @Param('provider') provider: string,
    @Res() res: Response,
  ): Promise<void> {
    const signedState = this.oauthStateService.sign(randomUUID());

    let adapter;
    try {
      adapter = this.providerRegistry.resolve(provider);
    } catch {
      throw new UnknownOAuthProvider(provider);
    }

    const redirectUri = this.buildRedirectUri(provider);
    const authorizationUrl = adapter.getAuthorizationUrl(signedState, redirectUri);
    res.redirect(authorizationUrl);
  }

  @Get(OAUTH_ROUTES.CALLBACK)
  @Public()
  @HttpCode(HTTP_STATUS.FOUND)
  @ApiOperation({ summary: 'Handle OAuth callback' })
  @ApiResponse({
    status: HTTP_STATUS.FOUND,
    description: 'Redirect to frontend callback with temp code',
  })
  @ApiResponse({ status: HTTP_STATUS.BAD_REQUEST, description: 'Invalid state or code' })
  async handleCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code) {
      throw new MissingOAuthCode();
    }

    try {
      this.oauthStateService.verify(state);
    } catch {
      throw new InvalidOAuthState();
    }

    const redirectUri = this.buildRedirectUri(provider);
    const result = await this.oauthService.authenticateWithProvider(provider, code, redirectUri);

    const payload = JSON.stringify({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    const tempToken = this.tokenEncryption.encrypt(payload);

    const frontendUrl = this.configService.frontendUrl ?? DEFAULT_FRONTEND_URL;
    res.redirect(`${frontendUrl}/auth/callback?code=${encodeURIComponent(tempToken)}`);
  }

  @Post(OAUTH_ROUTES.TOKEN_EXCHANGE)
  @Public()
  @HttpCode(HTTP_STATUS.OK)
  @ApiOperation({ summary: 'Exchange temp token for JWT tokens' })
  @ApiResponse({ status: HTTP_STATUS.OK, description: 'Returns JWT tokens' })
  @ApiResponse({ status: HTTP_STATUS.BAD_REQUEST, description: 'Invalid or expired temp token' })
  async exchangeToken(@Body('code') tempToken: string): Promise<TokenExchangeResponse> {
    if (!tempToken) {
      throw new InvalidOAuthState();
    }

    try {
      const decrypted = this.tokenEncryption.decrypt(tempToken);
      const payload: TokenExchangeResponse = JSON.parse(decrypted);

      if (!payload.accessToken || !payload.refreshToken) {
        throw new InvalidOAuthState();
      }

      return payload;
    } catch {
      throw new InvalidOAuthState();
    }
  }

  private buildRedirectUri(provider: string): string {
    const port = this.configService.port?.toString() ?? DEFAULT_PORT;
    const baseUrl = this.configService.apiBaseUrl ?? `http://localhost:${port}`;
    return `${baseUrl}/api/v1/${OAUTH_BASE_PATH}/${provider}/callback`;
  }
}
