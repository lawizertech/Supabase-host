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
import { DocumentsModule } from './documents/documents.module';
import { CloudinaryModule } from './storage/cloudinary.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';

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
    DocumentsModule,
    CloudinaryModule,
    MeetingsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
