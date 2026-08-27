import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  AlertTriangle,
  Ban,
  Store,
  Flame,
  ShieldAlert,
  Leaf,
  Activity,
  CheckCircle2,
  Info
} from 'lucide-react';
import { MenuItem } from '../../types';
import { useCartStore } from '../../stores/useCartStore';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { getItemAvailability } from '../../utils/availability';
import { triggerHaptic, triggerHapticSuccess, triggerHapticSelection } from '../../utils/haptics';
import { modalOverlayVariants, modalDialogVariants } from '../../utils/motion';
import { toast } from 'sonner';

interface FoodDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({ item, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'nutrition' | 'reviews'>('details');
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const { addItem, setCartOpen } = useCartStore();
  const { user } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoriteStore();
  const { vendors } = useMarketplaceStore();

  const vendorId = item?.vendor_id || item?.restaurant_id;
  const vendor = vendorId ? vendors.find((v) => v.id === vendorId) : undefined;
  const availability = getItemAvailability(item, vendor);

  const favorite = item ? isFavorite(item.id) : false;

  // Extract Nutritional & Dietary Properties from Firestore
  const calories = item?.calories ?? item?.nutritional_info?.calories;
  const protein = item?.protein ?? item?.macros?.protein ?? item?.nutritional_info?.protein;
  const carbs = item?.carbs ?? item?.macros?.carbs ?? item?.nutritional_info?.carbs;
  const fat = item?.fat ?? item?.macros?.fat ?? item?.nutritional_info?.fat;
  const fiber = item?.fiber ?? item?.macros?.fiber ?? item?.nutritional_info?.fiber;
  const allergens = (item?.allergens && item.allergens.length > 0) ? item.allergens : [];
  const ingredients = (item?.ingredients && item.ingredients.length > 0) ? item.ingredients : [];
  const dietaryTags = (item?.dietary_tags && item.dietary_tags.length > 0) ? item.dietary_tags : [];
  const hasNutritionalData = Boolean(calories || protein || carbs || fat || fiber || allergens.length > 0 || ingredients.length > 0);

  // Scroll lock when modal is open
  useEffect(() => {
    if (item) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [item]);

  if (!item) return null;

  const handleAddToCart = () => {
    if (!availability.isAvailable) {
      toast.error(`Cannot add: ${availability.reasonText}`);
      return;
    }
    triggerHapticSuccess();
    const success = addItem(item, vendor, quantity, selectedOptions);
    if (success) {
      onClose();
      setCartOpen(true);
    }
  };

  const handleOptionSelect = (optionName: string, choiceName: string) => {
    if (!availability.isAvailable) return;
    triggerHapticSelection();
    setSelectedOptions((prev) => ({ ...prev, [optionName]: choiceName }));
  };

  const rawPrice = item.base_price ?? item.price ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        variants={modalOverlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      >
        <motion.div
          variants={modalDialogVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-b from-[#0D472B] via-[#0A3A22] to-[#0D472B] w-full max-w-lg min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:rounded-3xl overflow-y-auto relative flex flex-col justify-between shadow-2xl"
        >
          {/* Top Navigation Bar */}
          <div className="p-6 flex items-center justify-between text-white z-20">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                triggerHaptic(20);
                onClose();
              }}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                triggerHaptic(30);
                if (user?.uid) toggleFavorite(user.uid, item.id, 'menu_item');
              }}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${favorite ? 'fill-[#FF7A00] text-[#FF7A00]' : ''}`} />
            </motion.button>
          </div>

          {/* Food Photography Image */}
          <div className="relative w-full pt-2 pb-10 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-60 h-60 sm:w-68 sm:h-68 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl z-10 bg-white/10 relative"
            >
              <img
                src={
                  item.image_url ||
                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'
                }
                alt={item.name}
                className={`w-full h-full object-cover transform hover:scale-108 transition-transform duration-500 ${
                  !availability.isAvailable ? 'grayscale-40 opacity-80' : ''
                }`}
              />
              {!availability.isAvailable && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-3 text-center">
                  <Ban className="w-8 h-8 text-rose-400 mb-1" />
                  <span className="text-xs font-black uppercase tracking-wider bg-rose-600 px-3 py-1 rounded-full shadow-md">
                    {availability.badgeLabel}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* White Rounded Bottom Content Sheet */}
          <div className="bg-white rounded-t-[36px] p-6 sm:p-8 space-y-5 z-20 shadow-xl flex-1 flex flex-col justify-between text-slate-900">
            <div>
              {/* Availability Alert Banner (Strict Void notification) */}
              {!availability.isAvailable && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-3 text-rose-900"
                >
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-black text-rose-800 uppercase tracking-wide">
                      {availability.badgeLabel} — Cannot Order
                    </p>
                    <p className="text-rose-700 font-medium mt-0.5 leading-relaxed">
                      {availability.reasonText} This item cannot be added to your cart at this time.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Title & Price Row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {item.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1 text-[#0D472B] font-bold">
                      <Store className="w-3.5 h-3.5" />
                      {vendor?.name || 'Verified Campus Kitchen'}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{item.category_id?.replace('cat_', '') || 'Special'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#0D472B]">
                    ₦{Number(rawPrice).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details vs Nutrition vs Reviews Pill Tab Selector */}
              <div className="flex items-center gap-2 mt-5 border-b border-slate-100 pb-3 overflow-x-auto">
                <button
                  onClick={() => {
                    triggerHapticSelection();
                    setActiveTab('details');
                  }}
                  className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all cursor-pointer ${
                    activeTab === 'details'
                      ? 'bg-[#0D472B] text-white shadow-md shadow-emerald-950/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => {
                    triggerHapticSelection();
                    setActiveTab('nutrition');
                  }}
                  className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'nutrition'
                      ? 'bg-[#0D472B] text-white shadow-md shadow-emerald-950/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Nutrition</span>
                  {calories && <span className="text-[10px] opacity-80">({calories} kcal)</span>}
                </button>
                <button
                  onClick={() => {
                    triggerHapticSelection();
                    setActiveTab('reviews');
                  }}
                  className={`px-4 py-2 rounded-full font-bold text-xs tracking-wide transition-all cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'bg-[#0D472B] text-white shadow-md shadow-emerald-950/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Reviews ({item.rating ? `${item.rating.toFixed(1)} ★` : '4.9 ★'})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' ? (
                <div className="mt-4 space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                    {showFullDesc ? item.description : (item.description || '').slice(0, 140)}
                    {(item.description || '').length > 140 && (
                      <button
                        onClick={() => setShowFullDesc(!showFullDesc)}
                        className="text-[#FF7A00] font-bold ml-1 hover:underline cursor-pointer"
                      >
                        {showFullDesc ? 'Show less' : 'See more.'}
                      </button>
                    )}
                  </p>

                  {/* Quick Nutritional / Allergen Summary Bar */}
                  {hasNutritionalData && (
                    <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 text-[#0D472B] rounded-xl">
                          <Flame className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 block">
                            {calories ? `${calories} Calories (kcal)` : 'Nutritional Info Available'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {protein ? `Protein: ${protein}g • ` : ''}
                            {carbs ? `Carbs: ${carbs}g • ` : ''}
                            {fat ? `Fats: ${fat}g` : 'Prepared fresh on campus'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          triggerHapticSelection();
                          setActiveTab('nutrition');
                        }}
                        className="text-xs font-bold text-[#0D472B] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                      </button>
                    </div>
                  )}

                  {/* Allergen Warning Banner if present */}
                  {allergens.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold uppercase text-[10px] text-amber-800 tracking-wider block">
                          Allergen Advisory
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {allergens.map((alg, i) => (
                            <span key={i} className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                              {alg}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Optional Customization Choices */}
                  {item.options && item.options.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {item.options.map((opt) => (
                        <div key={opt.name}>
                          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1.5">
                            {opt.name}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {opt.choices.map((c) => {
                              const isSelected = selectedOptions[opt.name] === c.name;
                              return (
                                <button
                                  key={c.name}
                                  disabled={!availability.isAvailable}
                                  onClick={() => handleOptionSelect(opt.name, c.name)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                    !availability.isAvailable
                                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                      : isSelected
                                      ? 'bg-emerald-50 border-[#0D472B] text-[#0D472B]'
                                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                                  }`}
                                >
                                  {c.name} {c.price > 0 && `(+₦${c.price})`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'nutrition' ? (
                /* Dedicated Nutrition & Allergen Tab */
                <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                  {/* Calories Banner */}
                  <div className="bg-gradient-to-r from-orange-50 to-emerald-50 border border-orange-100 p-4 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-500/20">
                        <Flame className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                          Energy & Caloric Content
                        </span>
                        <h4 className="text-xl font-black text-slate-900">
                          {calories ? `${calories} kcal` : 'Caloric info pending'}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.portion_description || 'Standard Campus Portion Serving'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Macronutrients 4-Grid Breakdown */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                      Macronutrient Breakdown
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Protein */}
                      <div className="bg-emerald-50 border border-emerald-200/60 p-3 rounded-2xl text-center space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider block">Protein</span>
                        <p className="text-base font-black text-[#0D472B]">{protein ? `${protein}g` : '—'}</p>
                        <span className="text-[9px] text-emerald-700 font-medium block">Muscle support</span>
                      </div>

                      {/* Carbs */}
                      <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-2xl text-center space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider block">Carbs</span>
                        <p className="text-base font-black text-amber-900">{carbs ? `${carbs}g` : '—'}</p>
                        <span className="text-[9px] text-amber-700 font-medium block">Campus energy</span>
                      </div>

                      {/* Fats */}
                      <div className="bg-rose-50 border border-rose-200/60 p-3 rounded-2xl text-center space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-rose-800 tracking-wider block">Fats</span>
                        <p className="text-base font-black text-rose-900">{fat ? `${fat}g` : '—'}</p>
                        <span className="text-[9px] text-rose-700 font-medium block">Essential lipids</span>
                      </div>

                      {/* Fiber */}
                      <div className="bg-blue-50 border border-blue-200/60 p-3 rounded-2xl text-center space-y-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider block">Dietary Fiber</span>
                        <p className="text-base font-black text-blue-900">{fiber ? `${fiber}g` : '—'}</p>
                        <span className="text-[9px] text-blue-700 font-medium block">Digestion</span>
                      </div>
                    </div>
                  </div>

                  {/* Allergen Declarations & Dietary Tags */}
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-3xl space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Allergen Information
                      </h4>
                    </div>

                    {allergens.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-600 font-medium">
                          This dish contains or was prepared in an environment containing:
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {allergens.map((alg, i) => (
                            <span
                              key={i}
                              className="bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>{alg}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>No major common allergens reported by this campus kitchen.</span>
                      </div>
                    )}

                    {/* Dietary Tags */}
                    {dietaryTags.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                          Dietary Highlights
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {dietaryTags.map((tag, i) => (
                            <span key={i} className="bg-emerald-50 text-[#0D472B] border border-emerald-200 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fresh Ingredients List */}
                  {ingredients.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-3xl space-y-2">
                      <div className="flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-[#0D472B]" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                          Fresh Ingredients
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ingredients.map((ing, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-xl text-xs font-medium"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">David O. (MTU Biochemistry)</span>
                      <span className="text-amber-500 font-bold">★★★★★</span>
                    </div>
                    <p className="text-slate-600">Super fresh and delicious! Arrived piping hot in Daniel Hall.</p>
                  </div>
                  <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Grace A. (MTU Economics)</span>
                      <span className="text-amber-500 font-bold">★★★★★</span>
                    </div>
                    <p className="text-slate-600">Great portion size and accurate macro nutrition details for student workouts! 10/10 recommendation.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Row: Quantity Selectors & Add To Cart Button */}
            <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
                <motion.button
                  whileHover={availability.isAvailable ? { scale: 1.1 } : undefined}
                  whileTap={availability.isAvailable ? { scale: 0.9 } : undefined}
                  disabled={!availability.isAvailable}
                  onClick={() => {
                    triggerHaptic(25);
                    setQuantity(Math.max(1, quantity - 1));
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform ${
                    availability.isAvailable
                      ? 'bg-[#0D472B] text-white cursor-pointer'
                      : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Minus className="w-4 h-4 stroke-[3]" />
                </motion.button>
                <span className="w-8 text-center font-extrabold text-base text-slate-900">
                  {quantity}
                </span>
                <motion.button
                  whileHover={availability.isAvailable ? { scale: 1.1 } : undefined}
                  whileTap={availability.isAvailable ? { scale: 0.9 } : undefined}
                  disabled={!availability.isAvailable}
                  onClick={() => {
                    triggerHaptic(25);
                    setQuantity(quantity + 1);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform ${
                    availability.isAvailable
                      ? 'bg-[#0D472B] text-white cursor-pointer'
                      : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </motion.button>
              </div>

              {!availability.isAvailable ? (
                <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-400 font-extrabold py-4 px-6 rounded-full flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed select-none">
                  <Ban className="w-4 h-4 text-rose-500" />
                  <span>{availability.badgeLabel} — Void</span>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#FF7A00] hover:bg-[#E65100] text-white font-extrabold py-4 px-6 rounded-full shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to cart • ₦{(Number(rawPrice) * quantity).toLocaleString()}</span>
                </motion.button>
              )}
            </div>

          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};



