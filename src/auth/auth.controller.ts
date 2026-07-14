import { Controller, Post, Get, Body, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() body: { uid: string; name: string; email: string; phoneNumber: string },
  ) {
    return this.authService.signUp(body.uid, body.name, body.email, body.phoneNumber);
  }

  @Post('login')
  async login(
    @Body() body: { idToken: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const token = body.idToken || authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return this.authService.login(token);
  }

  @Get('profile')
  async getProfile(@Query('uid') uid: string) {
    if (!uid) {
      throw new UnauthorizedException('UID parameter is required');
    }
    return this.authService.getProfile(uid);
  }

  @Post('complete-profile')
  async completeProfile(
    @Body() body: { uid: string; displayName: string; phoneNumber: string; city?: string; state?: string; photoURL?: string; hasPassword?: boolean },
  ) {
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
