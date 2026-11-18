import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Currency,
  DepositMethod,
  DepositStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { MAISHAPAY_CONSTANTS } from './maishapay.constants.js';
import type {
  MaishaPayConfig,
  MaishaPayPaymentApiResponse,
  MaishaPayPaymentPayload,
  MaishaPayVerificationResponse,
} from './interfaces/maishapay.interface.js';
import { InitiateDepositDto } from './dto/initiate-deposit.dto.js';
import { MaishaPayWebhookDto } from './dto/maishapay-webhook.dto.js';

@Injectable()
export class MaishaPayService {
  private readonly logger = new Logger(MaishaPayService.name);
  private readonly config: MaishaPayConfig;
  private readonly gatewayMode: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {
    const apiKey = this.configService.get<string>('MAISHAPAY_API_KEY') || '';
    const apiSecret =
      this.configService.get<string>('MAISHAPAY_SECRET_KEY') || '';
    const env = this.configService.get<string>('MAISHAPAY_ENV') || 'sandbox';

    // Détection automatique du mode : Sandbox (0) ou Live (1)
    const isLive =
      env === 'production' ||
      apiKey.startsWith('MP-LIVEPK-') ||
      this.configService.get<string>('NODE_ENV') === 'production';

    this.gatewayMode = isLive
      ? MAISHAPAY_CONSTANTS.GATEWAY_MODE.LIVE
      : MAISHAPAY_CONSTANTS.GATEWAY_MODE.SANDBOX;

    // =========================================================================
    // 📍 1. CONFIGURATION DES CLÉS D'API MAISHAPAY
    // - MAISHAPAY_API_KEY (Public Key: MP-SBPK-... ou MP-LIVEPK-...)
    // - MAISHAPAY_SECRET_KEY (Secret Key: MP-SBSK-... ou MP-LIVESK-...)
    // =========================================================================
    this.config = {
      apiKey,
      apiSecret,
      merchantKey: this.configService.get<string>('MAISHAPAY_MERCHANT_KEY') || '',
      baseUrl:
        this.configService.get<string>('MAISHAPAY_BASE_URL') ||
        MAISHAPAY_CONSTANTS.BASE_URL,
      callbackUrl:
        this.configService.get<string>('MAISHAPAY_CALLBACK_URL') ||
        'https://api.votredomaine.com/maishapay/webhook',
      returnUrl:
        this.configService.get<string>('MAISHAPAY_RETURN_URL') ||
        'https://app.votredomaine.com/wallet',
      isLive,
    };

    this.logger.log(
      `MaishaPay initialisé en mode ${isLive ? 'PRODUCTION (gatewayMode: 1)' : 'SANDBOX (gatewayMode: 0)'}. Clé publique: ${apiKey ? apiKey.substring(0, 16) + '...' : 'NON DÉFINIE'}`,
    );
  }

  // ===========================================================================
  // 📍 2. INITIALISATION DU DÉPÔT / PAIEMENT (COLLECTE MOBILE MONEY & CARTES)
  // ===========================================================================

  async initiateDeposit(
    userId: number,
    dto: InitiateDepositDto,
  ): Promise<{
    message: string;
    depositRequest: any;
    maishapayResponse: MaishaPayPaymentApiResponse;
  }> {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException(
        'Le montant du dépôt doit être supérieur à zéro.',
      );
    }

