import { Controller, Post, Get, Body, Param, UnauthorizedException, Headers } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { AuthService } from '../auth/auth.service';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly authService: AuthService,
  ) {}

  private async getUserId(authHeader?: string): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    if (!userData || !userData.id) {
      throw new UnauthorizedException('Invalid authentication token');
    }
    return userData.id;
  }

  @Post('create')
  async createMeeting(
    @Headers('authorization') authHeader: string,
    @Body() body: { caseId: string; title?: string },
  ) {
    const userId = await this.getUserId(authHeader);
    return this.meetingsService.createMeetingSession(userId, body.caseId, body.title);
  }

  @Get(':caseId/recordings')
  async getRecordings(
    @Headers('authorization') authHeader: string,
    @Param('caseId') caseId: string,
  ) {
    const userId = await this.getUserId(authHeader);
    return this.meetingsService.getRecordingsForCase(userId, caseId);
  }
}
