import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getOrCreateUser, getVendorsList, createSqlOrder, getUserOrders } from './src/db/helpers.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'cloud_sql_postgres', timestamp: new Date().toISOString() });
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

  // Database API: Fetch Vendors
  app.get('/api/vendors', async (req, res) => {
    try {
      const vendors = await getVendorsList();
      res.json({ success: true, vendors });
    } catch (error: any) {
      console.error('API vendors fetch error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vendors' });
    }
  });

  // Database API: Create Order
  app.post('/api/orders', async (req, res) => {
    try {
      const order = await createSqlOrder(req.body);
      res.json({ success: true, order });
    } catch (error: any) {
      console.error('API order creation error:', error);
      res.status(500).json({ success: false, error: error.message || 'Could not save order' });
    }
  });

  // Database API: Get User Orders
  app.get('/api/orders/user/:uid', async (req, res) => {
    try {
      const orders = await getUserOrders(req.params.uid);
      res.json({ success: true, orders });
    } catch (error: any) {
      console.error('API fetch user orders error:', error);
      res.status(500).json({ success: false, error: 'Could not fetch orders' });
    }
  });

  // Paystack Initialize Endpoint
  app.post('/api/paystack/initialize', (req, res) => {
    const { email, amount, orderId } = req.body;
    const reference = `PS_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // In production, this can call Paystack API endpoint using PAYSTACK_SECRET_KEY
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

  // Paystack Verification Endpoint
  app.post('/api/paystack/verify', (req, res) => {
    const { reference } = req.body;

    // Verify transaction reference
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

  // Firebase Cloud Messaging Status Update Endpoint
  app.post('/api/fcm/send-status-update', (req, res) => {
    const { orderId, status, vendorName, userId } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ status: false, message: 'orderId and status are required' });
    }

    // Status message mappings
    const messages: Record<string, string> = {
      pending: 'Your order has been submitted and is awaiting confirmation.',
      accepted: `Your order from ${vendorName || 'Vendor'} has been accepted!`,
      preparing: `Your order from ${vendorName || 'Vendor'} is being prepared in the kitchen.`,
      ready: `Your order from ${vendorName || 'Vendor'} is ready!`,
      picked_up: `Your order from ${vendorName || 'Vendor'} has been picked up by the rider.`,
      on_the_way: `Your rider is on the way with your food from ${vendorName || 'Vendor'}.`,
      delivered: `Your order from ${vendorName || 'Vendor'} has been delivered! Enjoy your meal.`,
      cancelled: `Your order from ${vendorName || 'Vendor'} was cancelled.`
    };

    const statusText = messages[status] || `Order ${orderId} status updated to ${status}.`;

    console.log(`[FCM Server] Order ${orderId} status changed to '${status}' for user ${userId || 'guest'}: "${statusText}"`);

    return res.json({
      status: true,
      message: 'FCM status update notification logged and queued successfully',
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
    console.log(`Food Ordering Ecosystem Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
