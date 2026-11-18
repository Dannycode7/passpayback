export class MaishaPayWebhookDto {
  reference?: string;
  order_id?: string;
  transaction_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  signature?: string;
  [key: string]: any;
}
