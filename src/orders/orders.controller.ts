import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator.js';

@Controller('orders')
@UseGuards(SupabaseAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Passer une commande pour un plan d'abonnement
   */
  @Post()
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return await this.ordersService.createOrder(user.id, dto);
  }

  /**
   * Liste des commandes de l'utilisateur
   */
  @Get()
  async getMyOrders(@CurrentUser() user: AuthenticatedUser) {
    return await this.ordersService.getMyOrders(user.id);
  }

  /**
   * Détail d'une commande
   */
  @Get(':id')
  async getOrderById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.ordersService.getOrderById(user.id, id);
  }
}
