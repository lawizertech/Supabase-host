import { Injectable, Logger } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);
  private streamClient: StreamClient;

  constructor() {
    const apiKey = process.env.STREAM_API_KEY;
    const secretKey = process.env.STREAM_SECRET_KEY;

    if (!apiKey || !secretKey) {
      this.logger.warn('STREAM_API_KEY or STREAM_SECRET_KEY is missing from environment variables.');
    } else {
      // Initialize Stream Video Client
      this.streamClient = new StreamClient(apiKey, secretKey);
      this.logger.log('StreamClient successfully initialized');
    }
  }

  generateUserToken(userId: string): string {
    if (!this.streamClient) {
      throw new Error('Stream client is not initialized');
    }
    
    // Generate a secure token for the requested user
    const token = this.streamClient.generateUserToken({ user_id: userId });
    return token;
  }

  async getRecordingsForCall(callId: string) {
    if (!this.streamClient) {
      throw new Error('Stream client is not initialized');
    }
    try {
      const call = this.streamClient.video.call('default', callId);
      const response = await call.listRecordings();
      return response.recordings || [];
    } catch (err: any) {
      // Stream throws code 16 / 404 if the call was never joined.
      // We don't need to log an error for this since it's expected for unused meetings.
      if (err?.code !== 16 && err?.responseCode !== 404) {
        this.logger.error('Error fetching recordings for call: ' + callId, err);
      }
      return [];
    }
  }

  getApiKey(): string {
    return process.env.STREAM_API_KEY || '';
  }
}
