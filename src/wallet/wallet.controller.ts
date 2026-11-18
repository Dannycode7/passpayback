import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';

@Controller('wallet')
@UseGuards(SupabaseAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Retourne les informations du portefeuille de l'utilisateur connecté avec son solde actuel
   */
  @Get('me')
  async getMyWallet(@CurrentUser() user: AuthenticatedUser) {
    return await this.walletService.getWalletByUserId(user.id);
  }

  /**
   * Retourne l'historique des transactions financières de l'utilisateur
   */
  @Get('transactions')
  async getMyTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return await this.walletService.getTransactions(
      user.id,
      parsedLimit,
      parsedOffset,
    );
  }
}
