import { Controller, Get, Post, Body } from '@nestjs/common';
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

  @Post('assign-case')
  async assignCase(
    @Body() body: { caseId: string; professionalId: string },
  ) {
    const updatedCase = await this.adminService.assignCase(body.caseId, body.professionalId);
    return { success: true, data: updatedCase };
  }

  @Get('cases')
  async getAllCases() {
    const cases = await this.adminService.getAllCases();
    return { success: true, data: cases };
  }

  @Get('transactions')
  async getAllTransactions() {
    const transactions = await this.adminService.getAllTransactions();
    return { success: true, data: transactions };
  }
}
