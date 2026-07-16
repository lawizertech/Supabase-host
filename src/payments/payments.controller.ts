import { Controller, Post, Get, Body, Headers, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthService } from '../auth/auth.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
  ) {}

  @Post('verify')
  async verifyPayment(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      processCode: string;
    },
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }

    const token = authHeader.replace('Bearer ', '');
    // Verify token with Supabase to make sure user is logged in
    await this.authService.verifySupabaseToken(token);

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, processCode } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !processCode) {
      throw new BadRequestException('Missing required payment verification parameters');
    }

    return this.paymentsService.verifyPayment(
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      processCode,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('x-razorpay-signature missing');
    }
    if (!req.rawBody) {
      throw new UnauthorizedException('Raw request body missing');
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Get('history')
  async getPaymentHistory(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization token missing');
    }
    const token = authHeader.replace('Bearer ', '');
    const userData = await this.authService.verifySupabaseToken(token);
    return this.paymentsService.getPaymentHistory(userData.id);
  }
}
