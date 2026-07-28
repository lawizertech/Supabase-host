import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { StreamService } from './stream.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @UseGuards(AuthGuard)
  @Get('token')
  async getToken(@Req() req: any) {
    // AuthGuard attaches the Supabase user object to req.user
    const userId = req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const token = this.streamService.generateUserToken(userId);
    return { token };
  }
}
