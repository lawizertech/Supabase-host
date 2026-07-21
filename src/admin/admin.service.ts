import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StageItemDto {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  updatedAt?: string;
}

export interface AssignServiceDto {
  clientId: string;
  professionalId?: string;
  caseType: string;
  title: string;
  stages?: StageItemDto[];
  currentStageId?: string;
}

export interface AssignCaseDto {
  caseId?: string;
  professionalId: string;
  clientId?: string;
  caseType?: string;
  title?: string;
  stages?: StageItemDto[];
  currentStageId?: string;
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

  async assignService(dto: AssignServiceDto) {
    const { clientId, professionalId, caseType, title, stages, currentStageId } = dto;

    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    const client = await this.prisma.profiles.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new BadRequestException(`Client not found with ID ${clientId}`);
    }

    if (professionalId) {
      const professional = await this.prisma.profiles.findUnique({
        where: { id: professionalId },
      });
      if (!professional) {
        throw new BadRequestException(`Professional not found with ID ${professionalId}`);
      }
    }

    const formattedStages = stages && stages.length > 0 ? stages : [
      { id: 'stage-1', title: 'Consultation & Requirements', description: 'Initial onboarding & KYC verification', status: 'completed', updatedAt: new Date().toISOString() },
      { id: 'stage-2', title: 'Documentation & Drafting', description: 'Preparing service filings & documents', status: 'in_progress', updatedAt: new Date().toISOString() },
      { id: 'stage-3', title: 'Government Portal Filing', description: 'Filing application on official portal', status: 'pending' },
      { id: 'stage-4', title: 'Service Completion & Approval', description: 'Final certificate / license issued', status: 'pending' },
    ];

    const activeStageId = currentStageId || formattedStages.find((s) => s.status === 'in_progress')?.id || formattedStages[0]?.id;

    return this.prisma.cases.create({
      data: {
        client_id: clientId,
        professional_id: professionalId || null,
        case_type: caseType || 'Legal Service',
        status: 'in_progress',
        metadata: {
          title: title || caseType || 'Assigned Legal Service',
          stages: formattedStages,
          currentStageId: activeStageId,
          created_at: new Date().toISOString(),
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

  async updateCaseStages(caseId: string, stages: StageItemDto[], currentStageId?: string) {
    const existingCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new BadRequestException(`Case not found with ID ${caseId}`);
    }

    const currentMetadata = (typeof existingCase.metadata === 'object' && existingCase.metadata !== null) ? existingCase.metadata : {};
    const activeStageId = currentStageId || stages.find((s) => s.status === 'in_progress')?.id || stages[0]?.id;

    return this.prisma.cases.update({
      where: { id: caseId },
      data: {
        metadata: {
          ...currentMetadata,
          stages: stages,
          currentStageId: activeStageId,
          updated_at: new Date().toISOString(),
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async assignCase(dto: AssignCaseDto | { caseId: string; professionalId: string }) {
    const professionalId = dto.professionalId;
    const caseId = dto.caseId;
    const clientId = 'clientId' in dto ? dto.clientId : undefined;
    const caseType = ('caseType' in dto && dto.caseType) ? dto.caseType : 'Corporate Legal & Tax Consultation';
    const title = ('title' in dto && dto.title) ? dto.title : caseType;
    const stages = 'stages' in dto ? dto.stages : undefined;
    const currentStageId = 'currentStageId' in dto ? dto.currentStageId : undefined;

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
        const prevMetadata = typeof existingCase.metadata === 'object' && existingCase.metadata !== null ? existingCase.metadata : {};
        return this.prisma.cases.update({
          where: { id: caseId },
          data: {
            professional_id: professionalId,
            ...(clientId ? { client_id: clientId } : {}),
            status: 'in_progress',
            metadata: {
              ...prevMetadata,
              title: title,
              ...(stages ? { stages } : {}),
              ...(currentStageId ? { currentStageId } : {}),
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
            ...(stages ? { stages } : {}),
            ...(currentStageId ? { currentStageId } : {}),
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
          ...(stages ? { stages } : {}),
          ...(currentStageId ? { currentStageId } : {}),
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
