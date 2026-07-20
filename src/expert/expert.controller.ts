import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ExpertService } from './expert.service';
import { AuthService } from '../auth/auth.service';

@Controller('expert')
export class ExpertController {
  constructor(
    private readonly expertService: ExpertService,
    private readonly authService: AuthService,
  ) {}

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
