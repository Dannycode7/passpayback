import { Module } from '@nestjs/common';
import { MaishaPayService } from './maishapay.service.js';
import { MaishaPayController } from './maishapay.controller.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [WalletModule, AuthModule],
  controllers: [MaishaPayController],
  providers: [MaishaPayService],
  exports: [MaishaPayService],
})
export class MaishaPayModule {}
