import { Controller, Post, Get, Body, Query, Headers, Req, UnauthorizedException, BadRequestException, ForbiddenException, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Headers('authorization') authHeader: string,
    @Body() body: { uid: string; name: string; email: string; phoneNumber: string },
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    
    if (userData.id !== body.uid) {
      throw new ForbiddenException('You cannot register a profile for another user');
    }

    return this.authService.signUp(body.uid, body.name, body.email, body.phoneNumber);
  }

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
      return loginResult;
    }

    const token = body.idToken || authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token or credentials provided');
    }

    const loginResult = await this.authService.login(token);

    if (!loginResult.success) {
      throw new UnauthorizedException(loginResult.message);
    }

    // If a refresh token is provided, set it as an HttpOnly cookie
    if (body.refreshToken && res) {
      res.cookie('refreshToken', body.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    return loginResult;
  }

  @Get('profile')
  async getProfile(
    @Headers('authorization') authHeader: string,
    @Query('uid') uid?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);

    const targetUid = uid || userData.id;

    if (userData.id !== targetUid) {
      const callerProfile = await this.authService.getProfile(userData.id);
      if (!callerProfile.success || callerProfile.data.role !== 'admin') {
        throw new ForbiddenException('You do not have permission to view this profile');
      }
    }

    return this.authService.getProfile(targetUid);
  }

  @Post('complete-profile')
  async completeProfile(
    @Headers('authorization') authHeader: string,
    @Body() body: { uid: string; displayName: string; phoneNumber: string; city?: string; state?: string; photoURL?: string; hasPassword?: boolean },
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);

    if (userData.id !== body.uid) {
      throw new ForbiddenException('You cannot update another user\'s profile');
    }

    return this.authService.completeProfile(
      body.uid,
      body.displayName,
      body.phoneNumber,
      body.city,
      body.state,
      body.photoURL,
      body.hasPassword,
    );
  }

  /**
   * POST /auth/refresh
   * 
   * The frontend calls this when its access token expires.
   * This endpoint reads the refresh token from the HttpOnly cookie,
   * exchanges it with Supabase for a new access token,
   * and returns the new access token to the frontend.
   */
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // cookie-parser middleware makes parsed cookies available on req.cookies
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from cookie');
    }

    try {
      const result = await this.authService.refreshAccessToken(refreshToken);

      // If Supabase rotated the refresh token, update the cookie
      if (result.refreshToken && res) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      return {
        success: true,
        accessToken: result.accessToken,
      };
    } catch (error) {
      throw new UnauthorizedException((error as Error).message);
    }
  }

  /**
   * GET /auth/me
   * 
   * Returns the authoritative user session data.
   * The frontend calls this on app load to restore the session.
   * Validates the access token with Supabase.
   */
  @Get('me')
  async me(
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('No authorization token provided');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      return await this.authService.getSession(token);
    } catch (error) {
      throw new UnauthorizedException((error as Error).message);
    }
  }

  /**
   * POST /auth/logout
   * 
   * Clears the HttpOnly refresh token cookie on the backend.
   * The frontend also clears its in-memory access token.
   */
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Clear the refresh token cookie
    if (res) {
      res.cookie('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0, // Immediate expiry
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * GET /auth/renew-token (Legacy endpoint)
   * Kept for backward compatibility, but clients should use /auth/refresh instead
   */
  @Get('renew-token')
  async renewToken(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    // For Supabase, the client refreshes tokens itself, but we can verify it
    const userData = await this.authService.verifySupabaseToken(token);
    return { success: true, newToken: token, user: userData };
  }
}
