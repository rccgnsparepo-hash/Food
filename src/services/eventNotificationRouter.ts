import { Order, OrderStatus, UserRole, NotificationChannelId } from '../types';
import { getActiveDevicesForUsers } from './fcmDeviceService';

export interface NotificationPayload {
  channelId: NotificationChannelId;
  title: string;
  body: string;
  deepLink: string;
  orderId?: string;
  conversationId?: string;
  eventType: string;
  data?: Record<string, string>;
}

export interface EventRoutingResult {
  eventType: string;
  orderId: string;
  recipientsNotified: {
    role: string;
    userId: string;
    deviceCount: number;
  }[];
  timestamp: string;
}

/**
 * Maps Order Status to standard Order Life-cycle Notification Configurations
 */
export function getOrderEventNotificationConfig(params: {
  status: OrderStatus;
  orderId: string;
  orderNumber?: string;
  vendorName: string;
  riderName?: string;
  customerName?: string;
}): {
  customer?: NotificationPayload;
  vendor?: NotificationPayload;
  rider?: NotificationPayload;
  admin?: NotificationPayload;
} {
  const { status, orderId, vendorName, riderName, customerName } = params;
  const shortId = params.orderNumber || orderId.slice(-6).toUpperCase();

  switch (status) {
    case 'pending':
      return {
        vendor: {
          channelId: 'orders',
          title: `🔔 New Order #${shortId} Received!`,
          body: `A student submitted an order for ${vendorName}. Tap to accept and start kitchen prep.`,
          deepLink: `bukkit-vendor://orders/${orderId}`,
          orderId,
          eventType: 'order_pending'
        },
        admin: {
          channelId: 'orders',
          title: `Order #${shortId} Placed`,
          body: `New order pending at ${vendorName}.`,
          deepLink: `bukkit-admin://orders/${orderId}`,
          orderId,
          eventType: 'order_pending'
        }
      };

    case 'payment_confirmed':
      return {
        customer: {
          channelId: 'payments',
          title: `💳 Payment Confirmed for #${shortId}`,
          body: `Your payment was verified. ${vendorName} has received your order ticket.`,
          deepLink: `bukkit://orders/${orderId}`,
          orderId,
          eventType: 'payment_confirmed'
        },
        vendor: {
          channelId: 'orders',
          title: `💰 Paid Order #${shortId} Ready for Prep`,
          body: `Payment verified. Please accept to begin preparing meal.`,
          deepLink: `bukkit-vendor://orders/${orderId}`,
          orderId,
          eventType: 'payment_confirmed'
        }
      };

    case 'accepted':
      return {
        customer: {
          channelId: 'orders',
          title: `🍳 ${vendorName} Accepted Your Order!`,
          body: `The kitchen has queued order #${shortId} and will begin cooking soon.`,
          deepLink: `bukkit://tracking/${orderId}`,
          orderId,
          eventType: 'order_accepted'
        }
      };

    case 'preparing':
      return {
        customer: {
          channelId: 'orders',
          title: `🔥 Order #${shortId} is Sizzling!`,
          body: `${vendorName} is actively cooking your fresh meal.`,
          deepLink: `bukkit://tracking/${orderId}`,
          orderId,
          eventType: 'order_preparing'
        }
      };

    case 'ready':
      return {
        customer: {
          channelId: 'orders',
          title: `🍱 Meal Ready for Dispatch!`,
          body: `Your order from ${vendorName} is packaged and waiting for courier pickup.`,
          deepLink: `bukkit://tracking/${orderId}`,
          orderId,
          eventType: 'order_ready'
        },
        rider: {
          channelId: 'deliveries',
          title: `📦 Delivery Ready at ${vendorName}!`,
          body: `Order #${shortId} is ready for pickup at ${vendorName}. Tap to claim or head to stand.`,
          deepLink: `bukkit-rider://deliveries/${orderId}`,
          orderId,
          eventType: 'order_ready_for_rider'
        }
      };

    case 'assigned':
      return {
        customer: {
          channelId: 'deliveries',
          title: `🛵 Courier Assigned: ${riderName || 'Campus Courier'}`,
          body: `${riderName || 'Your rider'} is assigned and heading to ${vendorName} to collect your meal.`,
          deepLink: `bukkit://tracking/${orderId}`,
          orderId,
          eventType: 'rider_assigned'
        },
        rider: {
          channelId: 'deliveries',
          title: `🎯 New Delivery Assignment #${shortId}`,
          body: `Pickup from ${vendorName}. Deliver to student at Mountain Top Campus.`,
          deepLink: `bukkit-rider://deliveries/${orderId}`,
          orderId,
          eventType: 'rider_assigned'
        },
        vendor: {
          channelId: 'deliveries',
          title: `🛵 Courier ${riderName || ''} Assigned`,
          body: `Rider is on the way to pick up Order #${shortId}.`,
          deepLink: `bukkit-vendor://orders/${orderId}`,
          orderId,
          eventType: 'rider_assigned'
        }
      };

    case 'picked_up':
    case 'on_the_way':
      return {
        customer: {
          channelId: 'deliveries',
          title: `🚀 Courier Picked Up Your Meal!`,
          body: `${riderName || 'Your rider'} has picked up your food from ${vendorName} and is en route!`,
          deepLink: `bukkit://tracking/${orderId}`,
          orderId,
          eventType: 'order_on_the_way'
        },
        rider: {
          channelId: 'deliveries',
          title: `📍 En Route to Student`,
          body: `Delivering Order #${shortId}. Track route to student destination.`,
          deepLink: `bukkit-rider://deliveries/${orderId}`,
          orderId,
          eventType: 'order_on_the_way'
        }
      };

    case 'delivered':
      return {
        customer: {
          channelId: 'orders',
          title: `🎉 Order Delivered! Enjoy Your Meal!`,
          body: `Order #${shortId} from ${vendorName} was delivered successfully. Enjoy!`,
          deepLink: `bukkit://orders/${orderId}`,
          orderId,
          eventType: 'order_delivered'
        },
        rider: {
          channelId: 'payments',
          title: `✅ Delivery Completed #${shortId}`,
          body: `Payout credited to your BUKKIT Courier wallet. Good job!`,
          deepLink: `bukkit-rider://deliveries/${orderId}`,
          orderId,
          eventType: 'delivery_completed'
        },
        vendor: {
          channelId: 'orders',
          title: `✅ Order #${shortId} Completed`,
          body: `Customer received delivery from ${riderName || 'courier'}.`,
          deepLink: `bukkit-vendor://orders/${orderId}`,
          orderId,
          eventType: 'order_delivered'
        }
      };

    case 'cancelled':
      return {
        customer: {
          channelId: 'orders',
          title: `❌ Order #${shortId} Cancelled`,
          body: `Your order from ${vendorName} was cancelled. Refund processed to your wallet.`,
          deepLink: `bukkit://orders/${orderId}`,
          orderId,
          eventType: 'order_cancelled'
        },
        vendor: {
          channelId: 'orders',
          title: `❌ Order #${shortId} Cancelled`,
          body: `Order was cancelled. Please stop kitchen preparation.`,
          deepLink: `bukkit-vendor://orders/${orderId}`,
          orderId,
          eventType: 'order_cancelled'
        },
        admin: {
          channelId: 'orders',
          title: `⚠️ Order Cancellation Alert #${shortId}`,
          body: `Order #${shortId} at ${vendorName} was cancelled. Check audit logs.`,
          deepLink: `bukkit-admin://orders/${orderId}`,
          orderId,
          eventType: 'order_cancelled'
        }
      };

    default:
      return {};
  }
}

/**
 * Dispatch Event-driven notification through the backend API
 */
export async function routeOrderEventNotification(order: Order, status: OrderStatus): Promise<EventRoutingResult | null> {
  try {
    const config = getOrderEventNotificationConfig({
      status,
      orderId: order.id,
      orderNumber: (order as any).order_number,
      vendorName: order.restaurant_name || 'Campus Food Stand',
      riderName: order.rider_name,
      customerName: (order as any).customer_name
    });

    const response = await fetch('/api/fcm/dispatch-order-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        status,
        orderData: {
          customerId: order.user_id,
          vendorId: order.restaurant_id,
          riderId: order.rider_id,
          restaurantName: order.restaurant_name,
          riderName: order.rider_name
        },
        payloads: config
      })
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Event Router] Failed to dispatch order event push:', err);
  }
  return null;
}
