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
}
