import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessStatus, OrderStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Crée une commande pour un plan d'abonnement en débitant le portefeuille de l'utilisateur
   */
  async createOrder(userId: number, dto: CreateOrderDto) {
    const { planId } = dto;

    if (!planId) {
      throw new BadRequestException('L’identifiant du plan est requis.');
    }

    const plan = await this.prisma.servicePlan.findUnique({
      where: { id: planId },
      include: { service: true },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan introuvable ou inactif.');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille utilisateur introuvable.');
    }

    const price = Number(plan.price);
    const balance = await this.walletService.calculateBalance(wallet.id);

    if (balance < price) {
      throw new BadRequestException(
        `Solde insuffisant (${balance} ${plan.currency}). Ce plan coûte ${price} ${plan.currency}. Veuillez recharger votre compte.`,
      );
    }

    // Exécution transactionnelle : création de la commande, débit et génération de l'accès
    return await this.prisma.$transaction(async (tx) => {
      // 1. Création de la commande
      const order = await tx.order.create({
        data: {
          userId,
          planId,
          amount: plan.price,
          currency: plan.currency,
          status: OrderStatus.PENDING,
        },
      });

      // 2. Débit du portefeuille
      await tx.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          orderId: order.id,
          amount: plan.price,
          currency: plan.currency,
          type: TransactionType.DEBIT,
          description: `Achat d'abonnement : ${plan.service.name} - ${plan.name}`,
        },
      });

      // 3. Création de la concession d'accès (AccessGrant)
      const expiresAt = plan.durationDays
        ? new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)
        : null;

      const accessGrant = await tx.accessGrant.create({
        data: {
          userId,
          orderId: order.id,
          status: AccessStatus.ACTIVE,
          expiresAt,
          instructions: `Accès activé pour ${plan.service.name}. Vos identifiants vous parviendront sous peu.`,
        },
      });

      return {
        message: 'Commande validée et payée avec succès via votre portefeuille.',
        order: {
          ...order,
          accessGrant,
        },
      };
    });
  }

  /**
   * Liste les commandes d'un utilisateur avec les détails de service et d'accès
   */
  async getMyOrders(userId: number) {
    return await this.prisma.order.findMany({
      where: { userId },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        accessGrant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Détail d'une commande spécifique
   */
  async getOrderById(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        plan: {
          include: {
            service: true,
          },
        },
        accessGrant: true,
        transactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }

    return order;
  }
}
