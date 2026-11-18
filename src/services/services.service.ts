import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste tous les services actifs avec leurs plans actifs disponibles
   */
  async getActiveServices() {
    return await this.prisma.service.findMany({
      where: { isActive: true },
      include: {
        plans: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Récupère un service par son identifiant unique (slug)
   */
  async getServiceBySlug(slug: string) {
    const service = await this.prisma.service.findUnique({
      where: { slug },
      include: {
        plans: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service avec le slug "${slug}" introuvable.`);
    }

    return service;
  }

  /**
   * Récupère un plan spécifique par son identifiant
   */
  async getPlanById(planId: number) {
    const plan = await this.prisma.servicePlan.findUnique({
      where: { id: planId },
      include: {
        service: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan d'abonnement ${planId} introuvable.`);
    }

    return plan;
  }
}
