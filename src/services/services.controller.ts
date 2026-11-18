import { Controller, Get, Param } from '@nestjs/common';
import { ServicesService } from './services.service.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * Consultation publique du catalogue des services et abonnements disponibles
   */
  @Get()
  async getCatalog() {
    return await this.servicesService.getActiveServices();
  }

  /**
   * Consultation des détails et formules d'un service donné (ex: netflix, spotify, chatgpt)
   */
  @Get(':slug')
  async getServiceBySlug(@Param('slug') slug: string) {
    return await this.servicesService.getServiceBySlug(slug);
  }
}
