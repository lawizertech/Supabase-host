import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.profiles.findMany({
      where: { role: 'client' },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAllExperts() {
    return this.prisma.profiles.findMany({
      where: { role: { in: ['expert', 'professional'] } },
      orderBy: { created_at: 'desc' },
    });
  }
}
