import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, AlertTriangle, Ban } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { getItemAvailability } from '../../utils/availability';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

interface CartDrawerProps {
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onCheckout }) => {
  const {
    items,
    isOpen,
    setCartOpen,
    updateQuantity,
    removeItem,
    removeUnavailableItems,
    getSubtotal,
    getDeliveryFee,
    getServiceFee,
    getTotal,
  } = useCartStore();

  const { vendors } = useMarketplaceStore();

  // Scroll lock when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Compute status for all cart items
  const itemsWithStatus = useMemo(() => {
    return items.map((item) => {
      const vendor = vendors.find((v) => v.id === (item.menuItem.vendor_id || item.menuItem.restaurant_id));
      const availability = getItemAvailability(item.menuItem, vendor);
      return {
        ...item,
        availability,
      };
    });
  }, [items, vendors]);

  const hasUnavailableItems = itemsWithStatus.some((i) => !i.availability.isAvailable);

  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();
  const serviceFee = getServiceFee();
  const total = getTotal();

  const handleProceedToCheckout = () => {
    if (hasUnavailableItems) {
      toast.error('Please remove unavailable or sold out items before proceeding.');
      return;
    }
    triggerHaptic([50, 50]);
    setCartOpen(false);
    onCheckout();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-[#0D472B] to-[#0A3A22] text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                    <ShoppingBag className="w-5 h-5 text-[#FF7A00]" />
                  </div>
                  <div>
                    <h2 className="font-black text-lg text-white tracking-tight">Your Cart</h2>
                    <p className="text-xs text-emerald-200 font-medium">
                      {items.length} {items.length === 1 ? 'item' : 'items'} selected
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCartOpen(false)}
                  className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Cart Items List */}
              <div className="p-6 flex-1 overflow-y-auto space-y-3.5">
                {hasUnavailableItems && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">Notice:</span> Some items in your bag became unavailable or sold out. Please remove them to complete your order.
                    </div>
                  </div>
                )}

                {itemsWithStatus.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center mx-auto text-emerald-800 dark:text-emerald-400">
                      <ShoppingBag className="w-8 h-8 text-[#0D472B] dark:text-emerald-400" />
                    </div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">Your cart is empty</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Add delicious campus meals to get started!</p>
                  </div>
                ) : (
                  itemsWithStatus.map((item) => {
                    const itemPrice = item.menuItem.base_price ?? item.menuItem.price ?? 0;
                    const isAvail = item.availability.isAvailable;
                    return (
                      <motion.div
                        key={item.menuItem.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-2xs transition-all ${
                          !isAvail
                            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                            : 'bg-emerald-50/40 dark:bg-slate-800/60 border-emerald-100/90 dark:border-slate-700'
                        }`}
                      >
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <img
                            src={
                              item.menuItem.image_url ||
                              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'
                            }
                            alt={item.menuItem.name}
                            className={`w-full h-full object-cover ${!isAvail ? 'grayscale-50 opacity-60' : ''}`}
                          />
                          {!isAvail && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Ban className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm truncate">
                              {item.menuItem.name}
                            </h4>
                            {!isAvail && (
                              <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded uppercase">
                                {item.availability.badgeLabel}
                              </span>
                            )}
                          </div>
                          
                          <span className="text-xs font-black text-[#0D472B] dark:text-emerald-400 block mt-0.5">
                            ₦{(itemPrice * item.quantity).toLocaleString()}
                          </span>

                          {/* Options list */}
                          {item.selectedOptions &&
                            Object.keys(item.selectedOptions).length > 0 && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {Object.entries(item.selectedOptions).map(([k, v]) => (
                                  <span key={k} className="mr-2">
                                    • {v}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* Quantity Controls */}
                        {isAvail ? (
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-emerald-100 dark:border-slate-700">
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                              className="p-1 text-slate-600 dark:text-slate-400 hover:text-[#0D472B] dark:hover:text-emerald-400 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </motion.button>
                            <span className="text-xs font-black w-4 text-center text-slate-800 dark:text-slate-200">
                              {item.quantity}
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                              className="p-1 text-slate-600 dark:text-slate-400 hover:text-[#0D472B] dark:hover:text-emerald-400 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Void</span>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => removeItem(item.menuItem.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer Summary */}
              {items.length > 0 && (
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-emerald-100 dark:border-slate-800 space-y-4">
                  <div className="space-y-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="text-slate-900 dark:text-slate-100 font-black">
                        ₦{subtotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Campus Delivery</span>
                      <span className="text-slate-900 dark:text-slate-100 font-black">
                        ₦{deliveryFee.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-base font-black text-slate-900 dark:text-slate-100">
                      <span>Total</span>
                      <span className="text-[#0D472B] dark:text-emerald-400">₦{total.toLocaleString()}</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={!hasUnavailableItems ? { scale: 1.02 } : undefined}
                    whileTap={!hasUnavailableItems ? { scale: 0.98 } : undefined}
                    disabled={hasUnavailableItems}
                    onClick={handleProceedToCheckout}
                    className={`w-full font-black py-4 px-6 rounded-2xl flex items-center justify-between transition-all ${
                      hasUnavailableItems
                        ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        : 'bg-[#FF7A00] hover:bg-[#E65100] text-white shadow-lg shadow-orange-500/20 cursor-pointer'
                    }`}
                  >
                    <span>{hasUnavailableItems ? 'Remove Unavailable Items' : 'Proceed to Checkout'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

