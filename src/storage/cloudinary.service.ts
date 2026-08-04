import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format?: string;
  bytes?: number;
  resourceType?: string;
  createdAt?: string;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
      api_key: process.env.CLOUDINARY_API_KEY || '',
      api_secret: process.env.CLOUDINARY_API_SECRET || '',
      secure: true,
    });
  }

  /**
   * Upload file to Cloudinary (base64 string, data URI, or file path/buffer)
   */
  async uploadFile(
    fileData: string,
    folder = 'case_documents',
    filename?: string,
  ): Promise<CloudinaryUploadResult> {
    if (!fileData) {
      throw new BadRequestException('fileData is required for upload');
    }

    try {
      const publicId = filename
        ? filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        : undefined;

      const result: UploadApiResponse = await cloudinary.uploader.upload(
        fileData,
        {
          folder: `lawizer/${folder}`,
          public_id: publicId,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        },
      );

      return {
        publicId: result.public_id,
        url: result.secure_url || result.url,
        secureUrl: result.secure_url || result.url,
        format: result.format || result.resource_type,
        bytes: result.bytes,
        resourceType: result.resource_type,
        createdAt: result.created_at,
      };
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException(
        `Cloudinary upload failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Generates parameters & signature for direct frontend/client upload to Cloudinary
   */
  generateUploadSignature(folder = 'case_documents') {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const targetFolder = `lawizer/${folder}`;

    const paramsToSign = {
      timestamp,
      folder: targetFolder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || '',
    );

    return {
      timestamp,
      signature,
      folder: targetFolder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    };
  }

  /**
   * Delete asset from Cloudinary
   */
  async deleteFile(publicId: string) {
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      throw new BadRequestException(
        `Cloudinary delete failed: ${error.message}`,
      );
    }
  }
}
