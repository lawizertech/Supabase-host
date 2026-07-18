import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser Decorator
 *
 * Extracts the authenticated user from the request object.
 * Used in conjunction with AuthGuard.
 *
 * Usage:
 *   @UseGuards(AuthGuard)
 *   @Post('example')
 *   async example(@CurrentUser() user: any) {
 *     // user contains the verified Supabase user data
 *     console.log(user.id);
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
