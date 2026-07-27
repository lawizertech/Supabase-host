import { Controller, Get, Post, Delete, Query, Param, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { DocumentsService, CreateDocumentDto } from './documents.service';
import { AuthService } from '../auth/auth.service';
import { CloudinaryService } from '../storage/cloudinary.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async verifyAuth(authHeader?: string): Promise<string | undefined> {
    if (!authHeader) return undefined;
    const token = authHeader.replace('Bearer ', '');
    try {
      const userData = await this.authService.verifySupabaseToken(token);
      return userData?.id;
    } catch {
      return undefined;
    }
  }

  @Post('cloudinary-upload')
  async uploadToCloudinary(
    @Body() body: { caseId: string; fileData: string; filename: string; fileType?: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = await this.verifyAuth(authHeader);
    const result = await this.cloudinaryService.uploadFile(body.fileData, `case_documents/${body.caseId}`, body.filename);

    const document = await this.documentsService.createDocument({
      caseId: body.caseId,
      filename: body.filename,
      fileType: body.fileType || result.format || 'application/octet-stream',
      storagePath: result.secureUrl,
      sizeBytes: result.bytes,
      uploadedBy: userId,
    });

    return { success: true, cloudinary: result, document };
  }

  @Post('cloudinary-signature')
  async getCloudinarySignature(
    @Body() body: { caseId: string },
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    const signatureData = this.cloudinaryService.generateUploadSignature(`case_documents/${body.caseId}`);
    return { success: true, ...signatureData };
  }

  @Get()
  async getDocuments(
    @Query('caseId') caseId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    const documents = await this.documentsService.getCaseDocuments(caseId);
    return { success: true, documents, data: documents };
  }

  @Get('case/:id/documents')
  async getDocumentsByCasePath(
    @Param('id') caseId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    const documents = await this.documentsService.getCaseDocuments(caseId);
    return { success: true, documents, data: documents };
  }

  @Get('case/:id')
  async getDocumentsByCaseIdParam(
    @Param('id') caseId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    const documents = await this.documentsService.getCaseDocuments(caseId);
    return { success: true, documents, data: documents };
  }

  @Post('upload')
  async uploadDocumentRecord(
    @Body() body: CreateDocumentDto,
    @Headers('authorization') authHeader?: string,
  ) {
    const userId = await this.verifyAuth(authHeader);
    const document = await this.documentsService.createDocument({
      ...body,
      uploadedBy: userId || body.uploadedBy,
    });
    return { success: true, document };
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id') documentId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    return this.documentsService.deleteDocument(documentId);
  }
}
