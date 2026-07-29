import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserNotifications(userId: string, caseId: string) {
    return this.prisma.$queryRaw`
      SELECT * FROM "notifications"
      WHERE "recipient_id" = ${userId}::uuid
      AND "payload"->>'caseId' = ${caseId}
      ORDER BY "created_at" DESC
    `;
  }

  async getAdminNotifications(caseId: string) {
    const admins = await this.prisma.profiles.findMany({
      where: { role: 'admin' },
    });
    
    if (admins.length === 0) {
      return [];
    }

    const notifs = await this.prisma.notifications.findMany({
      where: { recipient_id: { in: admins.map((a: { id: string }) => a.id) } },
      orderBy: { created_at: 'desc' },
    });
    
    // Fallback in-memory filter since Prisma JSON filtering on standard Json type can be tricky across versions
    return notifs.filter((n: any) => (n.payload as any)?.caseId === caseId);
  }

  async getAdminSentNotifications(caseId: string) {
    // Admin sent notifications typically have type 'admin_message' or sender_id 'admin'
    return this.prisma.$queryRaw`
      SELECT * FROM "notifications"
      WHERE "payload"->>'caseId' = ${caseId}
      AND ("type" = 'admin_message' OR "payload"->>'sender_id' = 'admin')
      ORDER BY "created_at" DESC
    `;
  }

  async sendAdminNotificationToUsers(caseId: string, target: 'client' | 'expert' | 'both', payload: any) {
    let roles = [];
    if (target === 'client') roles.push('client');
    if (target === 'expert') roles.push('professional');
    if (target === 'both') roles = ['client', 'professional'];

    const profiles = await this.prisma.profiles.findMany({
      where: { role: { in: roles } },
      select: { id: true },
    });

    if (profiles.length === 0) return { count: 0 };

    const data = profiles.map((p: { id: string }) => ({
      recipient_id: p.id,
      type: payload.type || 'admin_message',
      payload: { ...payload, caseId, sender_id: 'admin' },
    }));

    const result = await this.prisma.notifications.createMany({
      data,
    });

    return { count: result.count };
  }

  async sendToAdmin(expertId: string, caseId: string, payload: any) {
    const admins = await this.prisma.profiles.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });

    if (admins.length === 0) {
      throw new Error('No admin profile found');
    }

    const data = admins.map((a: { id: string }) => ({
      recipient_id: a.id,
      type: 'expert_message',
      payload: { ...payload, sender_id: expertId, caseId },
    }));

    const result = await this.prisma.notifications.createMany({
      data,
    });

    return { count: result.count };
  }
}
