import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).services.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(id: string) {
    let service = await (this.prisma as any).services.findUnique({
      where: { id },
    });

    if (!service) {
      service = await (this.prisma as any).services.findUnique({
        where: { service_id: id },
      });
    }

    if (!service) {
      throw new NotFoundException(`Service with ID or Slug "${id}" not found`);
    }

    return service;
  }
}
