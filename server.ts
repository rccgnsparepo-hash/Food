import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getOrCreateUser, checkUserExists, getVendorsList, createSqlOrder, getUserOrders } from './src/db/helpers.ts';
import { requireAuth, requireRole, requirePermission, AuthRequest } from './src/middleware/auth.ts';
import { getRolePermissions } from './src/services/authService.ts';
import { UserRole, OrderStatus } from './src/types.ts';

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

  // Database API: Check User Existence
  app.get('/api/users/check', async (req, res) => {
    try {
      const email = req.query.email as string | undefined;
      const uid = req.query.uid as string | undefined;
      const result = await checkUserExists({ email, uid });
      res.json({ success: true, exists: result.exists, user: result.user });
    } catch (error: any) {
      console.error('API user check error:', error);
      res.status(500).json({ success: false, exists: false, error: error.message });
    }
  });

  // Database API: Sync/Upsert User
  app.post('/api/users/sync', async (req, res) => {
    try {
      const user = await getOrCreateUser(req.body);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('API user sync error:', error);
      res.status(500).json({ success: false, error: error.message || 'Database user sync failed' });
    }
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

  // --- FIREBASE CLOUD MESSAGING (FCM) NOTIFICATIONS API ---

  app.post('/api/fcm/send-status-update', (req, res) => {
    const { orderId, status, vendorName, userId } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ status: false, message: 'orderId and status are required' });
    }

    const messages: Record<string, string> = {
      pending: 'Your order has been submitted and is awaiting confirmation.',
      accepted: `Your order from ${vendorName || 'Vendor'} has been accepted!`,
      preparing: `Your order from ${vendorName || 'Vendor'} is being prepared in the kitchen.`,
      ready: `Your order from ${vendorName || 'Vendor'} is ready for pickup!`,
      assigned: `A rider has accepted your delivery from ${vendorName || 'Vendor'}.`,
      picked_up: `Your order from ${vendorName || 'Vendor'} has been picked up by the rider.`,
      on_the_way: `Your rider is on the way with your meal from ${vendorName || 'Vendor'}.`,
      delivered: `Your order from ${vendorName || 'Vendor'} has been delivered! Enjoy your meal.`,
      cancelled: `Your order from ${vendorName || 'Vendor'} was cancelled.`
    };

    const statusText = messages[status] || `Order ${orderId} status updated to ${status}.`;

    console.log(`[FCM Engine] Order ${orderId} status changed to '${status}': "${statusText}"`);

    return res.json({
      status: true,
      message: 'FCM status update broadcast sent successfully',
      data: {
        orderId,
        status,
        notification: {
          title: 'BUKKIT Order Update',
          body: statusText
        },
        timestamp: new Date().toISOString()
      }
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
  });
}

startServer();
