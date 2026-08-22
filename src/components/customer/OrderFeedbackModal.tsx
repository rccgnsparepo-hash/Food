import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Utensils, Bike, Check, Sparkles, MessageSquare, ThumbsUp, Send } from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

interface OrderFeedbackModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSubmitted?: (updatedOrder: Order) => void;
}

const FOOD_TAGS = [
  'Hot & Fresh',
  'Delicious Taste',
  'Generous Portion',
  'Authentic Recipe',
  'Great Packaging',
  'Crispy & Well Done',
  'Perfect Spice Level',
];

const DELIVERY_TAGS = [
  'Super Fast Delivery',
  'Friendly Rider',
  'Handed with Care',
  'Followed Instructions',
  'Arrived on Time',
  'Neatly Bagged',
];

export const OrderFeedbackModal: React.FC<OrderFeedbackModalProps> = ({
  order,
  isOpen,
  onClose,
  onFeedbackSubmitted,
}) => {
  const [foodRating, setFoodRating] = useState<number>(order.food_rating || 5);
  const [deliveryRating, setDeliveryRating] = useState<number>(order.delivery_rating || 5);
  const [selectedTags, setSelectedTags] = useState<string[]>(order.feedback_tags || ['Hot & Fresh', 'Super Fast Delivery']);
  const [comment, setComment] = useState<string>(order.feedback_comment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    triggerHaptic(20);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getFoodRatingLabel = (score: number) => {
    switch (score) {
      case 1: return 'Poor 😕';
      case 2: return 'Fair 😐';
      case 3: return 'Good 🙂';
      case 4: return 'Very Good! 😋';
      case 5: return 'Delicious! 🔥';
      default: return '';
    }
  };

  const getDeliveryRatingLabel = (score: number) => {
    switch (score) {
      case 1: return 'Slow 🐢';
      case 2: return 'Okay 🛵';
      case 3: return 'Good 🚴';
      case 4: return 'Fast! ⚡';
      case 5: return 'Lightning Fast! 🚀';
      default: return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (foodRating === 0 || deliveryRating === 0) {
      toast.error('Please select star ratings for both food and delivery.');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic([40, 60, 40]);

    try {
      const now = new Date().toISOString();
      const feedbackPayload = {
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        feedback_tags: selectedTags,
        feedback_comment: comment.trim(),
        rated_at: now,
        updated_at: now,
      };

      // 1. Update master order document in Firestore
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, feedbackPayload).catch(async () => {
        // In case doc structure needs merge
        await setDoc(orderRef, feedbackPayload, { merge: true });
      });

      // 2. Also log to public order_ratings collection for campus metrics
      const ratingLogRef = doc(db, 'order_ratings', order.id);
      await setDoc(ratingLogRef, {
        order_id: order.id,
        customer_id: order.customer_id || order.user_id,
        customer_name: order.customer_name || order.user_name || 'BUKKIT Student',
        vendor_id: order.vendor_id || order.restaurant_id,
        vendor_name: order.vendor_name || order.restaurant_name,
        rider_id: order.rider_id || null,
        rider_name: order.rider_name || null,
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        feedback_tags: selectedTags,
        feedback_comment: comment.trim(),
        created_at: now,
      }, { merge: true }).catch(() => {});

      const updatedOrder: Order = {
        ...order,
        ...feedbackPayload,
      };

      toast.success('🎉 Thank you for your feedback! Rating saved.');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(updatedOrder);
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving feedback:', err);
      toast.error('Could not save feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-rose-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#D6001C] to-red-700 text-white p-5 flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <h2 className="text-base sm:text-lg font-black tracking-tight">Rate Your Order Experience</h2>
              </div>
              <p className="text-xs text-red-100 font-medium mt-0.5">
                {order.vendor_name || order.restaurant_name} • #{order.id.slice(-6)}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer relative z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* 1. Food Quality Rating */}
            <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-100/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-black text-xs sm:text-sm">
                  <Utensils className="w-4 h-4 text-[#D6001C]" />
                  <span>How was the Food?</span>
                </div>
                <span className="text-xs font-black text-[#D6001C]">
                  {getFoodRatingLabel(foodRating)}
                </span>
              </div>

              {/* Star Selector */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      triggerHaptic(30);
                      setFoodRating(star);
                    }}
                    className="p-1.5 focus:outline-none transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        star <= foodRating
                          ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Delivery Experience Rating */}
            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-black text-xs sm:text-sm">
                  <Bike className="w-4 h-4 text-emerald-600" />
                  <span>How was the Delivery?</span>
                </div>
                <span className="text-xs font-black text-emerald-700">
                  {getDeliveryRatingLabel(deliveryRating)}
                </span>
              </div>

              {/* Star Selector */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      triggerHaptic(30);
                      setDeliveryRating(star);
                    }}
                    className="p-1.5 focus:outline-none transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        star <= deliveryRating
                          ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Quick Tag Chips */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-[#D6001C]" />
                <span>What did you like most?</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[...FOOD_TAGS, ...DELIVERY_TAGS].map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#D6001C] text-white border-[#D6001C] shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Optional Written Review */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#D6001C]" />
                  <span>Leave a Comment (Optional)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{comment.length}/300</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Tell us what was great or how we can improve your campus dining experience..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#D6001C] focus:ring-2 focus:ring-red-500/10 transition-all resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-2 py-3 text-xs font-black text-white bg-[#D6001C] hover:bg-[#B50018] rounded-full transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Rating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
