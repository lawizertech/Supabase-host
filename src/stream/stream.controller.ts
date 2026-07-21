import { Controller, Get, Post, Body, UseGuards, UnauthorizedException, Headers } from '@nestjs/common';
import { StreamService } from './stream.service';
import { AuthService } from '../auth/auth.service';

@Controller('stream')
export class StreamController {
  constructor(
    private readonly streamService: StreamService,
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

  @Get('token')
  async getToken(@Headers('authorization') authHeader: string) {
    const userId = await this.getUserId(authHeader);
    const token = this.streamService.generateUserToken(userId);
    return {
      success: true,
      token,
      apiKey: process.env.STREAM_API_KEY,
    };
  }

  @Post('initiate')
  async initiateCall(
    @Headers('authorization') authHeader: string,
    @Body() body: { caseId: string; mode?: 'audio' | 'video' },
  ) {
    const userId = await this.getUserId(authHeader);
    const result = await this.streamService.initiateCall(
      body.caseId,
      userId,
      body.mode || 'video',
    );
    return result;
  }
}
