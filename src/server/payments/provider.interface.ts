// Payment Provider Abstraction Layer Interface for BUKKIT Marketplace

export interface PaymentMetadata {
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  food_subtotal: number;
  company_fee: number;
  rider_fee: number;
  customer_total: number;
  custom_fields?: Array<{
    display_name: string;
    variable_name: string;
    value: string | number;
  }>;
  [key: string]: any;
}

export interface PaymentInitParams {
  email: string;
  amount: number; // in kobo (e.g. 235000 for ₦2,350)
  reference: string;
  callback_url?: string;
  metadata: PaymentMetadata;
  currency?: string; // 'NGN'
  channels?: string[]; // ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
}

export interface PaymentInitResult {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
    configured: boolean;
  };
  error?: string;
}

export interface PaymentVerifyResult {
  status: boolean;
  message: string;
  data?: {
    id: number | string;
    reference: string;
    amount: number; // in kobo
    currency: string;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    gateway_response?: string;
    paid_at?: string;
    created_at?: string;
    channel?: string;
    ip_address?: string;
    fees?: number; // fee in kobo returned from Paystack
    customer?: {
      id?: number;
      email?: string;
      customer_code?: string;
      phone?: string;
    };
    metadata?: PaymentMetadata;
  };
  error?: string;
}

export interface WebhookProcessResult {
  valid: boolean;
  event?: string;
  reference?: string;
  data?: any;
  error?: string;
}

export interface RefundParams {
  transaction_id_or_reference: string;
  amount?: number; // optional partial refund amount in kobo
  currency?: string;
  customer_note?: string;
  merchant_note?: string;
}

export interface RefundResult {
  status: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  initializePayment(params: PaymentInitParams): Promise<PaymentInitResult>;
  verifyPayment(reference: string): Promise<PaymentVerifyResult>;
  handleWebhook(body: any, rawBody: string | Buffer, signature: string): Promise<WebhookProcessResult>;
  refundPayment(params: RefundParams): Promise<RefundResult>;
  getTransaction(reference: string): Promise<any>;
  calculateFee(amountInNaira: number): number;
}
