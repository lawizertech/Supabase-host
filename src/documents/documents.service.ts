import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDocumentDto {
  caseId: string;
  filename: string;
  fileType?: string;
  storagePath: string;
  sizeBytes?: number;
  uploadedBy?: string;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCaseDocuments(caseId: string) {
    if (!caseId) {
      throw new BadRequestException('caseId parameter is required');
    }

    const docs = await this.prisma.case_documents.findMany({
      where: { case_id: caseId },
      orderBy: { created_at: 'desc' },
      include: {
        profile: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return docs.map((d: any) => ({
      id: d.id,
      caseId: d.case_id,
      name: d.filename || 'Case Document',
      fileUrl: d.storage_path,
      fileType: d.file_type,
      sizeBytes: d.size_bytes ? Number(d.size_bytes) : 0,
      createdAt: d.created_at,
      uploadedBy: d.profile,
    }));
  }

  async createDocument(dto: CreateDocumentDto) {
    const { caseId, filename, fileType, storagePath, sizeBytes, uploadedBy } = dto;
    if (!caseId || !storagePath) {
      throw new BadRequestException('caseId and storagePath are required');
    }

    const existingCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    const doc = await this.prisma.case_documents.create({
      data: {
        case_id: caseId,
        filename: filename || 'Case Document',
        file_type: fileType || 'application/octet-stream',
        storage_path: storagePath,
        size_bytes: sizeBytes ? BigInt(sizeBytes) : null,
        uploaded_by: uploadedBy || null,
      },
    });

    return {
      id: doc.id,
      caseId: doc.case_id,
      name: doc.filename,
      fileUrl: doc.storage_path,
      fileType: doc.file_type,
      sizeBytes: doc.size_bytes ? Number(doc.size_bytes) : 0,
      createdAt: doc.created_at,
    };
  }

  async deleteDocument(documentId: string) {
    const existing = await this.prisma.case_documents.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    await this.prisma.case_documents.delete({
      where: { id: documentId },
    });

    return {
      success: true,
      message: 'Document deleted successfully',
      deletedDocumentId: documentId,
    };
  }
}
