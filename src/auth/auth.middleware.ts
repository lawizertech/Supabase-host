import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

/**
 * AuthMiddleware
 *
 * Validates incoming Authorization: Bearer <accessToken> headers
 * Attaches the validated user data to the request object for downstream handlers
 *
 * Usage in module:
 *   - Apply globally via app.use() in main.ts, or
 *   - Apply selectively via MiddlewareConsumer in app.module.ts
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    // If no auth header, let the route handler decide if it's required
    if (!authHeader) {
      return next();
    }

    try {
      const token = authHeader.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('Invalid authorization format');
      }

      // Validate the token with Supabase
      const userData = await this.authService.verifySupabaseToken(token);

      // Attach user data to the request so handlers can access it
      (req as any).user = userData;

      next();
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid or expired access token: ' + (error as Error).message,
      );
    }
  }
}
