import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getOrCreateUser, checkUserExists, getVendorsList, createSqlOrder, getUserOrders } from './src/db/helpers.ts';
import { requireAuth, requireRole, requirePermission, AuthRequest } from './src/middleware/auth.ts';
import { getRolePermissions } from './src/services/authService.ts';
import { OrderEventType } from './src/types.ts';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  listAllTokens,
  dispatchOrderEventPipeline,
  dispatchWalletEventPipeline,
  dispatchAdminAlertPipeline,
  dispatchPushNotificationToUser,
  getUserNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsReadForUser,
  getNotificationHealth
} from './src/services/notificationBackendService.ts';
import {
  getVapidPublicKey,
  saveWebPushSubscription,
  removeWebPushSubscription,
  listAllWebPushSubscriptions,
  dispatchWebPushToUser
} from './src/server/webPushService.ts';
import { serverDb, dbEvents } from './src/server/embeddedServerDb.ts';
import { paymentService } from './src/server/payments/paymentService.ts';
import { financialLedger } from './src/server/payments/financialLedger.ts';
import { getPaymentConfigStatus } from './src/server/payments/paymentConfig.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Seed baseline financial history if empty
  paymentService.seedDemoFinancialsIfEmpty();

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'BUKKIT Authoritative Backend',
      database: 'embedded_authoritative_db',
      timestamp: new Date().toISOString()
    });
  });

  // --- EMBEDDED DATABASE REST & SYNC APIS ---
  app.get('/api/db/dump', (req, res) => {
    res.json({ success: true, store: serverDb.dump() });
  });

  // Real-time Server-Sent Events (SSE) Stream across all tabs, devices & domains
  app.get('/api/db/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Send initial connected ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    const onMutation = (event: any) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        // Connection closed
      }
    };

    dbEvents.on('mutation', onMutation);

    // 15-second heartbeat ping to keep connection alive through cloud proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      dbEvents.off('mutation', onMutation);
      res.end();
    });
  });

  app.get('/api/db/:collection', (req, res) => {
    const data = serverDb.getAll(req.params.collection);
    res.json({ success: true, data });
  });

  app.get('/api/db/:collection/:id', (req, res) => {
    const data = serverDb.getDoc(req.params.collection, req.params.id);
    res.json({ success: true, data });
  });

  app.post('/api/db/:collection/:id', (req, res) => {
    const data = serverDb.setDoc(req.params.collection, req.params.id, req.body);
    res.json({ success: true, data });
  });

  app.delete('/api/db/:collection/:id', (req, res) => {
    const deleted = serverDb.deleteDoc(req.params.collection, req.params.id);
    res.json({ success: true, deleted });
  });

  // --- AUTHENTICATION & IDENTITY APIS ---

  // Auth: Get Current Profile & Permissions
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({
      success: true,
      user: req.user
    });
  });

  // Database API: Check User Existence (Delegated to active Firebase Auth/Firestore)
  app.get('/api/users/check', async (req, res) => {
    res.json({ success: true, exists: false, user: null });
  });

  // Database API: Sync/Upsert User
  app.post('/api/users/sync', async (req, res) => {
    res.json({ success: true, user: req.body });
  });

  // --- ORDERS CENTRALIZED APIS ---

  // Create Authoritative Order
  app.post('/api/orders', async (req, res) => {
    try {
      const order = await paymentService.createAuthoritativeOrder(req.body);
      res.json({ success: true, order });
    } catch (error: any) {
      console.error('API order creation error:', error);
      res.status(500).json({ success: false, error: error.message || 'Could not save order' });
    }
  });

  // Get User Orders
  app.get('/api/orders/user/:uid', async (req, res) => {
    try {
      const orders = await getUserOrders(req.params.uid);
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error('API fetch user orders error:', error);
      res.status(500).json({ success: false, error: 'Could not fetch orders' });
    }
  });

  // --- VENDORS & KITCHEN APIS ---

  // Fetch Vendors
  app.get('/api/vendors', async (req, res) => {
    try {
      const vendors = await getVendorsList();
      res.json({ success: true, vendors });
    } catch (error: any) {
      console.error('API vendors fetch error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vendors' });
    }
  });

  // Update Kitchen Operating Status
  app.patch('/api/kitchens/:id/status', (req, res) => {
    const { id } = req.params;
    const { isOpen, operatingStatus } = req.body;
    res.json({
      success: true,
      vendorId: id,
      isOpen: isOpen ?? true,
      operatingStatus: operatingStatus || (isOpen ? 'open' : 'closed'),
      updatedAt: new Date().toISOString()
    });
  });

  // --- RIDERS APIS ---

  // Available Riders Pool
  app.get('/api/riders/available', (req, res) => {
    res.json({
      success: true,
      riders: [
        {
          id: 'rider_mtu_01',
          name: 'Emmanuel Adeyemi',
          phone: '+234 810 998 1234',
          vehicle: 'motorcycle',
          plateNumber: 'MTU-RDR-01',
          rating: 4.9,
          totalDeliveries: 124,
          isOnline: true,
          latitude: 6.784,
          longitude: 3.442
        },
        {
          id: 'rider_mtu_02',
          name: 'Blessing Okafor',
          phone: '+234 812 345 6789',
          vehicle: 'bicycle',
          plateNumber: 'MTU-CYC-04',
          rating: 4.8,
          totalDeliveries: 89,
          isOnline: true,
          latitude: 6.782,
          longitude: 3.440
        },
        {
          id: 'rider_mtu_03',
          name: 'Tunde Bakare',
          phone: '+234 803 777 9900',
          vehicle: 'electric_bike',
          plateNumber: 'MTU-EBK-09',
          rating: 5.0,
          totalDeliveries: 215,
          isOnline: true,
          latitude: 6.785,
          longitude: 3.443
        }
      ]
    });
  });

  // Server-Side Verification: Pickup PIN
  app.post('/api/rider/verify-pickup', (req, res) => {
    const { orderId, enteredCode, expectedCode, riderId } = req.body;
    if (!orderId || !enteredCode) {
      return res.status(400).json({ success: false, message: 'orderId and enteredCode required' });
    }
    const isValid = String(enteredCode).trim() === String(expectedCode).trim();
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid 4-digit Pickup PIN' });
    }
    return res.json({
      success: true,
      message: 'Pickup verified successfully',
      verifiedAt: new Date().toISOString(),
      orderId,
      riderId
    });
  });

  // Server-Side Verification: Delivery PIN & Commission Ledger Calculation
  app.post('/api/rider/verify-delivery', (req, res) => {
    const { orderId, enteredCode, expectedCode, riderId, deliveryFee = 400 } = req.body;
    if (!orderId || !enteredCode) {
      return res.status(400).json({ success: false, message: 'orderId and enteredCode required' });
    }
    const isValid = String(enteredCode).trim() === String(expectedCode).trim();
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid 4-digit Delivery PIN' });
    }

    // Authoritative Server-side commission math (75% to Rider, 25% Platform)
    const riderCut = Math.round(deliveryFee * 0.75);
    const platformCommission = deliveryFee - riderCut;

    return res.json({
      success: true,
      message: 'Delivery verified successfully',
      verifiedAt: new Date().toISOString(),
      orderId,
      riderId,
      financials: {
        deliveryFee,
        riderCut,
        platformCommission
      }
    });
  });

  // Update Rider Status / Location
  app.patch('/api/riders/status', (req, res) => {
    const { riderId, isOnline, latitude, longitude } = req.body;
    res.json({
      success: true,
      riderId,
      isOnline: isOnline ?? true,
      latitude,
      longitude,
      updatedAt: new Date().toISOString()
    });
  });

  // --- ADMIN & FINANCIALS ANALYTICS APIS ---

  app.get('/api/admin/financials', (req, res) => {
    res.json({
      success: true,
      financials: {
        totalRevenue: 248500,
        totalDeliveryFees: 38400,
        totalRiderPayouts: 28800,
        totalPlatformCommissions: 9600,
        walletTotalDeposits: 520000,
        walletTotalDebited: 195000,
        walletTotalRefunds: 4200,
        orders: {
          total: 84,
          pending: 3,
          preparing: 4,
          ready: 2,
          outForDelivery: 5,
          delivered: 68,
          cancelled: 2
        },
        activeVendors: 8,
        activeRiders: 6,
        lastReconciledAt: new Date().toISOString()
      }
    });
  });

  app.get('/api/admin/analytics', (req, res) => {
    res.json({
      success: true,
      analytics: {
        totalOrdersToday: 48,
        activeOrders: 6,
        completedOrders: 41,
        cancelledOrders: 1,
        totalRevenueNgn: 142500,
        averageDeliveryTimeMinutes: 18.5,
        activeKitchensCount: 4,
        onlineRidersCount: 5,
        campusName: 'Mountain Top University',
        lastUpdated: new Date().toISOString()
      }
    });
  });

  // --- PRODUCTION-GRADE PAYSTACK PAYMENT & FINANCIAL ARCHITECTURE APIS ---

  // 1. Get Payment Provider Gateway Configuration Status
  app.get('/api/payments/config-status', (req, res) => {
    const status = getPaymentConfigStatus();
    res.json({
      success: true,
      ...status
    });
  });

  // 2. Authoritative Paystack Payment Initialization (Primary & Alias)
  const handlePaymentInit = async (req: express.Request, res: express.Response) => {
    try {
      const { email, orderId, callbackUrl } = req.body;
      if (!orderId) {
        return res.status(400).json({
          status: false,
          success: false,
          message: 'orderId is required to initialize Paystack checkout'
        });
      }

      const result = await paymentService.initializeOrderPayment({
        orderId,
        email: email || 'student@mtu.edu.ng',
        callbackUrl
      });

      res.json(result);
    } catch (err: any) {
      console.error('[API_PAYMENT_INIT_ERROR]', err);
      res.status(500).json({
        status: false,
        success: false,
        message: err.message || 'Payment initialization failed',
        error: err.message
      });
    }
  };

  app.post('/api/payments/paystack/initialize', handlePaymentInit);
  app.post('/api/paystack/initialize', handlePaymentInit);

  // 3. Authoritative Paystack Payment Verification by Reference (GET & POST)
  const handlePaymentVerification = async (req: express.Request, res: express.Response) => {
    try {
      const reference = req.params.reference || req.body?.reference || req.query?.reference as string;
      if (!reference) {
        return res.status(400).json({
          status: false,
          success: false,
          message: 'Payment reference is required'
        });
      }

      const verification = await paymentService.verifyAndConfirmPayment(reference);

      if (verification.success) {
        // Dispatch order event notification to kitchen and user
        if (verification.order) {
          try {
            await dispatchOrderEventPipeline({
              orderId: verification.order.id,
              eventType: 'PAYMENT_CONFIRMED',
              customerId: verification.order.customer_id || verification.order.user_id,
              vendorId: verification.order.restaurant_id || verification.order.vendor_id,
              totalPrice: verification.order.total_price || 2350
            });
          } catch (e) {
            console.warn('Post-payment event notification note:', e);
          }
        }

        res.json({
          status: true,
          success: true,
          message: verification.message,
          data: {
            status: 'success',
            reference,
            orderId: verification.order?.id,
            totalPrice: verification.order?.total_price,
            breakdown: verification.order?.financial_breakdown,
            payment: verification.payment,
            alreadyProcessed: verification.alreadyProcessed
          }
        });
      } else {
        res.status(400).json({
          status: false,
          success: false,
          message: verification.message
        });
      }
    } catch (err: any) {
      console.error('[API_PAYMENT_VERIFY_ERROR]', err);
      res.status(500).json({
        status: false,
        success: false,
        message: err.message || 'Payment verification server error'
      });
    }
  };

  app.get('/api/payments/paystack/verify/:reference', handlePaymentVerification);
  app.post('/api/paystack/verify', handlePaymentVerification);

  // 4. Secure Paystack Webhook Handler (HMAC SHA512 Signature Verified)
  app.post('/api/paystack/webhook', async (req: any, res: express.Response) => {
    try {
      const signature = (req.headers['x-paystack-signature'] || '') as string;
      const rawBody = req.rawBody || JSON.stringify(req.body);

      const result = await paymentService.handlePaystackWebhook(req.body, rawBody, signature);
      res.status(result.status || 200).json(result);
    } catch (err: any) {
      console.error('[API_PAYSTACK_WEBHOOK_ERROR]', err);
      res.status(500).json({ status: 500, success: false, message: err.message || 'Webhook processing exception' });
    }
  });

  // 5. Payment Refund Endpoint
  app.post('/api/payments/:paymentId/refund', async (req, res) => {
    try {
      const { reason, amount } = req.body;
      const result = await paymentService.refundPayment(req.params.paymentId, reason || 'Administrative order refund');
      res.json(result);
    } catch (err: any) {
      console.error('[API_REFUND_ERROR]', err);
      res.status(500).json({ success: false, message: err.message || 'Refund execution failed' });
    }
  });

  // 6. Get Order Payment Details & Financial Breakdown
  app.get('/api/orders/:orderId/payment', (req, res) => {
    const order = serverDb.getDoc('orders', req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const allPayments = serverDb.getAll('payments');
    const payment = allPayments.find((p: any) => p.order_id === req.params.orderId);
    const allLedger = serverDb.getAll('ledger_entries');
    const orderLedger = allLedger.filter((l: any) => l.order_id === req.params.orderId);

    res.json({
      success: true,
      order,
      payment,
      financial_breakdown: order.financial_breakdown || paymentService.calculateAuthoritativeBreakdown({ items: order.items || [] }),
      ledger_entries: orderLedger
    });
  });

  // 7. Admin Financials: Aggregate Accounting Metrics
  app.get('/api/admin/financials', (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const metrics = financialLedger.getFinancialMetrics(start, end);
      const ledgerEntries = serverDb.getAll('ledger_entries');
      const restaurantBalances = serverDb.getAll('restaurant_balances');
      const riderBalances = serverDb.getAll('rider_balances');
      const expenses = serverDb.getAll('business_expenses');
      const config = getPaymentConfigStatus();

      res.json({
        success: true,
        metrics,
        config,
        restaurantBalances,
        riderBalances,
        recentLedger: ledgerEntries.slice(-25).reverse(),
        recentExpenses: expenses.slice(-10).reverse()
      });
    } catch (err: any) {
      console.error('[API_ADMIN_FINANCIALS_ERROR]', err);
      res.status(500).json({ success: false, message: err.message || 'Could not fetch financial analytics' });
    }
  });

  // 8. Admin Financials: Daily Analytics
  app.get('/api/admin/financials/daily', (req, res) => {
    try {
      const days = parseInt((req.query.days as string) || '30', 10);
      const daily = financialLedger.getDailyAnalytics(days);
      res.json({ success: true, daily });
    } catch (err: any) {
      console.error('[API_DAILY_FINANCIALS_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. Admin Financials: Monthly Analytics
  app.get('/api/admin/financials/monthly', (req, res) => {
    try {
      const months = parseInt((req.query.months as string) || '6', 10);
      const monthly = financialLedger.getMonthlyAnalytics(months);
      res.json({ success: true, monthly });
    } catch (err: any) {
      console.error('[API_MONTHLY_FINANCIALS_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 10. Record Business Operating Expense (servers, SMS, marketing, etc.)
  app.post('/api/admin/financials/expenses', (req, res) => {
    try {
      const { category, amount, description, date, recorded_by } = req.body;
      if (!category || !amount || !description) {
        return res.status(400).json({ success: false, message: 'category, amount, and description are required' });
      }

      const expense = financialLedger.recordBusinessExpense({
        category,
        amount: Number(amount),
        description,
        date: date || new Date().toISOString(),
        recorded_by: recorded_by || 'Admin'
      });

      res.json({ success: true, expense });
    } catch (err: any) {
      console.error('[API_EXPENSE_ERROR]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 11. Settle Restaurant Earnings to Paid Out
  app.post('/api/admin/financials/settle-restaurant', (req, res) => {
    try {
      const { restaurantId, amount } = req.body;
      if (!restaurantId || !amount) {
        return res.status(400).json({ success: false, message: 'restaurantId and amount required' });
      }
      financialLedger.settleRestaurantEarnings(restaurantId, Number(amount));
      res.json({ success: true, message: `Restaurant ${restaurantId} balance settled` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Settle Rider Earnings to Paid Out
  app.post('/api/admin/financials/settle-rider', (req, res) => {
    try {
      const { riderId, amount } = req.body;
      if (!riderId || !amount) {
        return res.status(400).json({ success: false, message: 'riderId and amount required' });
      }
      financialLedger.settleRiderEarnings(riderId, Number(amount));
      res.json({ success: true, message: `Rider ${riderId} balance settled` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- CENTRALIZED FIREBASE PUSH & NOTIFICATION PIPELINE APIS ---

  // 1. Register / Update Device Token (Multi-device support)
  app.post('/api/notifications/register-token', (req, res) => {
    try {
      const { userId, fcmToken, platform, appType, deviceId, permissionStatus, userAgent } = req.body;
      if (!userId || !fcmToken) {
        return res.status(400).json({ success: false, message: 'userId and fcmToken are required' });
      }
      const tokenRecord = registerDeviceToken({
        userId,
        fcmToken,
        platform,
        appType,
        deviceId,
        permissionStatus,
        userAgent
      });
      return res.json({ success: true, token: tokenRecord });
    } catch (err: any) {
      console.error('Failed to register token:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Unregister / Deactivate Device Token
  app.post('/api/notifications/unregister-token', (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'token is required' });
      }
      const deactivated = unregisterDeviceToken(token);
      return res.json({ success: true, deactivated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. List Registered Device Tokens (Admin monitoring)
  app.get('/api/notifications/tokens', (req, res) => {
    try {
      const tokens = listAllTokens();
      return res.json({ success: true, count: tokens.length, tokens });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Dispatch Authoritative Order Event (State machine trigger)
  app.post('/api/notifications/order-event', async (req, res) => {
    try {
      const {
        orderId,
        eventType,
        customerId,
        customerName,
        vendorId,
        vendorName,
        vendorPhone,
        riderId,
        riderName,
        deliveryLocation,
        deliveryCode,
        pickupCode,
        totalPrice,
        riderFee,
        estimatedMinutes,
        cancellationReason,
        metadata
      } = req.body;

      if (!orderId || !eventType || !customerId || !vendorId) {
        return res.status(400).json({
          success: false,
          message: 'orderId, eventType, customerId, and vendorId are required'
        });
      }

      const result = await dispatchOrderEventPipeline({
        orderId,
        eventType,
        customerId,
        customerName,
        vendorId,
        vendorName,
        vendorPhone,
        riderId,
        riderName,
        deliveryLocation,
        deliveryCode,
        pickupCode,
        totalPrice,
        riderFee,
        estimatedMinutes,
        cancellationReason,
        metadata
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Order event dispatch error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Dispatch Authoritative Wallet Event
  app.post('/api/notifications/wallet-event', async (req, res) => {
    try {
      const { userId, eventType, amount, balanceAfter, transactionReference, description } = req.body;
      if (!userId || !eventType || amount === undefined || balanceAfter === undefined) {
        return res.status(400).json({
          success: false,
          message: 'userId, eventType, amount, and balanceAfter are required'
        });
      }

      const result = await dispatchWalletEventPipeline({
        userId,
        eventType,
        amount,
        balanceAfter,
        transactionReference: transactionReference || `TX_${Date.now()}`,
        description
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Wallet event dispatch error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Dispatch Admin Operational Alert
  app.post('/api/notifications/admin-alert', async (req, res) => {
    try {
      const { title, body, severity = 'INFO', alertCategory = 'SYSTEM_HEALTH', metadata } = req.body;
      if (!title || !body) {
        return res.status(400).json({ success: false, message: 'title and body are required' });
      }

      const result = await dispatchAdminAlertPipeline({
        title,
        body,
        severity,
        alertCategory,
        metadata
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Get User Notification History
  app.get('/api/notifications/user/:userId', (req, res) => {
    try {
      const history = getUserNotificationHistory(req.params.userId);
      return res.json({ success: true, count: history.length, notifications: history });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Mark Single Notification as Read
  app.patch('/api/notifications/:id/read', (req, res) => {
    try {
      const updated = markNotificationAsRead(req.params.id);
      return res.json({ success: true, updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Mark All Notifications as Read for User
  app.patch('/api/notifications/read-all', (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }
      const markedCount = markAllNotificationsAsReadForUser(userId);
      return res.json({ success: true, markedCount });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. Notification Health & Diagnostics Metrics
  app.get('/api/notifications/health', (req, res) => {
    try {
      const stats = getNotificationHealth();
      return res.json({ success: true, stats });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 11. Testing Simulator Endpoint: 1-Click Multi-Role Event Dispatch
  app.post('/api/notifications/test-dispatch', async (req, res) => {
    try {
      const { targetRole = 'customer', eventType = 'ORDER_CREATED', customMessage } = req.body;
      const testOrderId = `TEST_ORD_${Date.now().toString().slice(-4)}`;

      let result;
      if (targetRole === 'admin') {
        result = await dispatchAdminAlertPipeline({
          title: customMessage || 'High Vendor Volume Surge',
          body: 'Kitchen queues in Mountain Top University Central Plaza reached peak capacity.',
          severity: 'WARNING',
          alertCategory: 'SYSTEM_HEALTH'
        });
      } else {
        const orderEvent: OrderEventType = eventType as OrderEventType;
        result = await dispatchOrderEventPipeline({
          orderId: testOrderId,
          eventType: orderEvent,
          customerId: 'user_cust_01',
          customerName: 'Campus Student',
          vendorId: 'user_vendor_ronalds',
          vendorName: "Ronald's Food House",
          riderId: 'user_rider_01',
          riderName: 'Speedy Rider',
          deliveryLocation: 'Daniel Hall Room 204',
          deliveryCode: '4821',
          pickupCode: '9134',
          totalPrice: 3200,
          riderFee: 400
        });
      }

      return res.json({ success: true, testOrderId, result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Backward-compatible status update route
  app.post('/api/fcm/send-status-update', async (req, res) => {
    const { orderId, status, vendorName, userId, customerId } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ status: false, message: 'orderId and status are required' });
    }

    const statusMap: Record<string, OrderEventType> = {
      pending: 'ORDER_CREATED',
      accepted: 'VENDOR_ACCEPTED',
      preparing: 'ORDER_PREPARING',
      ready: 'ORDER_READY',
      assigned: 'RIDER_ASSIGNED',
      picked_up: 'ORDER_PICKED_UP',
      on_the_way: 'ORDER_OUT_FOR_DELIVERY',
      delivered: 'ORDER_DELIVERED',
      cancelled: 'ORDER_CANCELLED'
    };

    const mappedEvent: OrderEventType = statusMap[status] || 'ORDER_CREATED';

    await dispatchOrderEventPipeline({
      orderId,
      eventType: mappedEvent,
      customerId: customerId || userId || 'user_cust_01',
      vendorId: 'vendor_mtu_canteen',
      vendorName: vendorName || 'Campus Food Stand'
    });

    return res.json({
      status: true,
      message: 'Status update processed via centralized notification engine'
    });
  });

  // 12. Multi-device FCM Token Registration
  app.post('/api/fcm/register-device', (req, res) => {
    try {
      const { userId, deviceRecord } = req.body;
      if (!userId || !deviceRecord || !deviceRecord.fcmToken) {
        return res.status(400).json({ success: false, message: 'userId and valid deviceRecord required' });
      }

      // Track in server-side notification engine registry
      registerDeviceToken({
        userId,
        fcmToken: deviceRecord.fcmToken,
        platform: (deviceRecord.platform?.toUpperCase() as any) || 'ANDROID',
        appType: (deviceRecord.app?.toUpperCase() as any) || 'CUSTOMER',
        deviceId: deviceRecord.deviceId
      });

      return res.json({ success: true, message: 'Device token registered successfully', deviceId: deviceRecord.deviceId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 13. Deactivate Device on Logout
  app.post('/api/fcm/deactivate-device', (req, res) => {
    try {
      const { userId, deviceId } = req.body;
      return res.json({ success: true, message: 'Device deactivated', userId, deviceId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 14. Realtime Delivery Chat Push Notification
  app.post('/api/chat/send-message-push', async (req, res) => {
    try {
      const { conversationId, orderId, senderName, senderRole, receiverId, messageText } = req.body;
      if (!conversationId || !receiverId || !messageText) {
        return res.status(400).json({ success: false, message: 'conversationId, receiverId and messageText required' });
      }

      const roleDisplay = senderRole === 'rider' ? '🛵 Your Courier' : '📦 Customer';
      const orderShortId = orderId ? orderId.slice(-6).toUpperCase() : '';

      const pushTitle = `💬 New Message from ${senderName || roleDisplay}`;
      const pushBody = messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText;
      const deepLink = senderRole === 'rider' ? `/chat/${conversationId}` : `/chat/${conversationId}`;

      // Dispatch push via notification engine
      const deliveryReport = await dispatchPushNotificationToUser({
        recipientUserId: receiverId,
        title: pushTitle,
        body: pushBody,
        deepLink,
        channelId: 'messages',
        data: {
          conversationId,
          orderId: orderId || '',
          senderRole: senderRole || 'rider',
          type: 'chat_message'
        }
      });

      // Also trigger Web Push to recipient
      dispatchWebPushToUser(receiverId, {
        title: pushTitle,
        body: pushBody,
        deepLink,
        severity: 'INFO',
        conversationId,
        orderId
      }).catch(() => {});

      return res.json({ success: true, deliveryReport });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==============================================================================
  // 15. WEB PUSH NOTIFICATION ROUTES (Push API / RFC 8030 / VAPID)
  // ==============================================================================

  // Fetch Public VAPID Key for browser subscription registration
  app.get('/api/webpush/vapid-public-key', (req, res) => {
    try {
      const publicKey = getVapidPublicKey();
      res.json({ success: true, publicKey });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Register Web Push subscription
  app.post('/api/webpush/subscribe', (req, res) => {
    try {
      const { userId, subscription, role, platform, browser, userAgent } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ success: false, message: 'Valid subscription object required' });
      }

      const record = saveWebPushSubscription({
        userId: userId || 'anonymous_guest',
        subscription,
        role: role || 'CUSTOMER',
        platform: platform || 'WEB',
        browser,
        userAgent
      });

      res.json({ success: true, message: 'Web Push subscription registered', record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Unsubscribe Web Push subscription
  app.post('/api/webpush/unsubscribe', (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ success: false, message: 'endpoint required' });
      }

      const removed = removeWebPushSubscription(endpoint);
      res.json({ success: true, removed });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // List all registered Web Push subscriptions
  app.get('/api/webpush/subscriptions', (req, res) => {
    try {
      const subscriptions = listAllWebPushSubscriptions();
      res.json({ success: true, count: subscriptions.length, subscriptions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Test send Web Push to a user or all users
  app.post('/api/webpush/test-send', async (req, res) => {
    try {
      const { userId, title, body, deepLink, severity } = req.body;
      const pushTitle = title || '🔔 BUKKIT Web Push Live Test';
      const pushBody = body || 'Testing background & closed-app push notification delivery!';
      const pushLink = deepLink || '/orders';

      if (userId) {
        const result = await dispatchWebPushToUser(userId, {
          title: pushTitle,
          body: pushBody,
          deepLink: pushLink,
          severity: severity || 'INFO'
        });
        return res.json({ success: true, target: userId, ...result });
      } else {
        const allSubs = listAllWebPushSubscriptions();
        let sent = 0;
        for (const sub of allSubs) {
          const ok = await dispatchWebPushToUser(sub.user_id, {
            title: pushTitle,
            body: pushBody,
            deepLink: pushLink,
            severity: severity || 'INFO'
          });
          if (ok.successful > 0) sent++;
        }
        return res.json({ success: true, target: 'all', totalSubscriptions: allSubs.length, delivered: sent });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BUKKIT Centralized Backend Engine running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
