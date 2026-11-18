import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaishaPayService } from './maishapay.service.js';
import { DepositStatus } from '@prisma/client';

describe('MaishaPayService', () => {
  let maishaPayService: MaishaPayService;
  let configServiceMock: any;
  let prismaMock: any;
  let walletServiceMock: any;

  beforeEach(() => {
    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'MAISHAPAY_API_KEY') return 'test_api_key';
        if (key === 'MAISHAPAY_SECRET_KEY') return 'test_secret_key';
        return undefined;
      }),
    };

    prismaMock = {
      user: {
        findUnique: vi.fn(),
      },
      depositRequest: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      walletTransaction: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };

    walletServiceMock = {
      calculateBalance: vi.fn().mockResolvedValue(50),
    };

    maishaPayService = new MaishaPayService(
      configServiceMock,
      prismaMock,
      walletServiceMock,
    );
  });

  it('devrait initier une demande de dépôt avec statut PENDING', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'client@example.com',
      wallet: { id: 10, currency: 'USD' },
    });

    prismaMock.depositRequest.create.mockResolvedValue({
      id: 100,
      userId: 1,
      amount: '20.00',
      currency: 'USD',
      method: 'MOBILE_MONEY',
      reference: 'PASS-DEP-TEST',
      status: DepositStatus.PENDING,
    });

    // Mock the external fetch call inside callMaishaPayPaymentApi
    vi.spyOn(maishaPayService, 'callMaishaPayPaymentApi').mockResolvedValue({
      success: true,
      transactionId: 'TX-MAISHA-123',
      paymentUrl: 'https://checkout.maishapay.online/pay',
      status: 'PENDING',
    });

    const result = await maishaPayService.initiateDeposit(1, {
      amount: 20,
      phone: '+243810000000',
      description: 'Recharge compte',
    });

    expect(result.depositRequest.id).toBe(100);
    expect(result.maishapayResponse.paymentUrl).toBe(
      'https://checkout.maishapay.online/pay',
    );
    expect(prismaMock.depositRequest.create).toHaveBeenCalled();
  });

  it('devrait valider et créditer le portefeuille lors de la réception d’un webhook réussi', async () => {
    prismaMock.depositRequest.findFirst.mockResolvedValue({
      id: 100,
      reference: 'REF-123',
      amount: '30.00',
      currency: 'USD',
      userId: 1,
      status: DepositStatus.PENDING,
      user: {
        wallet: { id: 10 },
      },
    });

    prismaMock.depositRequest.findUnique.mockResolvedValue({
      id: 100,
      reference: 'REF-123',
      amount: '30.00',
      currency: 'USD',
      userId: 1,
      status: DepositStatus.PENDING,
      user: {
        wallet: { id: 10 },
      },
    });

    const webhookResult = await maishaPayService.handleWebhook({
      reference: 'REF-123',
      transaction_id: 'TX-999',
      status: 'SUCCESS',
    });

    expect(webhookResult.status).toBe('success');
    expect(prismaMock.depositRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: expect.objectContaining({ status: DepositStatus.APPROVED }),
      }),
    );
    expect(prismaMock.walletTransaction.create).toHaveBeenCalled();
  });
});
