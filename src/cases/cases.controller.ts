import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { AuthService } from '../auth/auth.service';

@Controller('user')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly authService: AuthService,
  ) {}

  @Post('start-process')
  async startProcess(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      serviceCode: string;
      clientDetails: { fullName: string; email: string; phone: string };
      urgency?: string;
    },
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }

    const token = authHeader.replace('Bearer ', '');
    // Verify token with Supabase
    const userData = await this.authService.verifySupabaseToken(token);
    const userId = userData.id;

    if (!body.serviceCode) {
      throw new UnauthorizedException('Service code is required');
    }

    return this.casesService.startProcess(
      userId,
      body.serviceCode,
      body.clientDetails,
      body.urgency || 'NORMAL',
    );
  }
}
