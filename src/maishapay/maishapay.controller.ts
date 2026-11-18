import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MaishaPayService } from './maishapay.service.js';
import { InitiateDepositDto } from './dto/initiate-deposit.dto.js';
import { MaishaPayWebhookDto } from './dto/maishapay-webhook.dto.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';

@Controller('maishapay')
export class MaishaPayController {
  constructor(private readonly maishaPayService: MaishaPayService) {}

  /**
   * 1. Initier un dépôt financier via Mobile Money / Carte avec MaishaPay
   * Route protégée : Nécessite d'être connecté
   */
  @Post('deposit')
  @UseGuards(SupabaseAuthGuard)
  async initiateDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateDepositDto,
  ) {
    return await this.maishaPayService.initiateDeposit(user.id, dto);
  }

  /**
   * 2. Webhook IPN appelé par les serveurs de MaishaPay
   * Route publique : Reçoit les notifications instantanées de paiement
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: MaishaPayWebhookDto) {
    return await this.maishaPayService.handleWebhook(payload);
  }

  /**
   * 3. Vérifier l'état d'un paiement / synchroniser manuellement
   */
  @Get('verify/:reference')
  async verifyTransaction(@Param('reference') reference: string) {
    return await this.maishaPayService.verifyTransaction(reference);
  }

  /**
   * 4. Consulter l'historique des dépôts du compte connecté
   */
  @Get('deposits')
  @UseGuards(SupabaseAuthGuard)
  async getMyDeposits(@CurrentUser() user: AuthenticatedUser) {
    return await this.maishaPayService.getUserDeposits(user.id);
  }
}