    if (!dto.phone) {
      throw new BadRequestException(
        'Le numéro de téléphone Mobile Money est obligatoire.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        profile: true,
      },
    });

    if (!user || !user.wallet) {
      throw new NotFoundException('Utilisateur ou portefeuille introuvable.');
    }

    const currency = dto.currency || user.wallet.currency || Currency.USD;

    // Génération d'une référence unique pour la transaction
    const timestamp = Date.now();
    const randomHex = Math.floor(Math.random() * 100000)
      .toString(16)
      .toUpperCase();
    const reference = `PASS-DEP-${timestamp}-${randomHex}`;

    // 1. Enregistrement en base de données de la demande de dépôt (PENDING)
    const depositRequest = await this.prisma.depositRequest.create({
      data: {
        userId,
        amount,
        currency,
        method: DepositMethod.MOBILE_MONEY,
        reference,
        status: DepositStatus.PENDING,
      },
    });

    // 2. Préparation du payload officiel MaishaPay
    const customerFullName =
      user.profile?.username || user.email.split('@')[0] || 'Client PassPayback';

    const paymentPayload: MaishaPayPaymentPayload = {
      reference,
      amount,
      currency,
      phone: dto.phone,
      email: user.email,
      customerName: customerFullName,
      description:
        dto.description ||
        `Recharge portefeuille PassPayback #${depositRequest.id}`,
      channel: dto.channel || MAISHAPAY_CONSTANTS.CHANNELS.MPESA,
      callbackUrl: this.config.callbackUrl,
      returnUrl: this.config.returnUrl,
    };

    // 3. Appel de l'API MaishaPay (Place réservée ci-dessous)
    const maishapayResponse = await this.callMaishaPayPaymentApi(paymentPayload);

    return {
      message: 'Demande de dépôt initiée avec succès.',
      depositRequest,
      maishapayResponse,
    };
  }

  /**
   * =========================================================================
   * 📍 EMPLACEMENT RÉSERVÉ : APPEL HTTP VERS L'API MAISHAPAY
   * Endpoint officiel : POST https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant
   * =========================================================================
   */
  async callMaishaPayPaymentApi(
    payload: MaishaPayPaymentPayload,
  ): Promise<MaishaPayPaymentApiResponse> {
    this.logger.log(
      `[MaishaPay] Envoi de la requête de paiement - Réf: ${payload.reference}, Montant: ${payload.amount} ${payload.currency}, Tél: ${payload.phone}`,
    );

    // Si les clés d'API ne sont pas configurées :
    if (!this.config.apiKey || !this.config.apiSecret) {
      this.logger.warn(
        '⚠️ Aucune clé MaishaPay configurée. Réponse simulée.',
      );
      return {
        success: true,
        message: 'Mode simulation actif. Veuillez configurer vos clés dans le .env',
        transactionId: `SIM-${Date.now()}`,
        paymentUrl: `${MAISHAPAY_CONSTANTS.CHECKOUT_URL}?ref=${payload.reference}`,
        status: MAISHAPAY_CONSTANTS.STATUS.PENDING,
        raw: { simulatedPayload: payload },
      };
    }

    try {
      const endpoint = MAISHAPAY_CONSTANTS.REST_PAYMENT_ENDPOINT;

      // Payload JSON officiel requis par l'API MaishaPay
      const requestBody = {
        gatewayMode: this.gatewayMode,
        publicApiKey: this.config.apiKey,
        secretApiKey: this.config.apiSecret,
        transactionReference: payload.reference,
        amount: payload.amount,
        currency: payload.currency,
        customerFullName: payload.customerName || 'Client PassPayback',
        customerPhoneNumber: payload.phone,
        customerEmailAdress: payload.email,
        callbackUrl: payload.callbackUrl,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawText: responseText };
      }

      if (!response.ok) {
        this.logger.error(
          `[MaishaPay] Échec de la requête HTTP (${response.status}): ${responseText}`,
        );
        throw new InternalServerErrorException(
          `Erreur MaishaPay (${response.status}): ${responseText}`,
        );
      }

      this.logger.log(`[MaishaPay] Réponse reçue :`, responseData);

      const transactionId =
        responseData.transaction_id ||
        responseData.transactionId ||
        responseData.id ||
        payload.reference;

      const paymentUrl =
        responseData.payment_url ||
        responseData.paymentUrl ||
        responseData.checkout_url ||
        `${MAISHAPAY_CONSTANTS.CHECKOUT_URL}?ref=${payload.reference}`;

      return {
        success: true,
        transactionId,
        paymentUrl,
        status:
          responseData.status ||
          responseData.status_code ||
          MAISHAPAY_CONSTANTS.STATUS.PENDING,
        raw: responseData,
      };
    } catch (error: any) {
      this.logger.error('[MaishaPay] Erreur lors de l’appel API :', error);
      throw new InternalServerErrorException(
        error?.message ||
          'Impossible de joindre la passerelle de paiement MaishaPay.',
      );
    }
  }

  // ===========================================================================
  // 📍 3. VÉRIFICATION D'UNE TRANSACTION
  // ===========================================================================

  async verifyTransaction(
    reference: string,
  ): Promise<MaishaPayVerificationResponse> {
    const deposit = await this.prisma.depositRequest.findFirst({
      where: { reference },
      include: {
        user: { include: { wallet: true } },
      },
    });

    if (!deposit) {
      throw new NotFoundException(
        `Aucune demande de dépôt trouvée pour la référence ${reference}.`,
      );
    }

    // Si déjà validé en base locale
    if (deposit.status === DepositStatus.APPROVED) {
      return {
        reference,
        status: MAISHAPAY_CONSTANTS.STATUS.SUCCESS,
        amount: Number(deposit.amount),
        currency: deposit.currency,
        isPaid: true,
      };
    }

    /**
     * =======================================================================
     * 📍 EMPLACEMENT RÉSERVÉ : REQUÊTE DE STATUT VERS L'API MAISHAPAY
     * =======================================================================
     */
    let isPaid = false;
    let transactionStatus: string = MAISHAPAY_CONSTANTS.STATUS.PENDING;
    let rawResult: any = null;

    if (this.config.apiKey && this.config.apiSecret) {
      try {
        const checkUrl = `${this.config.baseUrl}/payment/rest/vers1.0/merchant/status`;
        const response = await fetch(checkUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            gatewayMode: this.gatewayMode,
            publicApiKey: this.config.apiKey,
            secretApiKey: this.config.apiSecret,
            transactionReference: reference,
          }),
        });

        if (response.ok) {
          rawResult = await response.json();
          transactionStatus =
            rawResult.status ||
            rawResult.transaction_status ||
            MAISHAPAY_CONSTANTS.STATUS.PENDING;

          const statusUpper = String(transactionStatus).toUpperCase();
          isPaid =
            statusUpper === 'SUCCESS' ||
            statusUpper === 'COMPLETED' ||
            statusUpper === 'PAID' ||
            rawResult.paid === true ||
            rawResult.is_paid === true;
        }
      } catch (err) {
        this.logger.error(
          `[MaishaPay] Erreur lors de la vérification de ${reference} :`,
          err,
        );
      }
    }

    // Si le paiement est confirmé, nous créditons automatiquement le portefeuille
    if (isPaid && deposit.status === DepositStatus.PENDING) {
      await this.approveDepositAndCreditWallet(
        deposit.id,
        rawResult?.transaction_id || rawResult?.id,
      );
    }

    return {
      reference,
      status: transactionStatus,
      amount: Number(deposit.amount),
      currency: deposit.currency,
      isPaid,
      raw: rawResult,
    };
  }

  // ===========================================================================
  // 📍 4. TRAITEMENT DU WEBHOOK (IPN) & CRÉDIT AUTOMATIQUE DU PORTEFEUILLE
  // ===========================================================================

  async handleWebhook(payload: MaishaPayWebhookDto) {
    this.logger.log('[MaishaPay Webhook] Notification reçue :', payload);

    const reference =
      payload.transactionReference ||
      payload.reference ||
      payload.order_id ||
      payload.transaction_id;

    if (!reference) {
      this.logger.warn('Webhook MaishaPay reçu sans référence de commande.');
      return { status: 'ignored', reason: 'Référence manquante' };
    }

    const deposit = await this.prisma.depositRequest.findFirst({
      where: { reference },
      include: {
        user: { include: { wallet: true } },
      },
    });

    if (!deposit) {
      this.logger.warn(
        `Webhook MaishaPay : Référence introuvable en base (${reference}).`,
      );
      return { status: 'not_found', reference };
    }

    // Protection contre les doubles traitements (Idempotence)
    if (deposit.status === DepositStatus.APPROVED) {
      this.logger.log(`Dépôt ${reference} déjà approuvé précédemment.`);
      return { status: 'already_processed', reference };
    }

    const statusStr = (
      payload.status ||
      payload.transaction_status ||
      ''
    ).toUpperCase();

    const isSuccess =
      statusStr === 'SUCCESS' ||
      statusStr === 'COMPLETED' ||
      statusStr === 'PAID' ||
      payload.success === true ||
      payload.gatewayStatus === 'SUCCESS';

    if (isSuccess) {
      await this.approveDepositAndCreditWallet(
        deposit.id,
        payload.transaction_id || payload.id,
      );
      this.logger.log(
        `✅ Portefeuille crédité avec succès pour le dépôt ${reference} (+${deposit.amount.toString()} ${deposit.currency}).`,
      );
      return { status: 'success', reference };
    } else if (
      statusStr === 'FAILED' ||
      statusStr === 'CANCELLED' ||
      statusStr === 'REJECTED'
    ) {
      await this.prisma.depositRequest.update({
        where: { id: deposit.id },
        data: { status: DepositStatus.REJECTED },
      });
      return { status: 'rejected', reference };
    }

    return { status: 'pending', reference };
  }

  /**
   * Valide le dépôt et crédite atomiquement le portefeuille dans une transaction Prisma
   */
  private async approveDepositAndCreditWallet(
    depositRequestId: number,
    externalTransactionId?: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const deposit = await tx.depositRequest.findUnique({
        where: { id: depositRequestId },
        include: {
          user: { include: { wallet: true } },
        },
      });

      if (!deposit || deposit.status === DepositStatus.APPROVED) {
        return;
      }

      if (!deposit.user.wallet) {
        throw new InternalServerErrorException(
          'Portefeuille utilisateur non configuré.',
        );
      }

      // 1. Mise à jour de la demande de dépôt
      await tx.depositRequest.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.APPROVED,
          reference: externalTransactionId
            ? `${deposit.reference} (MaishaPay: ${externalTransactionId})`
            : deposit.reference,
        },
      });

      // 2. Enregistrement de la transaction de crédit sur le portefeuille
      await tx.walletTransaction.create({
        data: {
          userId: deposit.userId,
          walletId: deposit.user.wallet.id,
          depositRequestId: deposit.id,
          amount: deposit.amount,
          currency: deposit.currency,
          type: TransactionType.CREDIT,
          description: `Recharge portefeuille via MaishaPay Mobile Money (Réf: ${deposit.reference})`,
        },
      });
    });
  }

  // ===========================================================================
  // 📍 5. RETRAITS / PAIEMENT SORTANT (DISBURSEMENT / B2C)
  // ===========================================================================

  async initiatePayout(params: {
    userId: number;
    amount: number;
    currency: Currency;
    phone: string;
    channel?: string;
  }) {
    const { userId, amount, currency, phone, channel } = params;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      throw new NotFoundException('Utilisateur ou portefeuille introuvable.');
    }

    const currentBalance = await this.walletService.calculateBalance(
      user.wallet.id,
    );

    if (currentBalance < amount) {
      throw new BadRequestException(
        `Solde insuffisant (${currentBalance} ${currency}) pour effectuer un retrait de ${amount} ${currency}.`,
      );
    }

    this.logger.log(
      `[MaishaPay Retrait] Transfert vers ${phone} pour un montant de ${amount} ${currency}`,
    );

    // Débit du portefeuille pour réserver les fonds
    return await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          walletId: user.wallet!.id,
          amount,
          currency,
          type: TransactionType.DEBIT,
          description: `Demande de retrait Mobile Money vers ${phone} (${channel || 'Mobile Money'})`,
        },
      });

      return {
        message: 'Demande de retrait enregistrée.',
        transaction,
      };
    });
  }

  /**
   * Récupère l'historique des demandes de dépôt de l'utilisateur
   */
  async getUserDeposits(userId: number) {
    return await this.prisma.depositRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: true,
      },
    });
  }
}
