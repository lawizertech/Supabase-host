import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMeetingSession(userId: string, caseId: string, title?: string) {
    // Validate case access
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        professional: true,
      },
    });

    if (!serviceCase) {
      throw new BadRequestException('Case not found');
    }

    const isClient = serviceCase.client_id === userId;
    const isProfessional = serviceCase.professional_id === userId;

    if (!isClient && !isProfessional) {
      const profile = await this.prisma.profiles.findUnique({ where: { id: userId } });
      if (profile?.role !== 'admin') {
        throw new ForbiddenException('You do not have permission to create a session for this case');
      }
    }

    // Identify sender role for chat message
    let senderRole = 'system';
    if (isClient) senderRole = 'client';
    else if (isProfessional) senderRole = 'professional';

    // Create the meeting record
    const meeting = await this.prisma.meetings.create({
      data: {
        case_id: caseId,
        title: title || 'Video Consultation',
        status: 'scheduled',
      },
    });

    // Broadcast a chat message with the meeting link
    const chatMessage = await this.prisma.chat_messages.create({
      data: {
        case_id: caseId,
        sender_id: userId,
        text: meeting.id, // we store the meeting ID here
        sender_role: senderRole,
        message_type: 'meeting_link',
      },
    });

    return {
      success: true,
      meetingId: meeting.id,
      chatMessageId: chatMessage.id,
    };
  }
}
