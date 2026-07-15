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
}
