import { Controller, Get, Post, Body, Headers, UnauthorizedException, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExpertService } from './expert.service';
import { AuthService } from '../auth/auth.service';

@Controller('expert')
export class ExpertController {
  constructor(
    private readonly expertService: ExpertService,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  async login(
    @Body() body: { idToken?: string; refreshToken?: string; email?: string; password?: string },
    @Headers('authorization') authHeader?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (body.email && body.password) {
      const loginResult = await this.authService.loginWithPassword(body.email, body.password);
      if (loginResult.refreshToken && res) {
        res.cookie('refreshToken', loginResult.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      return {
        success: true,
        expert: loginResult.data,
        token: loginResult.accessToken || loginResult.token,
      };
    }

    const token = body.idToken || authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token or credentials provided');
    }

    const loginResult = await this.authService.login(token, 'professional');
    if (!loginResult.success) {
      throw new UnauthorizedException(loginResult.message);
    }

    if (body.refreshToken && res) {
      res.cookie('refreshToken', body.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      success: true,
      expert: loginResult.data,
      token: loginResult.token,
    };
  }

  private async getUserIdFromHeader(authHeader: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    return userData.id;
  }

  @Get('profile')
  async getProfile(@Headers('authorization') authHeader: string) {
    const userId = await this.getUserIdFromHeader(authHeader);
    return this.expertService.getProfile(userId);
  }

  @Get('dashboard')
  async getDashboard(@Headers('authorization') authHeader: string) {
    const userId = await this.getUserIdFromHeader(authHeader);
    return this.expertService.getDashboard(userId);
  }

  @Get('consultations')
  async getConsultations(@Headers('authorization') authHeader: string) {
    const userId = await this.getUserIdFromHeader(authHeader);
    return this.expertService.getConsultations(userId);
  }

  @Get('cases')
  async getCases(@Headers('authorization') authHeader: string) {
    const userId = await this.getUserIdFromHeader(authHeader);
    return this.expertService.getConsultations(userId);
  }
}
