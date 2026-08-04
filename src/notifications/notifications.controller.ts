import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // -------------------------------------------------------------
  // ADMIN API: Public (as per user request, will add auth later)
  // -------------------------------------------------------------

  @Get('case/:caseId/admin')
  async getAdminNotifications(@Param('caseId') caseId: string) {
    return this.notificationsService.getAdminNotifications(caseId);
  }

  @Get('case/:caseId/admin/sent')
  async getAdminSentNotifications(@Param('caseId') caseId: string) {
    return this.notificationsService.getAdminSentNotifications(caseId);
  }

  @Post('case/:caseId/admin/send')
  async sendAdminNotification(
    @Param('caseId') caseId: string,
    @Body() body: { target: 'client' | 'expert' | 'both'; payload: any },
  ) {
    return this.notificationsService.sendAdminNotificationToUsers(
      caseId,
      body.target,
      body.payload,
    );
  }

  // -------------------------------------------------------------
  // USER/EXPERT API: Authenticated
  // -------------------------------------------------------------

  @UseGuards(AuthGuard)
  @Get('case/:caseId/user')
  async getUserNotifications(@Req() req: any, @Param('caseId') caseId: string) {
    // AuthGuard attaches the Supabase user object to req.user
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.getUserNotifications(userId, caseId);
  }

  @UseGuards(AuthGuard)
  @Post('case/:caseId/expert/send-to-admin')
  async expertSendToAdmin(
    @Req() req: any,
    @Param('caseId') caseId: string,
    @Body() body: { payload: any },
  ) {
    const expertId = req.user?.id || req.user?.sub;
    return this.notificationsService.sendToAdmin(
      expertId,
      caseId,
      body.payload,
    );
  }
}
