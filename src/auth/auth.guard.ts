import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * AuthGuard
 *
 * NestJS Guard that validates the Authorization header before allowing route access.
 * Throws UnauthorizedException if the token is missing or invalid.
 *
 * Usage:
 *   @UseGuards(AuthGuard)
 *   @Post('protected-route')
 *   async protectedRoute(@Request() req) {
 *     // req.user contains the verified Supabase user data
 *   }
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    try {
      const token = authHeader.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('Invalid authorization format');
      }

      // Validate token with Supabase
      const userData = await this.authService.verifySupabaseToken(token);

      // Attach user data to request
      request.user = userData;

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid or expired access token: ' + (error as Error).message,
      );
    }
  }
}
