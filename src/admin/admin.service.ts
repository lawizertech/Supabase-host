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

export interface CreateClientDto {
  id?: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  city?: string;
  state?: string;
  photoUrl?: string;
}

export interface CreateExpertDto {
  id?: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  professionalStatus?: string;
  city?: string;
  state?: string;
  photoUrl?: string;
}

@Injectable()
export class AdminService {
  private readonly supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  private readonly supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  constructor(private readonly prisma: PrismaService) {}

  private async createSupabaseAuthUser(email: string, password?: string, name?: string, phone?: string) {
    if (!this.supabaseUrl || !this.supabaseServiceRoleKey) {
      return { uid: null, password: null };
    }

    const assignedPassword = password || `Lawizer@${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseServiceRoleKey,
          Authorization: `Bearer ${this.supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({
          email,
          password: assignedPassword,
          email_confirm: true,
          user_metadata: {
            name: name || '',
            full_name: name || '',
            phone: phone || '',
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.warn('Supabase Admin User creation notice:', errJson?.msg || errJson?.message || res.statusText);
        return { uid: null, password: assignedPassword };
      }

      const createdUser = await res.json();
      const uid = createdUser?.id || createdUser?.user?.id || null;
      return { uid, password: assignedPassword };
    } catch (err: any) {
      console.warn('Failed to call Supabase Auth Admin API:', err.message);
      return { uid: null, password: assignedPassword };
    }
  }

  async createClient(dto: CreateClientDto) {
    const { name, email, password, phone, city, state, photoUrl, id } = dto;
    if (!name || !email) {
      throw new BadRequestException('Name and email are required to create a client.');
    }

    let clientId = id;

    const existing = await this.prisma.profiles.findFirst({
      where: {
        OR: [
          ...(clientId ? [{ id: clientId }] : []),
          { email: email },
        ],
      },
    });

    let assignedPassword = password;

    if (existing) {
      const updatedProfile = await this.prisma.profiles.update({
        where: { id: existing.id },
        data: {
          role: 'client',
          name: name || existing.name,
          phone: phone || existing.phone,
          city: city || existing.city,
          state: state || existing.state,
          photo_url: photoUrl || existing.photo_url,
          has_password: true,
          updated_at: new Date(),
        },
      });

      return {
        ...updatedProfile,
        initialPassword: assignedPassword || 'Preserved existing password',
      };
    }

    const { uid: authUid, password: generatedPassword } = await this.createSupabaseAuthUser(email, password, name, phone);
    assignedPassword = generatedPassword || password || 'Lawizer@123456';

    if (authUid) {
      clientId = authUid;
    } else if (!clientId) {
      clientId = crypto.randomUUID();
    }

    const createdProfile = await this.prisma.profiles.upsert({
      where: { id: clientId },
      update: {
        role: 'client',
        name,
        email,
        phone: phone || null,
        city: city || null,
        state: state || null,
        photo_url: photoUrl || null,
        has_password: true,
        updated_at: new Date(),
      },
      create: {
        id: clientId,
        name,
        email,
        phone: phone || null,
        role: 'client',
        city: city || null,
        state: state || null,
        photo_url: photoUrl || null,
        has_password: true,
      },
    });

    return {
      ...createdProfile,
      initialPassword: assignedPassword,
    };
  }

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

  async createExpert(dto: CreateExpertDto) {
    const { name, email, password, phone, professionalStatus, city, state, photoUrl, id } = dto;
    if (!name || !email) {
      throw new BadRequestException('Name and email are required to create an expert.');
    }

    let expertId = id;

    const existing = await this.prisma.profiles.findFirst({
      where: {
        OR: [
          ...(expertId ? [{ id: expertId }] : []),
          { email: email },
        ],
      },
    });

    if (existing) {
      return this.prisma.profiles.update({
        where: { id: existing.id },
        data: {
          role: 'professional',
          name: name || existing.name,
          phone: phone || existing.phone,
          professional_status: professionalStatus || existing.professional_status || 'VERIFIED_EXPERT',
          city: city || existing.city,
          state: state || existing.state,
          photo_url: photoUrl || existing.photo_url,
          updated_at: new Date(),
        },
      });
    }

    const { uid: authUid, password: generatedPassword } = await this.createSupabaseAuthUser(email, password, name, phone);
    if (authUid) {
      expertId = authUid;
    } else if (!expertId) {
      expertId = crypto.randomUUID();
    }

    return this.prisma.profiles.upsert({
      where: { id: expertId },
      update: {
        role: 'professional',
        name,
        email,
        phone: phone || null,
        professional_status: professionalStatus || 'VERIFIED_EXPERT',
        city: city || null,
        state: state || null,
        photo_url: photoUrl || null,
        updated_at: new Date(),
      },
      create: {
        id: expertId,
        name,
        email,
        phone: phone || null,
        role: 'professional',
        professional_status: professionalStatus || 'VERIFIED_EXPERT',
        city: city || null,
        state: state || null,
        photo_url: photoUrl || null,
      },
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
        stages: formattedStages as any,
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

    return this.prisma.cases.update({
      where: { id: caseId },
      data: {
        stages: stages as any,
        updated_at: new Date(),
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
        const existingStages = (existingCase.stages as any[]) || [
          { id: 'stage-1', key: 'paid_money', title: 'Payment Completed', status: 'completed' },
          { id: 'stage-2', key: 'lawyer_assigned', title: 'Lawyer / Expert Assigned', status: 'completed' },
          { id: 'stage-3', key: 'documents_uploaded', title: 'Documents Uploaded', status: 'in_progress' },
          { id: 'stage-4', key: 'in_progress', title: 'Work In Progress', status: 'pending' },
          { id: 'stage-5', key: 'completed', title: 'Service Completed', status: 'pending' },
        ];
        const updatedStages = stages || existingStages.map((s: any) => s.key === 'lawyer_assigned' ? { ...s, status: 'completed' } : s);

        return this.prisma.cases.update({
          where: { id: caseId },
          data: {
            professional_id: professionalId,
            ...(clientId ? { client_id: clientId } : {}),
            status: 'in_progress',
            stages: updatedStages as any,
            updated_at: new Date(),
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

      const defaultStages = stages || [
        { id: 'stage-1', key: 'paid_money', title: 'Payment Completed', status: 'completed' },
        { id: 'stage-2', key: 'lawyer_assigned', title: 'Lawyer / Expert Assigned', status: 'completed' },
        { id: 'stage-3', key: 'documents_uploaded', title: 'Documents Uploaded', status: 'in_progress' },
        { id: 'stage-4', key: 'in_progress', title: 'Work In Progress', status: 'pending' },
        { id: 'stage-5', key: 'completed', title: 'Service Completed', status: 'pending' },
      ];

      return this.prisma.cases.create({
        data: {
          id: caseId,
          client_id: clientId,
          professional_id: professionalId,
          case_type: caseType,
          status: 'in_progress',
          stages: defaultStages as any,
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

    const defaultStages = stages || [
      { id: 'stage-1', key: 'paid_money', title: 'Payment Completed', status: 'completed' },
      { id: 'stage-2', key: 'lawyer_assigned', title: 'Lawyer / Expert Assigned', status: 'completed' },
      { id: 'stage-3', key: 'documents_uploaded', title: 'Documents Uploaded', status: 'in_progress' },
      { id: 'stage-4', key: 'in_progress', title: 'Work In Progress', status: 'pending' },
      { id: 'stage-5', key: 'completed', title: 'Service Completed', status: 'pending' },
    ];

    return this.prisma.cases.create({
      data: {
        client_id: clientId,
        professional_id: professionalId,
        case_type: caseType,
        status: 'in_progress',
        stages: defaultStages as any,
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

  async getCaseChatMessages(
    caseId: string,
    limit?: number,
    before?: string,
    beforeId?: string,
  ) {
    let beforeDate: Date | undefined;
    const isUuid = (str?: string) =>
      str && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

    const targetBeforeId = beforeId || (isUuid(before) ? before : undefined);

    if (targetBeforeId) {
      const refMsg = await this.prisma.chat_messages.findUnique({
        where: { id: targetBeforeId },
        select: { created_at: true },
      });
      if (refMsg?.created_at) {
        beforeDate = refMsg.created_at;
      }
    } else if (before) {
      const parsed = new Date(before);
      if (!isNaN(parsed.getTime())) {
        beforeDate = parsed;
      }
    }

    const take = limit && !isNaN(limit) && limit > 0 ? Number(limit) : undefined;

    const whereCondition: any = { case_id: caseId };
    if (beforeDate) {
      whereCondition.created_at = { lt: beforeDate };
    }

    if (beforeDate || take) {
      const effectiveTake = take || 50;
      const messages = await this.prisma.chat_messages.findMany({
        where: whereCondition,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              photo_url: true,
            },
          },
          attachment: true,
        },
        orderBy: { created_at: 'desc' },
        take: effectiveTake,
      });
      return messages.reverse();
    }

    return this.prisma.chat_messages.findMany({
      where: whereCondition,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            photo_url: true,
          },
        },
        attachment: true,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async getCaseDocuments(caseId: string) {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
      select: { client_id: true, professional_id: true },
    });

    const docs = await this.prisma.case_documents.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: 'desc' },
      include: {
        profile: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const formattedDocs = docs.map((d: any) => {
      const uploaderRole = (d.profile?.role || '').toLowerCase();
      const isClient = d.uploaded_by === serviceCase?.client_id || uploaderRole === 'client';
      const isExpert = d.uploaded_by === serviceCase?.professional_id || ['expert', 'professional', 'lawyer'].includes(uploaderRole);

      return {
        id: d.id,
        caseId: d.case_id,
        name: d.filename || 'Case Document',
        url: d.storage_path,
        fileUrl: d.storage_path,
        documentUrl: d.storage_path,
        storagePath: d.storage_path,
        fileType: d.file_type,
        sizeBytes: d.size_bytes ? Number(d.size_bytes) : 0,
        createdAt: d.created_at,
        uploadedBy: d.profile,
        uploadedByType: isClient ? 'client' : isExpert ? 'expert' : 'unknown',
      };
    });

    const clientDocs = formattedDocs.filter((d: any) => d.uploadedByType === 'client');
    const expertDocs = formattedDocs.filter((d: any) => d.uploadedByType === 'expert');

    return {
      allDocuments: formattedDocs,
      clientDocuments: clientDocs,
      expertDocuments: expertDocs,
      summary: {
        total: formattedDocs.length,
        clientUploadedCount: clientDocs.length,
        expertUploadedCount: expertDocs.length,
      },
    };
  }
}





