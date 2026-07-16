import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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

    throw new ForbiddenException('You do not have access to this case\'s chat');
  }

  async getMessages(caseId: string, userId: string) {
    await this.checkAccess(caseId, userId);

    return this.prisma.chat_messages.findMany({
      where: { case_id: caseId },
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
