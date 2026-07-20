import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AssignCaseDto {
  caseId?: string;
  professionalId: string;
  clientId?: string;
  caseType?: string;
  title?: string;
}

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
      where: { role: { in: ['expert', 'professional', 'EXPERT', 'PROFESSIONAL', 'LAWYER', 'lawyer'] } },
      orderBy: { created_at: 'desc' },
    });
  }

  async assignCase(dto: AssignCaseDto | { caseId: string; professionalId: string }) {
    const professionalId = dto.professionalId;
    const caseId = dto.caseId;
    const clientId = 'clientId' in dto ? dto.clientId : undefined;
    const caseType = ('caseType' in dto && dto.caseType) ? dto.caseType : 'Corporate Legal & Tax Consultation';
    const title = ('title' in dto && dto.title) ? dto.title : caseType;

    if (!professionalId) {
      throw new BadRequestException('professionalId is required');
    }

    // 1. Validate professional profile
    const professional = await this.prisma.profiles.findUnique({
      where: { id: professionalId },
    });

    if (!professional) {
      throw new BadRequestException(`Professional profile not found with ID ${professionalId}`);
    }

    const roleUpper = (professional.role || '').toUpperCase();
    const isProf = ['EXPERT', 'PROFESSIONAL', 'LAWYER'].includes(roleUpper);

    if (!isProf) {
      // Auto-promote role to professional for development convenience
      await this.prisma.profiles.update({
        where: { id: professionalId },
        data: { role: 'professional' },
      });
    }

    // 2. If caseId is provided, check if it exists
    if (caseId) {
      const existingCase = await this.prisma.cases.findUnique({
        where: { id: caseId },
      });

      if (existingCase) {
        return this.prisma.cases.update({
          where: { id: caseId },
          data: {
            professional_id: professionalId,
            ...(clientId ? { client_id: clientId } : {}),
            status: 'in_progress',
            metadata: {
              ...(typeof existingCase.metadata === 'object' && existingCase.metadata !== null ? existingCase.metadata : {}),
              title: title,
              updated_at: new Date().toISOString(),
            },
          },
          include: {
            client: {
              select: { id: true, name: true, email: true },
            },
            professional: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        });
      }

      // If caseId provided but does not exist, check if clientId is present to create it with this caseId
      if (!clientId) {
        throw new BadRequestException(`Case not found with ID ${caseId} and no clientId provided to create a new case.`);
      }

      return this.prisma.cases.create({
        data: {
          id: caseId,
          client_id: clientId,
          professional_id: professionalId,
          case_type: caseType,
          status: 'in_progress',
          metadata: {
            title: title,
            created_at: new Date().toISOString(),
          },
        },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
          professional: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
    }

    // 3. If no caseId provided, clientId MUST be provided
    if (!clientId) {
      throw new BadRequestException('Either caseId or clientId must be provided to assign a case.');
    }

    return this.prisma.cases.create({
      data: {
        client_id: clientId,
        professional_id: professionalId,
        case_type: caseType,
        status: 'in_progress',
        metadata: {
          title: title,
          created_at: new Date().toISOString(),
        },
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        professional: {
          select: { id: true, name: true, email: true, role: true },
        },
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
