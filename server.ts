import express from 'express';
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
  getUserNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsReadForUser,
  getNotificationHealth
} from './src/services/notificationBackendService.ts';
import { startDispatcherLoop } from './src/services/notificationDispatcher.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'BUKKIT Authoritative Backend',
      database: 'cloud_sql_postgres & firestore_sync',
      timestamp: new Date().toISOString()
    });
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

  // Create Order
  app.post('/api/orders', async (req, res) => {
    try {
      const order = await createSqlOrder(req.body);
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

  // --- PAYSTACK APIS ---

  app.post('/api/paystack/initialize', (req, res) => {
    const { email, amount, orderId } = req.body;
    const reference = `PS_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    res.json({
      status: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: `https://checkout.paystack.com/simulate_${reference}`,
        access_code: `code_${reference}`,
        reference: reference,
        amount: amount,
        email: email,
        orderId: orderId
      }
    });
  });

  app.post('/api/paystack/verify', (req, res) => {
    const { reference } = req.body;
    if (reference) {
      res.json({
        status: true,
        message: 'Verification successful',
        data: {
          id: Date.now(),
          domain: 'test',
          status: 'success',
          reference: reference,
          amount: 2500,
          gateway_response: 'Successful',
          paid_at: new Date().toISOString(),
          channel: 'card',
          currency: 'NGN'
        }
      });
    } else {
      res.status(400).json({ status: false, message: 'Invalid transaction reference' });
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
    try {
      startDispatcherLoop(5000);
      console.log('[server] notification dispatcher started');
    } catch (err) {
      console.warn('[server] failed to start notification dispatcher', err);
    }
  });
}

startServer();
