import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkAccess(caseId: string, userId: string): Promise<void> {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!serviceCase) {
      throw new BadRequestException('Case not found');
    }

    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new ForbiddenException('User profile not found');
    }

    // Access allowed for:
    // 1. Admin users
    // 2. The client associated with the case
    // 3. The professional assigned to the case
    if (
      profile.role === 'admin' ||
      serviceCase.client_id === userId ||
      serviceCase.professional_id === userId
    ) {
      return;
    }

    throw new ForbiddenException("You do not have access to this case's chat");
  }

  async getMessages(
    caseId: string,
    userId: string,
    limit?: number,
    before?: string,
    beforeId?: string,
  ) {
    await this.checkAccess(caseId, userId);

    let beforeDate: Date | undefined;
    const isUuid = (str?: string) =>
      str &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        str,
      );

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

    const take =
      limit && !isNaN(limit) && limit > 0 ? Number(limit) : undefined;

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

  async sendMessage(caseId: string, senderId: string, text: string) {
    await this.checkAccess(caseId, senderId);

    if (!text || text.trim() === '') {
      throw new BadRequestException('Message text cannot be empty');
    }

    return this.prisma.chat_messages.create({
      data: {
        case_id: caseId,
        sender_id: senderId,
        text: text,
      },
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
      },
    });
  }
}
