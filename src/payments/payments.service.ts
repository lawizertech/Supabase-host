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
    const secret = process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET_TEST || 'secret_placeholder';
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
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET_TEST || 'webhook_secret_placeholder';

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
}
