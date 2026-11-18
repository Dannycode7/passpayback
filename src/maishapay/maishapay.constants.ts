/**
 * Constantes et configurations officielles pour l'intégration de la passerelle MaishaPay
 */
export const MAISHAPAY_CONSTANTS = {
  // URLs officielles de l'API MaishaPay
  BASE_URL: 'https://marchand.maishapay.online/api',
  REST_PAYMENT_ENDPOINT:
    'https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant',
  CHECKOUT_URL:
    'https://marchand.maishapay.online/payment/vers1.0/merchant/checkout',

  // Mode passerelle MaishaPay
  GATEWAY_MODE: {
    SANDBOX: 0,
    LIVE: 1,
  },

  // Canaux de paiement supportés en République Démocratique du Congo
  CHANNELS: {
    MPESA: 'MPESA', // Vodacom M-Pesa
    ORANGE_MONEY: 'ORANGE_MONEY', // Orange Money RDC
    AIRTEL_MONEY: 'AIRTEL_MONEY', // Airtel Money RDC
    AFRIMONEY: 'AFRIMONEY', // Africell Afrimoney
    CARD: 'CARD', // Visa / Mastercard
  },

  // Numéros de test officiels MaishaPay en mode Sandbox (gatewayMode: 0)
  TEST_NUMBERS: {
    SUCCESS: '+243810000001', // Paiement réussi (Simule confirmation PIN)
    INSUFFICIENT_FUNDS: '+243810000002', // Solde insuffisant
    CANCELLED: '+243810000003', // Annulation utilisateur / timeout
  },

  // Statuts de transaction
  STATUS: {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
} as const;
