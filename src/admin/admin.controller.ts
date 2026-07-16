import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('user')
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return { success: true, data: users };
  }

  @Get('expert')
  async getAllExperts() {
    const experts = await this.adminService.getAllExperts();
    return { success: true, data: experts };
  }
}
