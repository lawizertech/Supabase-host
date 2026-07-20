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

    const activeCases = cases.filter((c: any) => c.status === 'in_progress' || c.status === 'paid' || c.status === 'ACTIVE');
    const pendingCases = cases.filter((c: any) => c.status === 'pending_payment' || c.status === 'pending');

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
          title: (c.metadata as any)?.title || c.case_type,
          caseType: c.case_type,
          status: c.status,
          createdAt: c.created_at,
          client: c.client ? {
            id: c.client.id,
            name: c.client.name || c.client.email,
            email: c.client.email,
            phone: c.client.phone,
          } : null,
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
      const metadata = (c.metadata as any) || {};
      const title = metadata.title || c.case_type || `Case #${c.id.substring(0, 8).toUpperCase()}`;

      return {
        bookingId: c.id,
        serviceName: title,
        caseId: c.id,
        caseType: c.case_type,
        status: c.status === 'in_progress' || c.status === 'paid' ? 'confirmed' : 'pending',
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
}
