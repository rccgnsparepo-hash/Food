import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, ThumbsUp, MessageSquare, Check, Sparkles, Edit3, Send, Utensils, Bike, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, updateDoc, setDoc } from "../../lib/embeddedDb";
import { db } from '../../lib/firebase';
import { Order, FoodReview } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { triggerHaptic, triggerHapticSuccess } from '../../utils/haptics';
import { toast } from 'sonner';

interface CompletedOrderReviewCardProps {
  order: Order;
  onReviewSaved: (updatedOrder: Order) => void;
  onOpenModal?: () => void;
}

const QUICK_TAGS = [
  'Hot & Fresh',
  'Generous Portion',
  'Delicious Taste',
  'Super Fast Delivery',
  'Friendly Rider',
  'Great Packaging',
  'Authentic Spices'
];

export const CompletedOrderReviewCard: React.FC<CompletedOrderReviewCardProps> = ({
  order,
  onReviewSaved,
  onOpenModal
}) => {
  const { user } = useAuthStore();
  const { addReview } = useMarketplaceStore();

  const isAlreadyReviewed = Boolean(order.food_rating || order.delivery_rating);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!isAlreadyReviewed);

  const [foodRating, setFoodRating] = useState<number>(order.food_rating || 5);
  const [deliveryRating, setDeliveryRating] = useState<number>(order.delivery_rating || 5);
  const [hoveredFood, setHoveredFood] = useState<number>(0);
  const [hoveredDelivery, setHoveredDelivery] = useState<number>(0);

  const [selectedTags, setSelectedTags] = useState<string[]>(
    order.feedback_tags && order.feedback_tags.length > 0
      ? order.feedback_tags
      : ['Hot & Fresh', 'Super Fast Delivery']
  );
  const [comment, setComment] = useState<string>(order.feedback_comment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getFoodLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor 😕';
      case 2: return 'Fair 😐';
      case 3: return 'Good 🙂';
      case 4: return 'Delicious! 😋';
      case 5: return 'Exceptional! 🔥';
      default: return 'Select rating';
    }
  };

  const getDeliveryLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Slow 🐢';
      case 2: return 'Okay 🛵';
      case 3: return 'Good 🚴';
      case 4: return 'Fast! ⚡';
      case 5: return 'Lightning Fast! 🚀';
      default: return 'Select rating';
    }
  };

  const toggleTag = (tag: string) => {
    triggerHaptic(20);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (foodRating === 0 || deliveryRating === 0) {
      toast.error('Please tap to select star ratings for your meal and delivery.');
      return;
    }

    setIsSubmitting(true);
    triggerHapticSuccess();

    try {
      const now = new Date().toISOString();
      const feedbackPayload = {
        rating: foodRating,
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        feedback_tags: selectedTags,
        feedback_comment: comment.trim(),
        rated_at: now,
        updated_at: now
      };

      // 1. Update order in Firestore
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, feedbackPayload).catch(async () => {
        await setDoc(orderRef, feedbackPayload, { merge: true });
      });

      // 2. Also log to public order_ratings for campus aggregation
      const ratingLogRef = doc(db, 'order_ratings', order.id);
      await setDoc(ratingLogRef, {
        order_id: order.id,
        customer_id: order.customer_id || order.user_id || user?.uid || '',
        customer_name: order.customer_name || order.user_name || user?.name || 'BUKKIT Student',
        vendor_id: order.vendor_id || order.restaurant_id || '',
        vendor_name: order.vendor_name || order.restaurant_name || '',
        rider_id: order.rider_id || null,
        rider_name: order.rider_name || null,
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        feedback_tags: selectedTags,
        feedback_comment: comment.trim(),
        created_at: now
      }, { merge: true }).catch(() => {});

      // 3. Post to food_reviews collection so it updates vendor marketplace ratings
      const vendorId = order.vendor_id || order.restaurant_id;
      if (vendorId) {
        const reviewRecord: FoodReview = {
          id: `rev_${order.id}`,
          order_id: order.id,
          user_id: order.customer_id || order.user_id || user?.uid || 'student',
          user_name: order.customer_name || order.user_name || user?.name || 'MTU Student',
          user_avatar: user?.avatar_url,
          vendor_id: vendorId,
          taste_rating: foodRating,
          portion_rating: foodRating,
          value_rating: foodRating,
          service_rating: deliveryRating,
          cleanliness_rating: 5,
          overall_rating: foodRating,
          comment: comment.trim() || selectedTags.join(', '),
          would_buy_again: foodRating >= 3,
          created_at: now
        };

        try {
          await addReview(reviewRecord);
        } catch (revErr) {
          console.warn('[Review sync notice]:', revErr);
        }
      }

      const updated: Order = {
        ...order,
        ...feedbackPayload
      };

      toast.success('🎉 Feedback saved! Thank you for rating your meal.');
      setIsEditing(false);
      setIsExpanded(true);
      onReviewSaved(updated);
    } catch (err: any) {
      console.error('Feedback submission error:', err);
      toast.error('Could not save feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: Already reviewed summary card (when not editing)
  // -------------------------------------------------------------
  if (isAlreadyReviewed && !isEditing) {
    return (
      <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-3.5 space-y-2.5 transition-all text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-extrabold text-amber-900 dark:text-amber-200 block text-[11px]">
                Your Order Review & Feedback
              </span>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400">
                Delivered {order.rated_at ? `• Rated on ${new Date(order.rated_at).toLocaleDateString()}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(20);
                setIsEditing(true);
                setIsExpanded(true);
              }}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 rounded-xl font-bold text-[11px] border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Food Rating Display */}
          <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">Meal Quality:</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${
                      s <= (order.food_rating || 5)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                ))}
              </div>
              <span className="font-black text-amber-800 dark:text-amber-300 ml-1 text-[11px]">
                {order.food_rating || 5}/5
              </span>
            </div>
          </div>

          {/* Delivery Rating Display */}
          <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">Rider Delivery:</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${
                      s <= (order.delivery_rating || 5)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                ))}
              </div>
              <span className="font-black text-amber-800 dark:text-amber-300 ml-1 text-[11px]">
                {order.delivery_rating || 5}/5
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {order.feedback_tags && order.feedback_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {order.feedback_tags.map((t, idx) => (
              <span
                key={idx}
                className="bg-amber-100/90 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold"
              >
                ✓ {t}
              </span>
            ))}
          </div>
        )}

        {/* Comment */}
        {order.feedback_comment && (
          <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl text-slate-700 dark:text-slate-300 text-[11px] italic border border-amber-100 dark:border-amber-900/30">
            "{order.feedback_comment}"
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Interactive Rating & Review Form (Unrated or Editing)
  // -------------------------------------------------------------
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-linear-to-b from-rose-50/80 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 border border-rose-200 dark:border-slate-700 rounded-2xl p-4 space-y-3.5 shadow-xs transition-all text-xs"
    >
      <div className="flex items-center justify-between border-b border-rose-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#D6001C]/10 text-[#D6001C] dark:text-rose-400 rounded-xl">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
              {isEditing ? 'Update Your Order Review' : 'Rate Your Meal & Delivery'}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Help your campus peers and kitchen vendors maintain high quality
            </p>
          </div>
        </div>

        {isEditing && (
          <button
            onClick={() => {
              triggerHaptic(20);
              setIsEditing(false);
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* SECTION A: Meal Quality Stars */}
      <div className="space-y-1.5 bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-[#D6001C] dark:text-rose-400" />
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">Meal Quality</span>
          </div>
          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
            {getFoodLabel(hoveredFood || foodRating)}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoveredFood || foodRating);
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredFood(star)}
                  onMouseLeave={() => setHoveredFood(0)}
                  onClick={() => {
                    triggerHaptic(25);
                    setFoodRating(star);
                  }}
                  className="p-1 rounded-lg hover:scale-115 transition-transform cursor-pointer"
                  title={`${star} Star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-6 h-6 ${
                      active
                        ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-200'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono font-black text-slate-400 ml-1">
            ({foodRating}/5)
          </span>
        </div>
      </div>

      {/* SECTION B: Courier & Delivery Speed Stars */}
      <div className="space-y-1.5 bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
              Delivery Experience & Courier
            </span>
          </div>
          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
            {getDeliveryLabel(hoveredDelivery || deliveryRating)}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoveredDelivery || deliveryRating);
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredDelivery(star)}
                  onMouseLeave={() => setHoveredDelivery(0)}
                  onClick={() => {
                    triggerHaptic(25);
                    setDeliveryRating(star);
                  }}
                  className="p-1 rounded-lg hover:scale-115 transition-transform cursor-pointer"
                  title={`${star} Star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-6 h-6 ${
                      active
                        ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-200'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono font-black text-slate-400 ml-1">
            ({deliveryRating}/5)
          </span>
        </div>
      </div>

      {/* SECTION C: Feedback Quick Tags */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
          What went well? (Tap tags to include)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION D: Review Comment Input */}
      <div className="space-y-1">
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: How was the flavor, temperature, or courier handoff? Leave your review..."
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#D6001C] dark:focus:border-rose-400 focus:ring-1 focus:ring-[#D6001C] transition-all resize-none"
        />
      </div>

      {/* SECTION E: Actions */}
      <div className="flex items-center justify-between pt-1">
        {onOpenModal ? (
          <button
            type="button"
            onClick={onOpenModal}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
          >
            Detailed Review Modal
          </button>
        ) : <div />}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSubmit()}
          className="px-5 py-2.5 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isSubmitting ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isSubmitting ? 'Saving Review...' : isEditing ? 'Update Review' : 'Submit Review'}</span>
        </motion.button>
      </div>
    </div>
  );
};
