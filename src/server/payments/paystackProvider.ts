import crypto from 'crypto';
import {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyResult,
  WebhookProcessResult,
  RefundParams,
  RefundResult
} from './provider.interface';
import { getPaymentConfig } from './paymentConfig';

export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';

  isConfigured(): boolean {
    const { secretKey } = getPaymentConfig();
    return Boolean(secretKey && secretKey.length > 5);
  }

  /**
   * Calculates estimated Paystack processing fee for local NGN transactions.
   * Standard local rate: 1.5% + ₦100 (waived for transactions below ₦2,500, capped at ₦2,000).
   * E.g. for ₦2,350: 1.5% * 2,350 = ₦35.25.
   */
  calculateFee(amountInNaira: number): number {
    if (amountInNaira <= 0) return 0;
    const baseFee = amountInNaira * 0.015;
    const flatFee = amountInNaira < 2500 ? 0 : 100;
    const totalFee = baseFee + flatFee;
    return Math.min(2000, Number(totalFee.toFixed(2)));
  }

  /**
   * Initializes a real Paystack transaction via HTTPS.
   */
  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    const { secretKey, baseUrl, callbackUrl, isConfigured } = getPaymentConfig();

    if (!isConfigured) {
      return {
        status: false,
        message: 'Payment configuration incomplete. Paystack secret key has not yet been configured in server environment variables.',
        error: 'PAYSTACK_NOT_CONFIGURED',
        data: {
          authorization_url: '',
          access_code: '',
          reference: params.reference,
          configured: false
        }
      };
    }

    try {
      const payload: Record<string, any> = {
        email: params.email,
        amount: Math.round(params.amount), // in kobo
        reference: params.reference,
        currency: params.currency || 'NGN',
        callback_url: params.callback_url || callbackUrl || undefined,
        metadata: params.metadata
      };

      if (params.channels && params.channels.length > 0) {
        payload.channels = params.channels;
      }

      const response = await fetch(`${baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      if (!response.ok || !json.status) {
        return {
          status: false,
          message: json.message || 'Paystack initialization failed',
          error: json.message || 'INITIALIZATION_FAILED'
        };
      }

      return {
        status: true,
        message: json.message || 'Authorization URL created',
        data: {
          authorization_url: json.data?.authorization_url || '',
          access_code: json.data?.access_code || '',
          reference: json.data?.reference || params.reference,
          configured: true
        }
      };
    } catch (err: any) {
      console.error('[PAYSTACK_ERROR] Initialize payment exception:', err);
      return {
        status: false,
        message: err?.message || 'Network error communicating with Paystack',
        error: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Authoritatively verifies a Paystack transaction by reference with secret key.
   */
  async verifyPayment(reference: string): Promise<PaymentVerifyResult> {
    const { secretKey, baseUrl, isConfigured } = getPaymentConfig();

    if (!isConfigured) {
      return {
        status: false,
        message: 'Payment configuration incomplete. Paystack secret key is missing.',
        error: 'PAYSTACK_NOT_CONFIGURED'
      };
    }

    if (!reference || typeof reference !== 'string') {
      return {
        status: false,
        message: 'Invalid transaction reference provided for verification.',
        error: 'INVALID_REFERENCE'
      };
    }

    try {
      const response = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference.trim())}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      const json = await response.json();

      if (!response.ok || !json.status) {
        return {
          status: false,
          message: json.message || 'Paystack transaction verification failed',
          error: json.message || 'VERIFICATION_FAILED'
        };
      }

      const data = json.data;
      return {
        status: true,
        message: json.message || 'Verification successful',
        data: {
          id: data.id,
          reference: data.reference,
          amount: data.amount, // in kobo
          currency: data.currency,
          status: data.status, // 'success' | 'failed' | 'abandoned'
          gateway_response: data.gateway_response,
          paid_at: data.paid_at,
          created_at: data.created_at,
          channel: data.channel,
          ip_address: data.ip_address,
          fees: data.fees, // in kobo
          customer: data.customer,
          metadata: data.metadata
        }
      };
    } catch (err: any) {
      console.error('[PAYSTACK_ERROR] Verify transaction exception:', err);
      return {
        status: false,
        message: err?.message || 'Network error verifying with Paystack',
        error: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Verifies HMAC-SHA512 signature on incoming Paystack webhook.
   */
  async handleWebhook(body: any, rawBody: string | Buffer, signature: string): Promise<WebhookProcessResult> {
    const { webhookSecret, secretKey } = getPaymentConfig();
    const effectiveSecret = webhookSecret || secretKey;

    if (!effectiveSecret) {
      return {
        valid: false,
        error: 'Webhook secret is not configured on server'
      };
    }

    if (!signature) {
      return {
        valid: false,
        error: 'Missing x-paystack-signature header'
      };
    }

    try {
      const content = typeof rawBody === 'string' ? rawBody : Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(body);
      const computedHash = crypto
        .createHmac('sha512', effectiveSecret)
        .update(content)
        .digest('hex');

      if (computedHash !== signature) {
        console.warn('[PAYSTACK_SECURITY] Invalid webhook signature detected.');
        return {
          valid: false,
          error: 'Invalid webhook signature'
        };
      }

      const event = body?.event;
      const data = body?.data;
      const reference = data?.reference;

      return {
        valid: true,
        event,
        reference,
        data
      };
    } catch (err: any) {
      console.error('[PAYSTACK_ERROR] Webhook processing exception:', err);
      return {
        valid: false,
        error: err?.message || 'Webhook verification exception'
      };
    }
  }

  /**
   * Issues refund through Paystack refund endpoint.
   */
  async refundPayment(params: RefundParams): Promise<RefundResult> {
    const { secretKey, baseUrl, isConfigured } = getPaymentConfig();

    if (!isConfigured) {
      return {
        status: false,
        message: 'Payment configuration incomplete. Cannot initiate refund via Paystack.',
        error: 'PAYSTACK_NOT_CONFIGURED'
      };
    }

    try {
      const payload: Record<string, any> = {
        transaction: params.transaction_id_or_reference,
        amount: params.amount ? Math.round(params.amount) : undefined,
        currency: params.currency || 'NGN',
        customer_note: params.customer_note,
        merchant_note: params.merchant_note
      };

      const response = await fetch(`${baseUrl}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      if (!response.ok || !json.status) {
        return {
          status: false,
          message: json.message || 'Paystack refund request failed',
          error: json.message || 'REFUND_FAILED'
        };
      }

      return {
        status: true,
        message: json.message || 'Refund initiated successfully',
        data: json.data
      };
    } catch (err: any) {
      console.error('[PAYSTACK_ERROR] Refund processing exception:', err);
      return {
        status: false,
        message: err?.message || 'Network error initiating Paystack refund',
        error: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Retrieves single transaction details from Paystack.
   */
  async getTransaction(reference: string): Promise<any> {
    return this.verifyPayment(reference);
  }
}

export const paystackProvider = new PaystackProvider();
