import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le portefeuille d'un utilisateur et calcule son solde en temps réel
   * à partir du grand livre (ledger) des transactions.
   */
  async getWalletByUserId(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable.');
    }

    const balance = await this.calculateBalance(wallet.id);

    return {
      ...wallet,
      balance,
    };
  }

  /**
   * Calcule le solde actuel d'un portefeuille
   */
  async calculateBalance(walletId: number): Promise<number> {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId },
      select: {
        amount: true,
        type: true,
      },
    });

    const balance = transactions.reduce((acc, tx) => {
      const amount = Number(tx.amount);
      if (tx.type === TransactionType.CREDIT || tx.type === TransactionType.REFUND) {
        return acc + amount;
      }
      if (tx.type === TransactionType.DEBIT) {
        return acc - amount;
      }
      return acc;
    }, 0);

    return Math.round(balance * 100) / 100;
  }

  /**
   * Récupère l'historique complet des transactions avec pagination
   */
  async getTransactions(userId: number, limit = 20, offset = 0) {
    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.walletTransaction.count({
        where: { userId },
      }),
    ]);

    return {
      total,
      limit,
      offset,
      transactions,
    };
  }

  /**
   * Enregistre un crédit sur le portefeuille (dépôt validé, remboursement, etc.)
   */
  async credit(params: {
    userId: number;
    walletId: number;
    amount: number;
    currency: Currency;
    description?: string;
    depositRequestId?: number;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à zéro.');
    }

    return await this.prisma.walletTransaction.create({
      data: {
        userId: params.userId,
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        type: TransactionType.CREDIT,
        description: params.description || 'Crédit portefeuille',
        depositRequestId: params.depositRequestId,
      },
    });
  }

  /**
   * Enregistre un débit sur le portefeuille (achat de pass, commande, etc.)
   */
  async debit(params: {
    userId: number;
    walletId: number;
    amount: number;
    currency: Currency;
    description?: string;
    orderId?: number;
    assistanceRequestId?: number;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à zéro.');
    }

    const currentBalance = await this.calculateBalance(params.walletId);
    if (currentBalance < params.amount) {
      throw new BadRequestException(
        `Solde insuffisant (${currentBalance} ${params.currency}) pour effectuer cette opération de ${params.amount} ${params.currency}.`,
      );
    }

    return await this.prisma.walletTransaction.create({
      data: {
        userId: params.userId,
        walletId: params.walletId,
        amount: params.amount,
        currency: params.currency,
        type: TransactionType.DEBIT,
        description: params.description || 'Débit portefeuille',
        orderId: params.orderId,
        assistanceRequestId: params.assistanceRequestId,
      },
    });
  }
}
