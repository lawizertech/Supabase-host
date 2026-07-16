import { Controller, Post, Get, Body, Query, Headers, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
  async getProfile(
    @Headers('authorization') authHeader: string,
    @Query('uid') uid: string,
  ) {
    if (!uid) {
      throw new BadRequestException('UID parameter is required');
    }
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);

    if (userData.id !== uid) {
      const callerProfile = await this.authService.getProfile(userData.id);
      if (!callerProfile.success || callerProfile.data.role !== 'admin') {
        throw new ForbiddenException('You do not have permission to view this profile');
      }
    }

    return this.authService.getProfile(uid);
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
