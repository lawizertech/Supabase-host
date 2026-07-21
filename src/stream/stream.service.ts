import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private streamClient: StreamClient | null = null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.STREAM_API_KEY;
    const secretKey = process.env.STREAM_SECRET_KEY;

    if (apiKey && secretKey) {
      this.streamClient = new StreamClient(apiKey, secretKey);
    } else {
      this.logger.warn('STREAM_API_KEY or STREAM_SECRET_KEY is not configured in environment.');
    }
  }

  /**
   * Generates a signed Stream user token valid for 1 hour.
   */
  generateUserToken(userId: string): string {
    const apiKey = process.env.STREAM_API_KEY;
    const secretKey = process.env.STREAM_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new BadRequestException('Stream API Key or Secret Key is missing on backend server');
    }

    if (!this.streamClient) {
      this.streamClient = new StreamClient(apiKey, secretKey);
    }

    // Token expires in 1 hour (3600 seconds)
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return this.streamClient.generateUserToken({ user_id: userId, exp });
  }

  /**
   * Initiates a call session for a case, validating access control.
   */
  async initiateCall(caseId: string, initiatorId: string, mode: 'audio' | 'video' = 'video') {
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

    // Check user access
    const isClient = serviceCase.client_id === initiatorId;
    const isProfessional = serviceCase.professional_id === initiatorId;

    if (!isClient && !isProfessional) {
      const profile = await this.prisma.profiles.findUnique({ where: { id: initiatorId } });
      if (profile?.role !== 'admin') {
        throw new ForbiddenException('You do not have permission to initiate a call for this case');
      }
    }

    const streamCallId = `call_${caseId}_${Date.now()}`;

    // Create record in database
    const callRecord = await this.prisma.calls.create({
      data: {
        case_id: caseId,
        initiated_by: initiatorId,
        mode: mode,
        status: 'ringing',
        started_at: new Date(),
      },
    });

    return {
      success: true,
      callId: callRecord.id,
      streamCallId,
      caseId,
      mode,
      client: serviceCase.client,
      professional: serviceCase.professional,
    };
  }
}
