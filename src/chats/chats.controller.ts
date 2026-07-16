import { Controller, Get, Post, Body, Headers, Param, UnauthorizedException } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { AuthService } from '../auth/auth.service';

@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly authService: AuthService,
  ) {}

  private extractToken(authHeader: string): string {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    return authHeader.replace('Bearer ', '');
  }

  @Get(':caseId/messages')
  async getMessages(
    @Headers('authorization') authHeader: string,
    @Param('caseId') caseId: string,
  ) {
    const token = this.extractToken(authHeader);
    const userData = await this.authService.verifySupabaseToken(token);
    const messages = await this.chatsService.getMessages(caseId, userData.id);
    return { success: true, data: messages };
  }

  @Post(':caseId/messages')
  async sendMessage(
    @Headers('authorization') authHeader: string,
    @Param('caseId') caseId: string,
    @Body() body: { text: string },
  ) {
    const token = this.extractToken(authHeader);
    const userData = await this.authService.verifySupabaseToken(token);
    const message = await this.chatsService.sendMessage(caseId, userData.id, body.text);
    return { success: true, data: message };
  }
}
