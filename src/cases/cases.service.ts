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
      throw new BadRequestException('Payment amount must be at least 100 paise (1 INR)');
    }

    const newCase = await this.prisma.cases.create({
      data: {
        client_id: userId,
        case_type: serviceCode,
        status: 'pending_payment',
        metadata: {
          clientDetails,
          urgency,
          serviceTitle: service?.title || serviceCode,
        },
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
      throw new BadRequestException(`Razorpay Order creation failed: ${error.message || 'Unknown error'}`);
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
      where: { client_id: userId },
      include: {
        professional: {
          select: { id: true, name: true, email: true }
        }
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
          select: { id: true, name: true, email: true }
        }
      }
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
      title: d.filename || "Uploaded Document",
      name: d.filename || "Uploaded Document",
      key: d.id,
      fileUrl: d.storage_path,
      status: "APPROVED",
      createdAt: d.created_at,
    }));

    return {
      success: true,
      service: {
        serviceId: serviceCase.id,
        serviceCode: serviceCase.case_type,
        title: service?.title || (serviceCase.metadata as any)?.title || serviceCase.case_type,
        status: serviceCase.status === 'paid' || serviceCase.status === 'in_progress' ? 'ACTIVE' : 'ON_HOLD',
        assignedExpertId: serviceCase.professional_id,
        assignedExpert: serviceCase.professional ? {
          id: serviceCase.professional.id,
          name: serviceCase.professional.name || serviceCase.professional.email,
          email: serviceCase.professional.email
        } : null,
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
      where: { client_id: userId },
      include: {
        professional: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { created_at: 'desc' },
    });

    const services = await this.prisma.services.findMany();
    const serviceMap = new Map(services.map((s: any) => [s.service_id, s.title]));

    const mappedCases = cases.map((c: any) => {
      const metadata = (c.metadata as any) || {};
      const title = serviceMap.get(c.case_type) || metadata.title || metadata.serviceTitle || c.case_type;

      return {
        serviceId: c.id,
        serviceCode: c.case_type,
        title: title,
        status: c.status === 'paid' || c.status === 'in_progress' ? 'ACTIVE' : 'ON_HOLD',
        paymentStatus: c.status,
        createdAt: c.created_at,
        assignedExpertId: c.professional_id,
        assignedExpert: c.professional ? {
          id: c.professional.id,
          name: c.professional.name || c.professional.email,
          email: c.professional.email
        } : null,
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
}
