import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyPayment(
    razorpay_payment_id: string,
    razorpay_order_id: string,
    razorpay_signature: string,
    processCode: string,
  ) {
    // 1. Verify payment signature
    const secret = process.env.RAZORPAY_SECRET || 'secret_placeholder';
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    if (!isValid) {
      // Find and update payment to failed if signature mismatch
      const payment = await this.prisma.payments.findFirst({
        where: { razorpay_order_id },
      });
      if (payment) {
        await this.prisma.payments.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }
      throw new BadRequestException('Payment verification failed: signature mismatch');
    }

    // 2. Find associated payment record
    const payment = await this.prisma.payments.findFirst({
      where: { razorpay_order_id },
    });

    if (!payment) {
      throw new BadRequestException('Payment record not found for this order');
    }

    // 3. Update payment and case status in a transaction
    await this.prisma.$transaction([
      this.prisma.payments.update({
        where: { id: payment.id },
        data: {
          razorpay_payment_id,
          status: 'verified',
          verified_at: new Date(),
        },
      }),
      this.prisma.cases.update({
        where: { id: payment.case_id },
        data: {
          status: 'paid',
        },
      }),
    ]);

    return {
      success: true,
      message: 'Payment verified and case activated successfully',
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret_placeholder';

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf-8'));
    const eventName = event.event;

    if (eventName === 'order.paid') {
      const orderId = event.payload.order.entity.id;
      const paymentId = event.payload.payment.entity.id;

      // Find associated payment record
      const payment = await this.prisma.payments.findFirst({
        where: { razorpay_order_id: orderId },
      });

      if (payment) {
        await this.prisma.$transaction([
          this.prisma.payments.update({
            where: { id: payment.id },
            data: {
              razorpay_payment_id: paymentId,
              status: 'verified',
              verified_at: new Date(),
              raw_webhook_payload: event,
            },
          }),
          this.prisma.cases.update({
            where: { id: payment.case_id },
            data: {
              status: 'paid',
            },
          }),
        ]);
      }
    } else if (eventName === 'payment.failed') {
      const orderId = event.payload.payment.entity.order_id;
      const payment = await this.prisma.payments.findFirst({
        where: { razorpay_order_id: orderId },
      });
      if (payment) {
        await this.prisma.payments.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            raw_webhook_payload: event,
          },
        });
      }
    }

    return { success: true };
  }

  async getPaymentHistory(userId: string) {
    const cases = await this.prisma.cases.findMany({
      where: { client_id: userId },
    });

    const caseIds = cases.map((c: any) => c.id);

    const payments = await this.prisma.payments.findMany({
      where: {
        case_id: { in: caseIds },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const serviceMap = new Map(
      (await this.prisma.services.findMany()).map((s: any) => [s.service_id, s.title])
    );

    const history = payments.map((p: any) => {
      const parentCase = cases.find((c: any) => c.id === p.case_id);
      const serviceTitle = parentCase
        ? (serviceMap.get(parentCase.case_type) || parentCase.case_type)
        : 'Unknown Service';

      return {
        id: p.id,
        serviceTitle,
        razorpayOrderId: p.razorpay_order_id,
        razorpayPaymentId: p.razorpay_payment_id,
        amount: p.amount,
        status: p.status,
        createdAt: p.created_at,
        verifiedAt: p.verified_at,
      };
    });

    return { success: true, history };
  }
}
