import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import { triggerHaptic } from '../../utils/haptics';

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
    getSubtotal,
    getDeliveryFee,
    getServiceFee,
    getTotal
  } = useCartStore();

  // Scroll lock when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();
  const serviceFee = getServiceFee();
  const total = getTotal();

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

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between"
            >
              
              {/* Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-6 h-6 text-[#D6001C]" />
                  <div>
                    <h2 className="font-extrabold text-lg text-white">Your Cart</h2>
                    <p className="text-xs text-slate-400">
                      {items.length} {items.length === 1 ? 'item' : 'items'} selected
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCartOpen(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Cart Items List */}
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700">Your cart is empty</p>
                    <p className="text-xs text-slate-400">Add delicious meals to get started!</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <motion.div
                      key={item.menuItem.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/80 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <img
                        src={item.menuItem.image_url}
                        alt={item.menuItem.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {item.menuItem.name}
                        </h4>
                        <span className="text-xs font-bold text-[#D6001C]">
                          ₦{(item.menuItem.price * item.quantity).toLocaleString()}
                        </span>

                        {/* Options list */}
                        {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {Object.entries(item.selectedOptions).map(([k, v]) => (
                              <span key={k} className="mr-2">• {v}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-rose-100">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                          className="p-1 hover:text-[#D6001C] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </motion.button>
                        <span className="text-xs font-extrabold w-4 text-center">
                          {item.quantity}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                          className="p-1 hover:text-[#D6001C] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>

                      {/* Delete Item */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeItem(item.menuItem.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Cost Summary & Checkout Action */}
              {items.length > 0 && (
                <div className="p-6 bg-slate-50 border-t border-rose-100 space-y-4">
                  <div className="space-y-2 text-xs font-medium text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-900">₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-bold text-slate-900">₦{deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fee (5%)</span>
                      <span className="font-bold text-slate-900">₦{serviceFee.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                      <span>Total</span>
                      <span className="text-[#D6001C]">₦{total.toLocaleString()}</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      triggerHaptic(60);
                      setCartOpen(false);
                      onCheckout();
                    }}
                    className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-4 rounded-2xl shadow-xl shadow-red-500/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
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

