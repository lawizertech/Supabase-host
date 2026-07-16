import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return { success: true, data: users };
  }

  @Get('experts')
  async getAllExperts() {
    const experts = await this.adminService.getAllExperts();
    return { success: true, data: experts };
  }
}
