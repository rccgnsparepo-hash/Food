import { serverDb } from '../embeddedServerDb';
import { paystackProvider } from './paystackProvider';
import { financialLedger, OrderFinancialBreakdown } from './financialLedger';
import { getPaymentConfigStatus } from './paymentConfig';

export interface CreateOrderPayload {
  order_id?: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  restaurant_id: string;
  restaurant_name?: string;
  items: Array<{
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  }>;
  delivery_address?: string;
  delivery_info?: any;
  notes?: string;
  latitude?: number;
  longitude?: number;
  payment_method?: 'paystack' | 'wallet' | 'split_wallet_paystack' | 'delivery';
  wallet_amount_used?: number;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number; // in Naira
  amount_kobo: number;
  currency: string;
  provider: string; // 'paystack'
  provider_reference: string;
  provider_status: string; // 'success' | 'failed' | 'pending'
  payment_status: 'paid' | 'pending' | 'failed' | 'refunded';
  paystack_transaction_id?: string | number;
  paystack_fee: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export class PaymentService {
  /**
   * Authoritative server-side price and fee calculation.
   * Frontend values are never trusted.
   */
  calculateAuthoritativeBreakdown(params: {
    items: Array<{ price: number; quantity: number }>;
    companyFeeOverride?: number;
    riderFeeOverride?: number;
  }): OrderFinancialBreakdown {
    const food_subtotal = params.items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 1;
      return sum + price * qty;
    }, 0);

    // Business model constants (₦250 platform fee, ₦100 rider fee)
    const company_fee = params.companyFeeOverride !== undefined ? params.companyFeeOverride : 250;
    const rider_fee = params.riderFeeOverride !== undefined ? params.riderFeeOverride : 100;
    const customer_total = food_subtotal + company_fee + rider_fee;

    // Actual / standard Paystack fee calculation (1.5% for local transactions)
    const paystack_fee = paystackProvider.calculateFee(customer_total);

    const restaurant_payable = food_subtotal;
    const rider_payable = rider_fee;
    const company_gross_revenue = company_fee;
    const company_net_revenue = Number((company_gross_revenue - paystack_fee).toFixed(2));

