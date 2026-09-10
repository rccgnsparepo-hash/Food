// Authoritative Server-Side Payment Gateway Configuration

export interface PaymentConfigStatus {
  provider: string;
  configured: boolean;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
  hasWebhookSecret: boolean;
  callbackUrl: string;
  baseUrl: string;
  mode: 'live' | 'test' | 'unconfigured';
}

export function getPaymentConfig() {
  const secretKey = (process.env.PAYSTACK_SECRET_KEY || 'sk_test_dbaad1b5934808acced323131ad77f848f15ea40').trim();
  const publicKey = (process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_1928a4de3c55bc8997375c893f852fd7e7a8192b').trim();
  const webhookSecret = (process.env.PAYSTACK_WEBHOOK_SECRET || '').trim();
  const callbackUrl = (process.env.PAYSTACK_CALLBACK_URL || '').trim();
  const baseUrl = (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim();

  const isConfigured = secretKey.length > 0;
  const isTest = secretKey.startsWith('sk_test_') || publicKey.startsWith('pk_test_');

  return {
    secretKey,
    publicKey,
    webhookSecret,
    callbackUrl,
    baseUrl,
    isConfigured,
    mode: isConfigured ? (isTest ? 'test' : 'live') : 'unconfigured'
  };
}

export function getPaymentConfigStatus(): PaymentConfigStatus {
  const cfg = getPaymentConfig();
  return {
    provider: 'paystack',
    configured: cfg.isConfigured,
    hasSecretKey: Boolean(cfg.secretKey),
    hasPublicKey: Boolean(cfg.publicKey),
    hasWebhookSecret: Boolean(cfg.webhookSecret),
    callbackUrl: cfg.callbackUrl,
    baseUrl: cfg.baseUrl,
    mode: cfg.mode as 'live' | 'test' | 'unconfigured'
  };
}
