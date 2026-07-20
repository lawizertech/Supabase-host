import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { AuthModule } from './auth/auth.module';
import { CasesModule } from './cases/cases.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { ExpertModule } from './expert/expert.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ServicesModule,
    AuthModule,
    CasesModule,
    PaymentsModule,
    AdminModule,
    ExpertModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
