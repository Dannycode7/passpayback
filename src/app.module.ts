import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { ServicesModule } from './services/services.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { MaishaPayModule } from './maishapay/maishapay.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    WalletModule,
    ServicesModule,
    OrdersModule,
    MaishaPayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
