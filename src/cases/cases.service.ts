import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Razorpay = require('razorpay');

@Injectable()
export class CasesService {
  private razorpay: Razorpay;

  constructor(private readonly prisma: PrismaService) {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_SECRET || 'secret_placeholder';

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async startProcess(
    userId: string,
    serviceCode: string,
    clientDetails: { fullName: string; email: string; phone: string },
    urgency: string = 'NORMAL',
  ) {
    const service = await this.prisma.services.findUnique({
      where: { service_id: serviceCode },
    });

    const price = service?.price ?? 999;
    const amountPaise = Math.round(price * 100);

    if (amountPaise < 100) {
      throw new BadRequestException(
        'Payment amount must be at least 100 paise (1 INR)',
      );
    }

    const defaultStages = [
      {
        id: 'stage-1',
        key: 'paid_money',
        title: 'Payment Completed',
        description: 'Fee paid via gateway',
        status: 'pending',
      },
      {
        id: 'stage-2',
        key: 'lawyer_assigned',
        title: 'Lawyer / Expert Assigned',
        description: 'Assigned to qualified legal professional',
        status: 'pending',
      },
      {
        id: 'stage-3',
        key: 'documents_uploaded',
        title: 'Documents Uploaded',
        description: 'Client & legal documents verified',
        status: 'pending',
      },
      {
        id: 'stage-4',
        key: 'in_progress',
        title: 'Work / Portal Filing In Progress',
        description: 'Application processed on official portal',
        status: 'pending',
      },
      {
        id: 'stage-5',
        key: 'completed',
        title: 'Service Completed',
        description: 'Certificate / Final draft issued',
        status: 'pending',
      },
    ];

    const newCase = await this.prisma.cases.create({
      data: {
        client_id: userId,
        case_type: serviceCode,
        status: 'pending_payment',
        stages: defaultStages as any,
      },
    });

    let razorpayOrder;
    try {
      razorpayOrder = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: newCase.id,
        notes: {
          caseId: newCase.id,
          serviceCode: serviceCode,
        },
      });
    } catch (error: any) {
      console.error('Failed to create Razorpay order:', error);
      throw new BadRequestException(
        `Razorpay Order creation failed: ${error.message || 'Unknown error'}`,
      );
    }

    await this.prisma.payments.create({
      data: {
        case_id: newCase.id,
        razorpay_order_id: razorpayOrder.id,
        amount: price,
        status: 'created',
      },
    });

    return {
      success: true,
      caseId: newCase.id,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  async getDashboard(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: {
        client_id: userId,
        status: { not: 'pending_payment' },
      },
      include: {
        professional: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const activeCases = cases.filter((c: any) => c.status !== 'completed');
    const completedCases = cases.filter((c: any) => c.status === 'completed');

    return {
      success: true,
      data: {
        activeServicesCount: activeCases.length,
        completedServicesCount: completedCases.length,
        totalSpent: 0,
        pendingServiceDocuments: 0,
      },
    };
  }

  async getServiceDetails(userId: string, caseId: string) {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
      include: {
        professional: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!serviceCase || serviceCase.client_id !== userId) {
      throw new BadRequestException('Case not found');
    }

    const service = await this.prisma.services.findUnique({
      where: { service_id: serviceCase.case_type },
    });

    const docs: any[] = await this.prisma.$queryRaw`
      SELECT id, filename, storage_path, created_at, size_bytes
      FROM case_documents
      WHERE case_id = ${caseId}::uuid
      ORDER BY created_at DESC
    `.catch(() => []);

    const uploadedDocs = (docs || []).map((d: any) => ({
      documentId: d.id,
      title: d.filename || 'Uploaded Document',
      name: d.filename || 'Uploaded Document',
      key: d.id,
      fileUrl: d.storage_path,
      status: 'APPROVED',
      createdAt: d.created_at,
    }));

    const stages = serviceCase.stages || [];

    return {
      success: true,
      service: {
        serviceId: serviceCase.id,
        serviceCode: serviceCase.case_type,
        title: service?.title || serviceCase.case_type,
        status:
          serviceCase.status === 'completed'
            ? 'COMPLETED'
            : serviceCase.status === 'pending_payment'
              ? 'ON_HOLD'
              : 'ACTIVE',
        macroStatus: serviceCase.status,
        assignedExpertId: serviceCase.professional_id,
        assignedExpert: serviceCase.professional
          ? {
              id: serviceCase.professional.id,
              name:
                serviceCase.professional.name || serviceCase.professional.email,
              email: serviceCase.professional.email,
            }
          : null,
        stages: stages,
        documentStats: {
          totalRequired: uploadedDocs.length,
          uploaded: uploadedDocs.length,
          approved: uploadedDocs.length,
          pending: 0,
        },
        instructions: null,
        documentsRequired: [],
        expertUploadedFiles: uploadedDocs,
      },
    };
  }

  async getServices(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: {
        client_id: userId,
        status: { not: 'pending_payment' },
      },
      include: {
        professional: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const services = await this.prisma.services.findMany();
    const serviceMap = new Map(
      services.map((s: any) => [s.service_id, s.title]),
    );

    const mappedCases = cases.map((c: any) => {
      const title = serviceMap.get(c.case_type) || c.case_type;
      const stages = c.stages || [];

      return {
        serviceId: c.id,
        serviceCode: c.case_type,
        title: title,
        status:
          c.status === 'completed'
            ? 'COMPLETED'
            : c.status === 'pending_payment'
              ? 'ON_HOLD'
              : 'ACTIVE',
        macroStatus: c.status,
        paymentStatus: c.status,
        createdAt: c.created_at,
        assignedExpertId: c.professional_id,
        assignedExpert: c.professional
          ? {
              id: c.professional.id,
              name: c.professional.name || c.professional.email,
              email: c.professional.email,
            }
          : null,
        stages: stages,
        documentStats: {
          totalRequired: 0,
          uploaded: 0,
          approved: 0,
          pending: 0,
        },
      };
    });

    return { success: true, services: mappedCases };
  }

  async uploadUserDocument(
    userId: string,
    caseId: string,
    dto: {
      filename: string;
      storagePath: string;
      fileType?: string;
      sizeBytes?: number;
    },
  ) {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!serviceCase) {
      throw new BadRequestException(`Case with ID ${caseId} not found`);
    }

    if (serviceCase.client_id !== userId) {
      throw new BadRequestException(
        'You are not authorized to upload documents for this case',
      );
    }

    const doc = await this.prisma.case_documents.create({
      data: {
        case_id: caseId,
        uploaded_by: userId,
        filename: dto.filename || 'Client Document',
        storage_path: dto.storagePath,
        file_type: dto.fileType || 'application/octet-stream',
        size_bytes: dto.sizeBytes ? BigInt(dto.sizeBytes) : null,
      },
      include: {
        profile: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return {
      id: doc.id,
      caseId: doc.case_id,
      name: doc.filename,
      url: doc.storage_path,
      fileUrl: doc.storage_path,
      documentUrl: doc.storage_path,
      storagePath: doc.storage_path,
      fileType: doc.file_type,
      sizeBytes: doc.size_bytes ? Number(doc.size_bytes) : 0,
      createdAt: doc.created_at,
      uploadedBy: doc.profile,
    };
  }
}
