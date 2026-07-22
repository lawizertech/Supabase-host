import { Controller, Get, Post, Delete, Query, Param, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { DocumentsService, CreateDocumentDto } from './documents.service';
import { AuthService } from '../auth/auth.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly authService: AuthService,
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

  @Get()
  async getDocuments(
    @Query('caseId') caseId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    await this.verifyAuth(authHeader);
    const documents = await this.documentsService.getCaseDocuments(caseId);
    return { success: true, documents };
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
