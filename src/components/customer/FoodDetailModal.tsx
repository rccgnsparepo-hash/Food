import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Minus, Plus, ShoppingBag } from 'lucide-react';
import { MenuItem } from '../../types';
import { useCartStore } from '../../stores/useCartStore';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { triggerHaptic } from '../../utils/haptics';
import { modalOverlayVariants, modalDialogVariants } from '../../utils/motion';

interface FoodDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({ item, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const { addItem, setCartOpen } = useCartStore();
  const { user } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoriteStore();

  const favorite = item ? isFavorite(item.id) : false;

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
    triggerHaptic([50, 30, 50]);
    addItem(item, undefined, quantity, selectedOptions);
    onClose();
    setCartOpen(true);
  };

  const handleOptionSelect = (optionName: string, choiceName: string) => {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: choiceName }));
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={modalOverlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-0 sm:p-4 overflow-y-auto"
      >
        <motion.div
          variants={modalDialogVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-[#D6001C] w-full max-w-lg min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:rounded-3xl overflow-y-auto relative flex flex-col justify-between shadow-2xl"
        >
          {/* Top Navigation Bar on Red Backdrop */}
          <div className="p-6 flex items-center justify-between text-white z-20">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => user?.uid && toggleFavorite(user.uid, item.id, 'menu_item')}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${favorite ? 'fill-white text-white' : ''}`} />
            </motion.button>
          </div>

          {/* Curved Header Arch & Food Photography Image */}
          <div className="relative w-full pt-4 pb-12 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl z-10 bg-white/10"
            >
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
              />
            </motion.div>
          </div>

          {/* White Rounded Bottom Content Sheet */}
          <div className="bg-white rounded-t-[36px] p-6 sm:p-8 space-y-6 z-20 shadow-xl flex-1 flex flex-col justify-between text-slate-900">
            <div>
              {/* Title & Price Row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {item.name}
                  </h2>
                  <span className="text-xs font-semibold text-slate-400 capitalize block mt-0.5">
                    Category: Campus Special
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#D6001C]">
                    ₦{item.price.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details vs Reviews Pill Tab Selector */}
              <div className="flex items-center gap-3 mt-6 border-b border-rose-100 pb-4">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-6 py-2 rounded-full font-bold text-xs tracking-wide transition-all cursor-pointer ${
                    activeTab === 'details'
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`px-6 py-2 rounded-full font-bold text-xs tracking-wide transition-all cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'bg-[#D6001C] text-white shadow-md shadow-red-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Reviews (4.9 ★)
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' ? (
                <div className="mt-4 space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                    {showFullDesc ? item.description : item.description.slice(0, 140)}
                    {item.description.length > 140 && (
                      <button
                        onClick={() => setShowFullDesc(!showFullDesc)}
                        className="text-[#D6001C] font-bold ml-1 hover:underline cursor-pointer"
                      >
                        {showFullDesc ? 'Show less' : 'See more.'}
                      </button>
                    )}
                  </p>

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
                                  onClick={() => handleOptionSelect(opt.name, c.name)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-rose-50 border-[#D6001C] text-[#D6001C]'
                                      : 'bg-slate-50 border-slate-200 text-slate-600'
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
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">David O.</span>
                      <span className="text-amber-500 font-bold">★★★★★</span>
                    </div>
                    <p className="text-slate-600">Super fresh and delicious! Arrived piping hot in my hostel.</p>
                  </div>
                  <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Grace A.</span>
                      <span className="text-amber-500 font-bold">★★★★★</span>
                    </div>
                    <p className="text-slate-600">Great portion size for MTU student budget! 10/10 recommendation.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Row: Quantity Selectors & Add To Cart Button */}
            <div className="pt-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-[#D6001C] text-white flex items-center justify-center font-bold transition-transform cursor-pointer"
                >
                  <Minus className="w-4 h-4 stroke-[3]" />
                </motion.button>
                <span className="w-8 text-center font-extrabold text-base text-slate-900">
                  {quantity}
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-xl bg-[#D6001C] text-white flex items-center justify-center font-bold transition-transform cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </motion.button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleAddToCart}
                className="flex-1 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-4 px-6 rounded-full shadow-xl shadow-red-500/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to cart</span>
              </motion.button>
            </div>

          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

