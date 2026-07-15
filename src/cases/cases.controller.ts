import { Controller, Post, Get, Body, Headers, Param, UnauthorizedException } from '@nestjs/common';
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

  @Get('dashboard')
  async getDashboard(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    return this.casesService.getDashboard(userData.id);
  }

  @Get('services/:id')
  async getServiceDetails(
    @Headers('authorization') authHeader: string,
    @Param('id') caseId: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    return this.casesService.getServiceDetails(userData.id, caseId);
  }
}
