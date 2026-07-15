import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Razorpay = require('razorpay');

@Injectable()
export class CasesService {
  private razorpay: Razorpay;

  constructor(private readonly prisma: PrismaService) {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID_TEST || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET_TEST || 'secret_placeholder';

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
    // 1. Resolve pricing from DB or fallback
    const service = await this.prisma.services.findUnique({
      where: { service_id: serviceCode },
    });

    const price = service?.price ?? 999; // Default fallback price of 999 INR
    const amountPaise = Math.round(price * 100);

    // 2. Create case (service request) in the database with status 'pending_payment'
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

    // 3. Create Razorpay order
    let razorpayOrder;
    try {
      razorpayOrder = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: newCase.id,
        notes: {
          caseId: newCase.id,
          serviceCode: serviceCode,
          userId: userId,
        },
      });
    } catch (error) {
      // Clean up case if Razorpay order creation fails
      await this.prisma.cases.delete({ where: { id: newCase.id } });
      throw new BadRequestException('Failed to create Razorpay payment order: ' + (error as Error).message);
    }

    // 4. Save payment record
    await this.prisma.payments.create({
      data: {
        case_id: newCase.id,
        razorpay_order_id: razorpayOrder.id,
        status: 'created',
        amount: price,
      },
    });

    return {
      success: true,
      process: {
        id: newCase.id,
        processCode: newCase.id, // Frontend uses processCode to display success info
        status: newCase.status,
      },
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID_TEST || '',
    };
  }

  async getDashboard(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: { client_id: userId },
    });

    const totalServices = cases.length;
    const activeServices = cases.filter((c: any) => c.status === 'paid').length;
    const completedServices = cases.filter((c: any) => c.status === 'completed').length;

    // Fetch verified payments
    const caseIds = cases.map((c: any) => c.id);
    const payments = await this.prisma.payments.findMany({
      where: {
        case_id: { in: caseIds },
        status: 'verified',
      },
    });
    const totalSpent = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Fetch meetings
    const meetings = await this.prisma.meetings.findMany({
      where: {
        case_id: { in: caseIds },
      },
    });

    const upcomingMeetings = meetings.filter((m: any) => m.status === 'confirmed' || m.status === 'proposed');
    const upcomingCount = upcomingMeetings.length;
    const completedCount = meetings.filter((m: any) => m.status === 'completed').length;

    const upcomingBookings = upcomingMeetings.map((m: any) => {
      const parentCase = cases.find((c: any) => c.id === m.case_id);
      return {
        bookingId: m.id,
        serviceName: parentCase?.case_type || 'Consultation',
        expertName: 'Legal Expert',
        bookingDate: m.scheduled_for ? { _seconds: Math.floor(m.scheduled_for.getTime() / 1000) } : null,
        rate: 0,
        status: m.status === 'confirmed' ? 'confirmed' : 'pending',
      };
    });

    return {
      success: true,
      dashboard: {
        upcomingCount,
        completedCount,
        expertsConsulted: 0,
        totalSpent,
        upcomingBookings,
        topExperts: [],
        totalServices,
        activeServices,
        completedServices,
        pendingServiceDocuments: 0,
      },
    };
  }

  async getServiceDetails(userId: string, caseId: string) {
    const serviceCase = await this.prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!serviceCase || serviceCase.client_id !== userId) {
      throw new BadRequestException('Case not found');
    }

    const service = await this.prisma.services.findUnique({
      where: { service_id: serviceCase.case_type },
    });

    return {
      success: true,
      service: {
        serviceId: serviceCase.id,
        serviceCode: serviceCase.case_type,
        title: service?.title || serviceCase.case_type,
        status: serviceCase.status === 'paid' ? 'ACTIVE' : 'ON_HOLD',
        documentStats: {
          totalRequired: 0,
          uploaded: 0,
          approved: 0,
          pending: 0,
        },
        instructions: null,
        documentsRequired: [],
        expertUploadedFiles: [],
      },
    };
  }
}
