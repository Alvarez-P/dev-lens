import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../../application/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../../../../shared/infrastructure/decorators/public.decorator';
import { CurrentUser } from '../../../../shared/infrastructure/decorators/current-user.decorator';
import {
  AuthResponseDto,
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  UserProfileResponseDto as AuthUserProfileDto,
} from '../../application/dto/auth.dto';
import { ApiResponse as ApiResponseType } from '../../../../shared/types/common.types';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: RegisterDto): Promise<ApiResponseType<AuthResponseDto>> {
    const result = await this.authService.register(dto);
    return { success: true, data: result };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<ApiResponseType<AuthResponseDto>> {
    const result = await this.authService.login(dto);
    return { success: true, data: result };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<ApiResponseType<AuthResponseDto>> {
    const result = await this.authService.refreshToken(dto);
    return { success: true, data: result };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.authService.logout(user.userId);
    return { success: true, data: { message: 'Logged out successfully' } };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Password reset email sent if account exists' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset link has been sent.',
      },
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ApiResponseType<{ message: string }>> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true, data: { message: 'Password reset successfully' } };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<ApiResponseType<{ message: string }>> {
    await this.authService.verifyEmail(dto.token);
    return { success: true, data: { message: 'Email verified successfully' } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: AuthUserProfileDto })
  async getMe(
    @CurrentUser() user: { userId: string },
  ): Promise<ApiResponseType<AuthUserProfileDto>> {
    const result = await this.authService.getMe(user.userId);
    return { success: true, data: result };
  }
}
