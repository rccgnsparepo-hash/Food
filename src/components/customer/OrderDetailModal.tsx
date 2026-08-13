import React from 'react';
import { ArrowLeft, Clock, MapPin, CheckCircle2, ShoppingBag, Truck, CreditCard, ChevronRight, RefreshCw, User, Phone } from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { MapPicker } from '../ui/MapPicker';
import { useCartStore } from '../../stores/useCartStore';
import { triggerHaptic } from '../../utils/haptics';

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onTrackOrder?: (orderId: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose, onTrackOrder }) => {
  const { addItem, setCartOpen } = useCartStore();

  const isCompleted = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isActive = !isCompleted && !isCancelled;

  const steps: { status: OrderStatus; title: string; time?: string }[] = [
    { status: 'pending', title: 'Order Placed', time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { status: 'accepted', title: 'Confirmed by Restaurant' },
    { status: 'preparing', title: 'Food Preparation' },
    { status: 'picked_up', title: 'Picked Up by Rider' },
    { status: 'on_the_way', title: 'Out for Delivery' },
    { status: 'delivered', title: 'Order Delivered', time: new Date(order.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ];

  const getStepStatusIndex = (st: OrderStatus) => {
    switch (st) {
      case 'pending': return 0;
      case 'accepted': return 1;
      case 'preparing': return 2;
      case 'ready': return 3;
      case 'picked_up': return 3;
      case 'on_the_way': return 4;
      case 'delivered': return 5;
      default: return 0;
    }
  };

  const currentStepIdx = getStepStatusIndex(order.status);

  const handleReorder = () => {
    triggerHaptic([60, 30, 60]);
    order.items.forEach((item) => {
      addItem({
        id: item.menu_item_id,
        vendor_id: order.vendor_id || order.restaurant_id,
        restaurant_id: order.restaurant_id,
        category_id: 'cat_general',
        name: item.name,
        description: '',
        price: item.price,
        base_price: item.price,
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400',
        available: true
      }, undefined, item.quantity, item.selectedOptions);
    });
    onClose();
    setCartOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl overflow-y-auto shadow-2xl border border-rose-100 flex flex-col justify-between animate-in zoom-in-95 duration-200">
        
        {/* Top Sticky Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 px-6 py-4 border-b border-rose-100 flex items-center justify-between">
          <button
            onClick={() => {
              triggerHaptic(30);
              onClose();
            }}
            className="p-2.5 rounded-2xl bg-rose-50 text-[#D6001C] hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="font-extrabold text-base text-slate-900">Order Details</h2>
            <p className="text-xs text-slate-400 font-mono">#{order.id}</p>
          </div>

          <div className="w-9" />
        </div>

        {/* Modal Body Scroll Container */}
        <div className="p-6 space-y-6">
          
          {/* 1. Restaurant Header & Order Summary Card */}
          <div className="bg-rose-50/60 rounded-3xl p-5 border border-rose-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Restaurant
                </span>
                <h3 className="font-black text-slate-900 text-lg">{order.restaurant_name}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isCompleted
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isCancelled
                  ? 'bg-slate-400 text-white'
                  : 'bg-[#D6001C] text-white shadow-xs'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 pt-2 border-t border-rose-100/80">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#D6001C]" />
                <span>{new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* 2. Order Status Timeline History */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-4">
            <h4 className="font-extrabold text-slate-900 text-sm">Status Timeline History</h4>
            
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {steps.map((st, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={st.status} className="relative flex items-center justify-between text-xs">
                    <div
                      className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isPassed
                          ? 'bg-[#D6001C] text-white shadow-sm ring-4 ring-rose-100'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>

                    <span className={`font-bold ${isPassed ? 'text-slate-900' : 'text-slate-400'}`}>
                      {st.title} {isCurrent && <span className="text-[#D6001C] text-[10px] font-black uppercase ml-1">(Current)</span>}
                    </span>

                    {st.time && (
                      <span className="text-[10px] text-slate-400 font-mono">{st.time}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Order Items Table */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Ordered Items ({order.items.length})
            </h4>

            <div className="space-y-3 divide-y divide-slate-100">
              {order.items.map((it, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                  <div>
                    <span className="font-black text-slate-900">{it.quantity}x {it.name}</span>
                    {it.selectedOptions && Object.keys(it.selectedOptions).length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {Object.entries(it.selectedOptions).map(([k, v]) => (
                          <span key={k} className="mr-2">• {v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-extrabold text-slate-900">
                    ₦{(it.price * it.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Total Pricing & Payment Information */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
              Payment & Bill Breakdown
            </h4>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-white">₦{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="font-bold text-white">₦{order.delivery_fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee</span>
                <span className="font-bold text-white">₦{order.service_fee.toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between text-base font-black text-white">
                <span>Total Paid</span>
                <span className="text-[#D6001C]">₦{order.total_price.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Ref: {order.payment_reference || 'PAYSTACK'}
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                {order.payment_status}
              </span>
            </div>
          </div>

          {/* 5. Delivery Location Map */}
          <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#D6001C]" />
              <h4 className="font-extrabold text-slate-900 text-sm">Delivery Location</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium">{order.delivery_address}</p>
            
            <MapPicker
              latitude={order.latitude || 6.518}
              longitude={order.longitude || 3.372}
              height="160px"
              isTrackingMode={true}
            />
          </div>

        </div>

        {/* Bottom Actions Bar */}
        <div className="p-6 bg-slate-50 border-t border-rose-100 flex flex-wrap gap-3">
          {isActive && onTrackOrder && (
            <button
              onClick={() => {
                triggerHaptic(50);
                onClose();
                onTrackOrder(order.id);
              }}
              className="flex-1 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-3.5 px-5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-red-500/20 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Track Live Delivery</span>
            </button>
          )}

          <button
            onClick={handleReorder}
            className={`flex-1 font-extrabold py-3.5 px-5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
              isActive
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                : 'bg-[#D6001C] hover:bg-red-700 text-white shadow-md shadow-red-500/20'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reorder Items</span>
          </button>
        </div>

      </div>
    </div>
  );
};
