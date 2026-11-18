import { Currency } from '@prisma/client';

/**
 * Configuration des clés marchandes MaishaPay
 */
export interface MaishaPayConfig {
  apiKey: string;
  apiSecret: string;
  merchantKey?: string;
  baseUrl: string;
  callbackUrl?: string;
  returnUrl?: string;
  isLive: boolean;
}

/**
 * Données nécessaires pour initier un paiement / dépôt vers MaishaPay
 */
export interface MaishaPayPaymentPayload {
  reference: string;
  amount: number;
  currency: Currency;
  phone: string;
  email?: string;
  customerName?: string;
  description?: string;
  channel?: string;
  callbackUrl?: string;
  returnUrl?: string;
}

/**
 * Structure de la réponse renvoyée par l'API MaishaPay lors de l'initiation
 */
export interface MaishaPayPaymentApiResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  paymentUrl?: string;
  status: string;
  raw?: any;
}

/**
 * Structure de la réponse de vérification d'une transaction
 */
export interface MaishaPayVerificationResponse {
  reference: string;
  transactionId?: string;
  status: string;
  amount: number;
  currency: string;
  isPaid: boolean;
  raw?: any;
}
