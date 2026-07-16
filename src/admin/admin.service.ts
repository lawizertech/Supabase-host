import { Injectable, BadRequestException } from '@nestjs/common';
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

  async assignCase(caseId: string, professionalId: string) {
    const existingCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });
    if (!existingCase) {
      throw new BadRequestException('Case not found');
    }

    const professional = await this.prisma.profiles.findUnique({
      where: { id: professionalId },
    });
    if (!professional) {
      throw new BadRequestException('Professional not found');
    }

    if (professional.role !== 'expert' && professional.role !== 'professional') {
      throw new BadRequestException('Assigned user must be an expert or professional');
    }

    return this.prisma.cases.update({
      where: { id: caseId },
      data: {
        professional_id: professionalId,
      },
    });
  }

  async getAllCases() {
    return this.prisma.cases.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAllTransactions() {
    return this.prisma.payments.findMany({
      include: {
        case: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
