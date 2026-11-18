import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from './wallet.service.js';
import { TransactionType } from '@prisma/client';

describe('WalletService', () => {
  let walletService: WalletService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      wallet: {
        findUnique: vi.fn(),
      },
      walletTransaction: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
    };

    walletService = new WalletService(prismaMock);
  });

  it('devrait calculer correctement le solde en additionnant les crédits et soustrayant les débits', async () => {
    prismaMock.walletTransaction.findMany.mockResolvedValue([
      { amount: '50.00', type: TransactionType.CREDIT },
      { amount: '20.00', type: TransactionType.DEBIT },
      { amount: '10.50', type: TransactionType.CREDIT },
    ]);

    const balance = await walletService.calculateBalance(1);
    expect(balance).toBe(40.5);
  });

  it('devrait retourner le portefeuille avec le solde calculé', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      userId: 5,
      currency: 'USD',
      transactions: [],
    });

    prismaMock.walletTransaction.findMany.mockResolvedValue([
      { amount: '100.00', type: TransactionType.CREDIT },
    ]);

    const result = await walletService.getWalletByUserId(5);
    expect(result.id).toBe(1);
    expect(result.balance).toBe(100);
  });
});
