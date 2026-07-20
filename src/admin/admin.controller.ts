import { Controller, Get, Post, Body } from '@nestjs/common';
import { AdminService, AssignCaseDto } from './admin.service';
import { AuthService } from '../auth/auth.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  async adminLogin(
    @Body() body: { email?: string; password?: string; idToken?: string },
  ) {
    if (body.email && body.password) {
      return this.authService.loginWithPassword(body.email, body.password);
    }
    if (body.idToken) {
      return this.authService.login(body.idToken);
    }
    return { success: false, message: 'Email and password required' };
  }

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
    @Body() body: AssignCaseDto,
  ) {
    const updatedCase = await this.adminService.assignCase(body);
    return { success: true, data: updatedCase };
  }

  @Post('assign')
  async assign(
    @Body() body: AssignCaseDto,
  ) {
    const updatedCase = await this.adminService.assignCase(body);
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