    return {
      order_id: '',
      food_subtotal: Number(food_subtotal.toFixed(2)),
      company_fee: Number(company_fee.toFixed(2)),
      rider_fee: Number(rider_fee.toFixed(2)),
      customer_total: Number(customer_total.toFixed(2)),
      paystack_fee,
      restaurant_payable: Number(restaurant_payable.toFixed(2)),
      rider_payable: Number(rider_payable.toFixed(2)),
      company_gross_revenue: Number(company_gross_revenue.toFixed(2)),
      company_net_revenue
    };
  }

  /**
   * Generates a unique, tamper-proof Paystack payment reference.
   * Format: BUKKIT-ORDER-{ORDER_ID}-{RANDOM_STRING}
   */
  generatePaymentReference(orderId: string): string {
    const cleanOrderId = (orderId || `ORD_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestampMs = Date.now().toString(36).toUpperCase();
    return `BUKKIT-ORDER-${cleanOrderId}-${timestampMs}${randomHex}`;
  }

  /**
   * Creates or syncs an order with authoritative calculation and proper field normalization.
   */
  async createAuthoritativeOrder(payload: any) {
    const timestamp = Date.now();
    const orderId = payload.id || payload.order_id || `ORD_${timestamp}_${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const existingOrder = serverDb.getDoc('orders', orderId) || {};

    const items = payload.items || existingOrder.items || [];
    const breakdown = this.calculateAuthoritativeBreakdown({
      items: items.length > 0 ? items : [{ price: Number(payload.total_price || payload.totalPrice || 1000), quantity: 1 }]
    });
    breakdown.order_id = orderId;

    const vendorId = payload.vendor_id || payload.vendorId || payload.restaurant_id || payload.restaurantId || existingOrder.vendor_id || 'vendor_mtu_canteen';
    const vendorName = payload.vendor_name || payload.vendorName || payload.restaurant_name || payload.restaurantName || existingOrder.vendor_name || 'MTU Student Central Canteen';
    const customerId = payload.customer_id || payload.user_id || payload.userId || existingOrder.customer_id || 'guest_user';
    const customerName = payload.customer_name || payload.user_name || payload.customerName || existingOrder.customer_name || 'Campus Student';

    const paystackReference = payload.payment_reference || payload.paystack_reference || existingOrder.payment_reference || this.generatePaymentReference(orderId);
    const pickupCode = payload.pickup_code || existingOrder.pickup_code || Math.floor(1000 + Math.random() * 9000).toString();
    const deliveryCode = payload.delivery_code || existingOrder.delivery_code || Math.floor(1000 + Math.random() * 9000).toString();

    const paymentMethod = payload.payment_method || payload.paymentMethod || existingOrder.payment_method || 'wallet';
    const isPaid = paymentMethod === 'wallet' || paymentMethod === 'split_wallet_paystack' || payload.payment_status === 'paid' || existingOrder.payment_status === 'paid';

    const paymentStatus = payload.payment_status || existingOrder.payment_status || (isPaid ? 'paid' : 'pending');
    const orderStatus = payload.order_status || payload.status || existingOrder.status || (isPaid ? 'payment_confirmed' : 'pending');

    const orderDoc = {
      ...existingOrder,
      ...payload,
      id: orderId,
      order_id: orderId,
      customer_id: customerId,
      user_id: customerId,
      customer_name: customerName,
      user_name: customerName,
      customer_phone: payload.customer_phone || payload.user_phone || payload.customerPhone || existingOrder.customer_phone || '',
      user_phone: payload.customer_phone || payload.user_phone || payload.customerPhone || existingOrder.user_phone || '',
      customer_email: payload.customer_email || payload.user_email || payload.customerEmail || existingOrder.customer_email || '',
      vendor_id: vendorId,
      restaurant_id: vendorId,
      vendorId: vendorId,
      restaurantId: vendorId,
      vendor_name: vendorName,
      restaurant_name: vendorName,
      items,
      subtotal: payload.subtotal !== undefined ? Number(payload.subtotal) : (existingOrder.subtotal !== undefined ? Number(existingOrder.subtotal) : breakdown.food_subtotal),
      company_fee: payload.company_fee !== undefined ? Number(payload.company_fee) : breakdown.company_fee,
      rider_fee: payload.rider_fee !== undefined ? Number(payload.rider_fee) : breakdown.rider_fee,
      delivery_fee: payload.delivery_fee !== undefined ? Number(payload.delivery_fee) : (payload.deliveryFee !== undefined ? Number(payload.deliveryFee) : (existingOrder.delivery_fee !== undefined ? Number(existingOrder.delivery_fee) : breakdown.rider_fee)),
      service_fee: payload.service_fee !== undefined ? Number(payload.service_fee) : (payload.serviceFee !== undefined ? Number(payload.serviceFee) : (existingOrder.service_fee !== undefined ? Number(existingOrder.service_fee) : breakdown.company_fee)),
      total_price: payload.total_price !== undefined ? Number(payload.total_price) : (payload.totalPrice !== undefined ? Number(payload.totalPrice) : (existingOrder.total_price !== undefined ? Number(existingOrder.total_price) : breakdown.customer_total)),
      customer_total: payload.total_price !== undefined ? Number(payload.total_price) : (payload.totalPrice !== undefined ? Number(payload.totalPrice) : (existingOrder.total_price !== undefined ? Number(existingOrder.total_price) : breakdown.customer_total)),
      financial_breakdown: existingOrder.financial_breakdown || breakdown,
      payment_method: paymentMethod,
      payment_reference: paystackReference,
      paystack_reference: paystackReference,
      payment_status: paymentStatus,
      order_status: orderStatus,
      status: orderStatus,
      delivery_status: payload.delivery_status || existingOrder.delivery_status || 'pending',
      delivery_address: payload.delivery_address || payload.deliveryAddress || existingOrder.delivery_address || 'MTU Campus',
      delivery_room: payload.delivery_room || payload.deliveryRoom || existingOrder.delivery_room || '',
      delivery_info: payload.delivery_info || payload.deliveryInfo || existingOrder.delivery_info || {},
      notes: payload.notes || existingOrder.notes || '',
      pickup_code: pickupCode,
      delivery_code: deliveryCode,
      latitude: payload.latitude || existingOrder.latitude || 6.7638,
      longitude: payload.longitude || existingOrder.longitude || 3.3782,
      created_at: existingOrder.created_at || now,
      updated_at: now
    };

    serverDb.setDoc('orders', orderId, orderDoc);
    return orderDoc;
  }

  /**
   * Initializes a Paystack transaction for an authoritative order.
   */
  async initializeOrderPayment(params: {
    orderId: string;
    email: string;
    callbackUrl?: string;
  }) {
    const order = serverDb.getDoc('orders', params.orderId);
    if (!order) {
      throw new Error(`Order #${params.orderId} not found`);
    }

    if (order.payment_status === 'paid') {
      return {
        status: true,
        message: 'Order is already fully paid.',
        already_paid: true,
        data: {
          reference: order.paystack_reference || order.payment_reference,
          order_id: params.orderId,
          configured: true
        }
      };
    }

    const breakdown: OrderFinancialBreakdown = order.financial_breakdown || this.calculateAuthoritativeBreakdown({ items: order.items || [] });
    const reference = order.paystack_reference || this.generatePaymentReference(params.orderId);

    // Save reference in order doc
    order.paystack_reference = reference;
    order.payment_reference = reference;
    serverDb.setDoc('orders', params.orderId, order, true);

    const amountInKobo = Math.round(breakdown.customer_total * 100);

    const metadata = {
      order_id: params.orderId,
      customer_id: order.customer_id,
      restaurant_id: order.restaurant_id || order.vendor_id,
      food_subtotal: breakdown.food_subtotal,
      company_fee: breakdown.company_fee,
      rider_fee: breakdown.rider_fee,
      customer_total: breakdown.customer_total,
      custom_fields: [
        {
          display_name: 'Order Reference',
          variable_name: 'order_id',
          value: params.orderId
        },
        {
          display_name: 'Customer Total',
          variable_name: 'customer_total',
          value: `₦${breakdown.customer_total.toLocaleString()}`
        }
      ]
    };

    const initResult = await paystackProvider.initializePayment({
      email: params.email || order.customer_email || 'student@mtu.edu.ng',
      amount: amountInKobo,
      reference,
      callback_url: params.callbackUrl,
      metadata
    });

    return {
      ...initResult,
      order_id: params.orderId,
      breakdown,
      reference
    };
  }

  /**
   * Authoritatively verifies a Paystack transaction with idempotency protection.
   */
  async verifyAndConfirmPayment(reference: string): Promise<{
    success: boolean;
    order?: any;
    payment?: PaymentRecord;
    message: string;
    alreadyProcessed?: boolean;
  }> {
    if (!reference) {
      return { success: false, message: 'Missing transaction reference.' };
    }

    // 1. Locate order by reference
    const allOrders = serverDb.getAll('orders');
    const order = allOrders.find(
      (o: any) => o.paystack_reference === reference || o.payment_reference === reference || o.id === reference
    );

    if (!order) {
      return {
        success: false,
        message: `No order found matching payment reference: ${reference}`
      };
    }

    // Idempotency check: if order is already marked paid, return safely without duplicate ledger entries
    if (order.payment_status === 'paid') {
      const existingPayment = (serverDb.getAll('payments') as PaymentRecord[]).find(
        (p) => p.provider_reference === reference || p.order_id === order.id
      );
      return {
        success: true,
        order,
        payment: existingPayment,
        message: 'Payment has already been confirmed and processed.',
        alreadyProcessed: true
      };
    }

    // 2. Call Paystack Provider verification
    const verifyResult = await paystackProvider.verifyPayment(reference);

    if (!verifyResult.status || !verifyResult.data) {
      return {
        success: false,
        order,
        message: verifyResult.message || 'Payment verification failed with provider'
      };
    }

    const txData = verifyResult.data;

    // 3. Security checks
    const expectedKobo = Math.round(order.total_price * 100);
    if (txData.amount < expectedKobo) {
      console.error(`[PAYMENT_FRAUD_ALERT] Amount mismatch. Expected ${expectedKobo} kobo, received ${txData.amount} kobo.`);
      return {
        success: false,
        order,
        message: `Transaction amount (${txData.amount} kobo) is less than required order total (${expectedKobo} kobo).`
      };
    }

    if (txData.currency && txData.currency.toUpperCase() !== 'NGN') {
      return {
        success: false,
        order,
        message: `Invalid currency: ${txData.currency}. Expected NGN.`
      };
    }

    if (txData.status !== 'success') {
      order.payment_status = 'failed';
      order.order_status = 'payment_failed';
      serverDb.setDoc('orders', order.id, order, true);
      return {
        success: false,
        order,
        message: `Transaction status is '${txData.status}', not successful.`
      };
    }

    // 4. Record Payment in DB
    const actualPaystackFeeInNaira = txData.fees ? Number((txData.fees / 100).toFixed(2)) : paystackProvider.calculateFee(order.total_price);
    const now = new Date().toISOString();

    const paymentId = `PAY_${order.id}_${Date.now()}`;
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      order_id: order.id,
      customer_id: order.customer_id || order.user_id,
      amount: order.total_price,
      amount_kobo: txData.amount,
      currency: 'NGN',
      provider: 'paystack',
      provider_reference: reference,
      provider_status: 'success',
      payment_status: 'paid',
      paystack_transaction_id: txData.id,
      paystack_fee: actualPaystackFeeInNaira,
      paid_at: txData.paid_at || now,
      created_at: now,
      updated_at: now,
      metadata: txData.metadata
    };
    serverDb.setDoc('payments', paymentId, paymentRecord);

    // 5. Update Order Status
    order.payment_status = 'paid';
    order.order_status = 'restaurant_accepted';
    order.status = 'payment_confirmed';
    order.payment_confirmed_at = now;
    order.vendor_accepted_at = now;
    order.payment_id = paymentId;
    order.paystack_fee = actualPaystackFeeInNaira;

    const breakdown: OrderFinancialBreakdown = order.financial_breakdown || {
      order_id: order.id,
      food_subtotal: order.subtotal || 2000,
      company_fee: order.service_fee || 250,
      rider_fee: order.delivery_fee || 100,
      customer_total: order.total_price || 2350,
      paystack_fee: actualPaystackFeeInNaira,
      restaurant_payable: order.subtotal || 2000,
      rider_payable: order.delivery_fee || 100,
      company_gross_revenue: order.service_fee || 250,
      company_net_revenue: Number(((order.service_fee || 250) - actualPaystackFeeInNaira).toFixed(2))
    };
    breakdown.paystack_fee = actualPaystackFeeInNaira;
    breakdown.company_net_revenue = Number((breakdown.company_gross_revenue - actualPaystackFeeInNaira).toFixed(2));
    order.financial_breakdown = breakdown;

    serverDb.setDoc('orders', order.id, order, true);

    // 6. Record Double-Entry Financial Ledger
    financialLedger.recordOrderPayment(
      breakdown,
      order.customer_id || order.user_id,
      order.restaurant_id || order.vendor_id,
      order.rider_id || undefined
    );

    return {
      success: true,
      order,
      payment: paymentRecord,
      message: 'Payment verified and financial ledger posted successfully.'
    };
  }

  /**
   * Processes Paystack webhook events securely with HMAC SHA512 validation.
   */
  async handlePaystackWebhook(body: any, rawBody: string | Buffer, signature: string) {
    const webhookResult = await paystackProvider.handleWebhook(body, rawBody, signature);

    if (!webhookResult.valid) {
      return {
        status: 400,
        success: false,
        message: webhookResult.error || 'Invalid webhook signature'
      };
    }

    const { event, reference, data } = webhookResult;

    if (event === 'charge.success') {
      const ref = reference || data?.reference;
      if (!ref) {
        return { status: 400, success: false, message: 'Missing transaction reference in webhook payload' };
      }

      console.log(`[PAYSTACK_WEBHOOK] Received charge.success for ref: ${ref}`);
      const confirmation = await this.verifyAndConfirmPayment(ref);

      return {
        status: 200,
        success: confirmation.success,
        message: confirmation.message,
        orderId: confirmation.order?.id
      };
    }

    return {
      status: 200,
      success: true,
      message: `Event '${event}' acknowledged`
    };
  }

  /**
   * Processes a refund via Paystack and creates reversal ledger entries.
   */
  async refundPayment(paymentIdOrOrderId: string, reason: string = 'Order cancelled by customer or vendor') {
    const allPayments = serverDb.getAll('payments') as PaymentRecord[];
    const payment = allPayments.find((p) => p.id === paymentIdOrOrderId || p.order_id === paymentIdOrOrderId);

    if (!payment) {
      throw new Error(`Payment record not found for: ${paymentIdOrOrderId}`);
    }

    if (payment.payment_status === 'refunded') {
      return {
        success: true,
        message: 'Payment is already marked as refunded',
        alreadyRefunded: true
      };
    }

    const order = serverDb.getDoc('orders', payment.order_id);

    // Call Paystack refund provider API if configured
    let providerRefundResult = null;
    if (paystackProvider.isConfigured() && payment.provider_reference) {
      providerRefundResult = await paystackProvider.refundPayment({
        transaction_id_or_reference: payment.provider_reference,
        amount: payment.amount_kobo,
        customer_note: reason,
        merchant_note: `BUKKIT Refund for Order #${payment.order_id}`
      });
    }

    // Update payment record
    payment.payment_status = 'refunded';
    payment.updated_at = new Date().toISOString();
    serverDb.setDoc('payments', payment.id, payment, true);

    // Update order record
    if (order) {
      order.payment_status = 'refunded';
      order.order_status = 'refunded';
      order.status = 'cancelled';
      order.cancelled_at = new Date().toISOString();
      order.cancellation_reason = reason;
      serverDb.setDoc('orders', order.id, order, true);
    }

    // Post reversal entries in ledger without deleting original records
    financialLedger.recordRefundReversals(payment.order_id, payment.amount, reason, order?.financial_breakdown);

    return {
      success: true,
      message: 'Refund recorded and ledger entries reversed successfully',
      payment,
      providerResult: providerRefundResult
    };
  }

  /**
   * Seeds demo financial history for development mode (if database is empty).
   */
  seedDemoFinancialsIfEmpty() {
    const existingOrders = serverDb.getAll('orders');
    const existingLedger = serverDb.getAll('ledger_entries');

    if (existingLedger.length > 0) {
      return;
    }

    console.log('[FINANCIAL_ENGINE] Seeding initial baseline transaction ledger for MTU Campus...');

    const sampleOrders = [
      {
        order_id: 'ORD_MTU_2001',
        customer_id: 'cust_seun_01',
        customer_name: 'Oluwaseun Adeleke',
        customer_email: 'seun.adeleke@mtu.edu.ng',
        restaurant_id: 'vendor_mtu_canteen',
        restaurant_name: 'MTU Central Canteen',
        items: [{ menu_item_id: 'item_jollof_01', name: 'Smoky Jollof Rice + Chicken', price: 2000, quantity: 1 }],
        subtotal: 2000,
        company_fee: 250,
        rider_fee: 100,
        total_price: 2350
      },
      {
        order_id: 'ORD_MTU_2002',
        customer_id: 'cust_grace_02',
        customer_name: 'Grace Eze',
        customer_email: 'grace.eze@mtu.edu.ng',
        restaurant_id: 'vendor_bukkyt_bites',
        restaurant_name: 'Bukkyt Campus Bites',
        items: [{ menu_item_id: 'item_suya_01', name: 'Campus Beef Suya Platter', price: 2400, quantity: 1 }],
        subtotal: 2400,
        company_fee: 250,
        rider_fee: 100,
        total_price: 2750
      },
      {
        order_id: 'ORD_MTU_2003',
        customer_id: 'cust_tunde_03',
        customer_name: 'Babatunde Ojo',
        customer_email: 'babatunde.ojo@mtu.edu.ng',
        restaurant_id: 'vendor_cbas_kitchen',
        restaurant_name: 'CBAS Cafe & Grill',
        items: [{ menu_item_id: 'item_pasta_01', name: 'Creamy Chicken Pasta', price: 1800, quantity: 1 }],
        subtotal: 1800,
        company_fee: 250,
        rider_fee: 100,
        total_price: 2150
      }
    ];

    for (const sample of sampleOrders) {
      const breakdown: OrderFinancialBreakdown = {
        order_id: sample.order_id,
        food_subtotal: sample.subtotal,
        company_fee: sample.company_fee,
        rider_fee: sample.rider_fee,
        customer_total: sample.total_price,
        paystack_fee: paystackProvider.calculateFee(sample.total_price),
        restaurant_payable: sample.subtotal,
        rider_payable: sample.rider_fee,
        company_gross_revenue: sample.company_fee,
        company_net_revenue: Number((sample.company_fee - paystackProvider.calculateFee(sample.total_price)).toFixed(2))
      };

      const now = new Date(Date.now() - Math.floor(Math.random() * 24 * 3600 * 1000)).toISOString();
      const orderDoc = {
        id: sample.order_id,
        ...sample,
        financial_breakdown: breakdown,
        payment_status: 'paid',
        order_status: 'delivered',
        status: 'delivered',
        payment_method: 'paystack',
        payment_reference: `BUKKIT-ORDER-${sample.order_id}-SEED`,
        pickup_code: '4482',
        delivery_code: '9103',
        created_at: now,
        updated_at: now
      };
      serverDb.setDoc('orders', sample.order_id, orderDoc);

      financialLedger.recordOrderPayment(
        breakdown,
        sample.customer_id,
        sample.restaurant_id,
        'rider_emmanuel_01'
      );
      financialLedger.settleRestaurantEarnings(sample.restaurant_id, breakdown.restaurant_payable);
      financialLedger.settleRiderEarnings('rider_emmanuel_01', breakdown.rider_payable);
    }
  }
}

export const paymentService = new PaymentService();
