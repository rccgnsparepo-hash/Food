import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChefHat, Bike, CheckCircle2, Sparkles, Clock, Flame, MapPin, PackageCheck, AlertCircle } from 'lucide-react';
import { OrderStatus } from '../../types';

interface OrderStatusAnimationProps {
  status: OrderStatus;
  vendorName?: string;
  riderName?: string | null;
  deliveryCode?: string;
}

export const OrderStatusAnimation: React.FC<OrderStatusAnimationProps> = ({
  status,
  vendorName = 'Campus Kitchen',
  riderName,
  deliveryCode
}) => {
  // Determine normalized high-level state
  const isPreparing = [
    'pending',
    'payment_confirmed',
    'accepted',
    'vendor_accepted',
    'preparing',
    'ready',
    'ready_for_pickup'
  ].includes(status);

  const isOutForDelivery = [
    'assigned',
    'rider_assigned',
    'rider_arrived_vendor',
    'picked_up',
    'on_the_way',
    'out_for_delivery',
    'arrived_at_delivery'
  ].includes(status);

  const isDelivered = status === 'delivered';
  const isCancelled = ['cancelled', 'failed_delivery', 'refunded'].includes(status);

  const activeStageKey = isCancelled
    ? 'cancelled'
    : isDelivered
    ? 'delivered'
    : isOutForDelivery
    ? 'out_for_delivery'
    : 'preparing';

  return (
    <div className="w-full bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 overflow-hidden relative">
      {/* Background ambient decorative glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#D6001C]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. THREE-STAGE STEPPER PIPELINE */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between text-xs font-black">
          {/* Stage 1: Preparing */}
          <div className="flex flex-col items-center gap-1.5 z-10 flex-1">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isPreparing
                  ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/30 shadow-lg shadow-amber-500/30 scale-110'
                  : isOutForDelivery || isDelivered
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isOutForDelivery || isDelivered ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ChefHat className="w-5 h-5 animate-bounce" />
              )}
            </div>
            <span
              className={`text-[11px] uppercase tracking-wider text-center font-extrabold ${
                isPreparing
                  ? 'text-amber-400'
                  : isOutForDelivery || isDelivered
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              Preparing
            </span>
          </div>

          {/* Connector 1 */}
          <div className="flex-1 h-1 mx-2 bg-slate-800 rounded-full overflow-hidden relative -mt-5">
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{
                width: isOutForDelivery || isDelivered ? '100%' : isPreparing ? '50%' : '0%'
              }}
            />
          </div>

          {/* Stage 2: Out for Delivery */}
          <div className="flex flex-col items-center gap-1.5 z-10 flex-1">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isOutForDelivery
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30 shadow-lg shadow-emerald-500/30 scale-110'
                  : isDelivered
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isDelivered ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Bike className={`w-5 h-5 ${isOutForDelivery ? 'animate-pulse' : ''}`} />
              )}
            </div>
            <span
              className={`text-[11px] uppercase tracking-wider text-center font-extrabold ${
                isOutForDelivery
                  ? 'text-emerald-400'
                  : isDelivered
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              Out for Delivery
            </span>
          </div>

          {/* Connector 2 */}
          <div className="flex-1 h-1 mx-2 bg-slate-800 rounded-full overflow-hidden relative -mt-5">
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{
                width: isDelivered ? '100%' : isOutForDelivery ? '50%' : '0%'
              }}
            />
          </div>

          {/* Stage 3: Delivered */}
          <div className="flex flex-col items-center gap-1.5 z-10 flex-1">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isDelivered
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30 shadow-lg shadow-emerald-500/40 scale-110'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <PackageCheck className="w-5 h-5" />
            </div>
            <span
              className={`text-[11px] uppercase tracking-wider text-center font-extrabold ${
                isDelivered ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              Delivered
            </span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC STATE ANIMATION CONTAINER */}
      <AnimatePresence mode="wait">
        {/* ========================================================= */}
        {/* STATE A: PREPARING (Cooking, Sizzle & Steam Animation)     */}
        {/* ========================================================= */}
        {activeStageKey === 'preparing' && (
          <motion.div
            key="anim-preparing"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center text-center space-y-4 py-3"
          >
            {/* Animated Cooking Pot / Sizzle Visual */}
            <div className="relative w-36 h-28 flex items-center justify-center">
              {/* Animated Steam Clouds rising */}
              <div className="absolute -top-3 flex justify-center gap-3 w-full">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [-4, -22, -34],
                      opacity: [0, 0.85, 0],
                      scale: [0.7, 1.2, 1.5],
                      x: [0, i % 2 === 0 ? 5 : -5, 0]
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: i * 0.45,
                      ease: 'easeOut'
                    }}
                    className="w-3.5 h-3.5 rounded-full bg-white/70 blur-xs"
                  />
                ))}
              </div>

              {/* Glowing Cooking Pan / Wok Body */}
              <div className="relative z-10 w-24 h-14 bg-linear-to-b from-slate-700 to-slate-800 rounded-b-3xl border-2 border-slate-600 shadow-2xl flex items-center justify-center overflow-hidden">
                {/* Sizzling food ingredients inside */}
                <motion.div
                  animate={{ rotate: [0, 4, -4, 0], y: [0, -2, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="flex items-center gap-1 text-amber-400"
                >
                  <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                </motion.div>
              </div>

              {/* Pan handles */}
              <div className="absolute bottom-6 -left-2 w-4 h-2 bg-slate-600 rounded-full" />
              <div className="absolute bottom-6 -right-2 w-4 h-2 bg-slate-600 rounded-full" />

              {/* Radiant Heat Glow Beneath */}
              <motion.div
                animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-1 w-20 h-4 bg-orange-500/60 rounded-full blur-md"
              />
            </div>

            {/* Status Information */}
            <div className="space-y-1 max-w-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Kitchen Preparing Meal</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {vendorName} is cooking your order
              </h3>
              <p className="text-xs text-slate-400">
                Ingredients are being freshly prepped, seasoned, and packaged for campus delivery.
              </p>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* STATE B: OUT FOR DELIVERY (Moving Courier Bike Animation) */}
        {/* ========================================================= */}
        {activeStageKey === 'out_for_delivery' && (
          <motion.div
            key="anim-delivery"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center text-center space-y-4 py-3"
          >
            {/* Courier in Motion Visual Stage */}
            <div className="relative w-full max-w-xs h-28 flex flex-col items-center justify-center overflow-hidden">
              {/* Wind motion streaks */}
              <div className="absolute inset-0 flex flex-col justify-around opacity-30 pointer-events-none">
                {[0, 1, 2].map((idx) => (
                  <motion.div
                    key={idx}
                    animate={{ x: [160, -160] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: idx * 0.3,
                      ease: 'linear'
                    }}
                    className="h-0.5 w-12 bg-emerald-300 rounded-full"
                  />
                ))}
              </div>

              {/* Animated Courier Bike with Bouncing Rider */}
              <motion.div
                animate={{ y: [0, -3, 0, -2, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 flex items-center gap-2"
              >
                {/* Pulsing GPS Radar rings around courier */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 relative shadow-xl shadow-emerald-900/30">
                    <Bike className="w-9 h-9 text-emerald-400 drop-shadow-md" />
                  </div>
                  {/* Radar ripple */}
                  <motion.span
                    animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl border-2 border-emerald-400 pointer-events-none"
                  />
                </div>
              </motion.div>

              {/* Road beneath courier with backward-scrolling dashes */}
              <div className="w-56 h-1.5 bg-slate-800 rounded-full relative overflow-hidden mt-3 border border-slate-700">
                <motion.div
                  animate={{ x: [0, -40] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                  className="flex gap-4 w-96"
                >
                  {[...Array(12)].map((_, i) => (
                    <span key={i} className="w-4 h-1.5 bg-emerald-400/80 rounded-full shrink-0" />
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Status Information */}
            <div className="space-y-1 max-w-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rider In Transit</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {riderName ? `${riderName} is on the way!` : 'Courier is heading to your drop-off'}
              </h3>
              <p className="text-xs text-slate-400">
                Keep your 4-digit PIN ({deliveryCode || '4829'}) ready to verify meal handoff at your hall.
              </p>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* STATE C: DELIVERED (Celebration, Confetti & Cloche)       */}
        {/* ========================================================= */}
        {activeStageKey === 'delivered' && (
          <motion.div
            key="anim-delivered"
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -15 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
            className="flex flex-col items-center justify-center text-center space-y-4 py-3 relative"
          >
            {/* Confetti & Sparkles burst in background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[
                { x: -50, y: -30, color: 'bg-amber-400', size: 'w-2 h-2' },
                { x: 45, y: -35, color: 'bg-emerald-400', size: 'w-2.5 h-2.5' },
                { x: -60, y: 20, color: 'bg-rose-400', size: 'w-2 h-2' },
                { x: 55, y: 25, color: 'bg-teal-400', size: 'w-2 h-2' },
                { x: -20, y: -45, color: 'bg-purple-400', size: 'w-1.5 h-1.5' },
                { x: 25, y: -45, color: 'bg-yellow-300', size: 'w-2 h-2' }
              ].map((c, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [0, c.y, c.y + 10],
                    x: [0, c.x],
                    opacity: [0, 1, 0.4],
                    scale: [0.5, 1.2, 0.9],
                    rotate: [0, 180]
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                  className={`absolute rounded-sm ${c.color} ${c.size}`}
                />
              ))}
            </div>

            {/* Glowing Big Checkmark Badge */}
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-3xl bg-linear-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/40 border-2 border-emerald-300 relative z-10"
            >
              <CheckCircle2 className="w-11 h-11 text-white" />
            </motion.div>

            {/* Status Information */}
            <div className="space-y-1 max-w-sm relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>Handoff Complete</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Meal Delivered Successfully!
              </h3>
              <p className="text-xs text-slate-300">
                Thank you for ordering with BUKKIT! Remember to share feedback in your order history.
              </p>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* STATE D: CANCELLED (Safe Fallback)                        */}
        {/* ========================================================= */}
        {activeStageKey === 'cancelled' && (
          <motion.div
            key="anim-cancelled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center text-center space-y-2 py-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-black text-white">Order Cancelled or Refunded</h3>
            <p className="text-xs text-slate-400">
              Any charged funds have been securely restored to your BUKKIT student wallet.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
