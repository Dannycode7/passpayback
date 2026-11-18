import { Currency } from '@prisma/client';

export class InitiateDepositDto {
  amount!: number;
  currency?: Currency;
  phone!: string;
  channel?: string;
  description?: string;
}
