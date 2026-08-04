import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpertService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new BadRequestException('Expert profile not found');
    }

    return {
      success: true,
      profile: {
        id: profile.id,
        name: profile.name || 'Expert Professional',
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
      },
    };
  }

  async getDashboard(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: { professional_id: userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const activeCases = cases.filter(
      (c: any) =>
        c.status === 'in_progress' ||
        c.status === 'paid' ||
        c.status === 'ACTIVE',
    );
    const pendingCases = cases.filter(
      (c: any) => c.status === 'pending_payment' || c.status === 'pending',
    );

    return {
      success: true,
      dashboard: {
        pendingRequests: pendingCases.length,
        todayBookings: activeCases.length,
        activeServices: activeCases.length,
        totalEarnings: activeCases.length * 999,
        assignedCasesCount: cases.length,
        cases: cases.map((c: any) => ({
          caseId: c.id,
          title: c.case_type,
          caseType: c.case_type,
          status: c.status,
          stages: c.stages || [],
          createdAt: c.created_at,
          client: c.client
            ? {
                id: c.client.id,
                name: c.client.name || c.client.email,
                email: c.client.email,
                phone: c.client.phone,
              }
            : null,
        })),
      },
    };
  }

  async getConsultations(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: { professional_id: userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const mapped = cases.map((c: any) => {
      const title =
        c.case_type || `Case #${c.id.substring(0, 8).toUpperCase()}`;

      return {
        bookingId: c.id,
        serviceName: title,
        caseId: c.id,
        caseType: c.case_type,
        status:
          c.status === 'in_progress' || c.status === 'paid'
            ? 'confirmed'
            : 'pending',
        bookingDate: c.created_at,
        duration: 60,
        rate: 999,
        callType: 'chat',
        userDetails: {
          displayName: c.client?.name || c.client?.email || 'Client',
          email: c.client?.email,
          phone: c.client?.phone,
        },
      };
    });

    return {
      success: true,
      consultations: mapped,
    };
  }

  async uploadExpertDocument(
    userId: string,
    caseId: string,
    dto: {
      filename: string;
      storagePath: string;
      fileType?: string;
      sizeBytes?: number;
    },
  ) {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!serviceCase) {
      throw new BadRequestException(`Case with ID ${caseId} not found`);
    }

    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
    });

    const isAuthorized =
      serviceCase.professional_id === userId ||
      [
        'expert',
        'professional',
        'admin',
        'EXPERT',
        'PROFESSIONAL',
        'LAWYER',
      ].includes(profile?.role || '');

    if (!isAuthorized) {
      throw new BadRequestException('You are not assigned to this case');
    }

    const doc = await this.prisma.case_documents.create({
      data: {
        case_id: caseId,
        uploaded_by: userId,
        filename: dto.filename || 'Expert Document',
        storage_path: dto.storagePath,
        file_type: dto.fileType || 'application/octet-stream',
        size_bytes: dto.sizeBytes ? BigInt(dto.sizeBytes) : null,
      },
      include: {
        profile: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return {
      id: doc.id,
      caseId: doc.case_id,
      name: doc.filename,
      url: doc.storage_path,
      fileUrl: doc.storage_path,
      documentUrl: doc.storage_path,
      storagePath: doc.storage_path,
      fileType: doc.file_type,
      sizeBytes: doc.size_bytes ? Number(doc.size_bytes) : 0,
      createdAt: doc.created_at,
      uploadedBy: doc.profile,
    };
  }
}
