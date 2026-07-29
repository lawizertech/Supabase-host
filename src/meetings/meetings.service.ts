import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StreamService } from '../stream/stream.service';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streamService: StreamService
  ) {}

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

    // Rate limit check: prevent creating another meeting if one was created in the last 15 seconds
    const lastMeeting = await this.prisma.meetings.findFirst({
      where: { case_id: caseId },
      orderBy: { created_at: 'desc' },
    });

    if (lastMeeting) {
      const now = new Date();
      const lastMeetingTime = new Date(lastMeeting.created_at);
      const diffInSeconds = (now.getTime() - lastMeetingTime.getTime()) / 1000;
      if (diffInSeconds < 15) {
        throw new BadRequestException('Please wait 15 seconds before creating another meeting session');
      }
    }

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

  async getRecordingsForCase(caseId: string) {
    // Validate case access
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!serviceCase) {
      throw new BadRequestException('Case not found');
    }

    // Find all meetings for this case
    const meetings = await this.prisma.meetings.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: 'desc' },
    });

    const allRecordings = [];

    // Fetch recordings for each meeting from Stream
    for (const meeting of meetings) {
      const recordings = await this.streamService.getRecordingsForCall(`meet_${meeting.id}`);
      if (recordings && recordings.length > 0) {
        allRecordings.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingDate: meeting.created_at,
          recordings: recordings,
        });
      }
    }

    return {
      success: true,
      caseId,
      recordings: allRecordings,
    };
  }
}
