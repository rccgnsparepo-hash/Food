import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  UtensilsCrossed,
  ArrowRight,
  Store,
  Clock,
  Star,
  Flame,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  ShoppingBag,
  Info,
  Check,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { useCartStore } from '../../stores/useCartStore';
import { UniversitySelector } from '../UniversitySelector';
import { FoodCard } from './FoodCard';
import { LazyImage } from '../ui/LazyImage';
import { MenuItem, Vendor } from '../../types';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';

interface HomeFeedProps {
  onSelectFood: (item: MenuItem) => void;
  onSelectRestaurant: (restaurant: Vendor) => void;
  onNavigateToMenu?: (vendorId?: string) => void;
}

interface ToppingOption {
  id: string;
  name: string;
  emoji: string;
  price: number;
  colorHex: string;
}

const AVAILABLE_TOPPINGS: ToppingOption[] = [
  { id: 'top-beef', name: 'Asun Goat Meat', emoji: '🥩', price: 600, colorHex: '#b45309' },
  { id: 'top-cheese', name: 'Double Mozzarella', emoji: '🧀', price: 400, colorHex: '#eab308' },
  { id: 'top-avocado', name: 'Fresh Avocado', emoji: '🥑', price: 350, colorHex: '#10b981' },
  { id: 'top-peppers', name: 'Chili Flakes', emoji: '🌶️', price: 150, colorHex: '#ef4444' },
  { id: 'top-garlic', name: 'Garlic Cream', emoji: '🧄', price: 250, colorHex: '#64748b' },
];

export const HomeFeed: React.FC<HomeFeedProps> = ({
  onSelectFood,
  onSelectRestaurant,
  onNavigateToMenu,
}) => {
  const { vendors, menuItems, isLoading } = useMarketplaceStore();
  const { addItem, setCartOpen } = useCartStore();

  // Featured Today Carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [portionQty, setPortionQty] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>(['top-beef']);
  const [droppedParticles, setDroppedParticles] = useState<
    { id: number; emoji: string; x: number; y: number; rotate: number }[]
  >([]);

  // Get top meals for Featured Today carousel
  const featuredMeals = menuItems.length > 0
    ? menuItems.slice(0, 4)
    : [];

  const currentMeal = featuredMeals[carouselIndex] || featuredMeals[0] || ({} as MenuItem);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying || featuredMeals.length <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featuredMeals.length);
      setDroppedParticles([]);
    }, 6000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, featuredMeals.length]);

  const handleNextSlide = () => {
    triggerHaptic(20);
    setCarouselIndex((prev) => (prev + 1) % featuredMeals.length);
    setDroppedParticles([]);
  };

  const handlePrevSlide = () => {
    triggerHaptic(20);
    setCarouselIndex((prev) => (prev - 1 + featuredMeals.length) % featuredMeals.length);
    setDroppedParticles([]);
  };

  // Pricing calculation
  const toppingsTotal = selectedToppings.reduce((sum, topId) => {
    const top = AVAILABLE_TOPPINGS.find((t) => t.id === topId);
    return sum + (top ? top.price : 0);
  }, 0);
  const basePrice = currentMeal?.base_price || currentMeal?.price || 1800;
  const grandTotal = (basePrice + toppingsTotal) * portionQty;

  const handleToggleTopping = (top: ToppingOption) => {
    triggerHaptic(40);
    const exists = selectedToppings.includes(top.id);
    if (exists) {
      setSelectedToppings((prev) => prev.filter((id) => id !== top.id));
    } else {
      setSelectedToppings((prev) => [...prev, top.id]);
      const newParticle = {
        id: Date.now() + Math.random(),
        emoji: top.emoji,
        x: (Math.random() - 0.5) * 120,
        y: (Math.random() - 0.5) * 120,
        rotate: (Math.random() - 0.5) * 60,
      };
      setDroppedParticles((prev) => [...prev.slice(-10), newParticle]);
    }
  };

  const handleAddHeroDishToCart = () => {
    if (!currentMeal?.id) return;
    triggerHaptic([60, 40, 60]);
    const optionsObj: Record<string, string> = {};
    if (selectedToppings.length > 0) {
      optionsObj['Toppings'] = selectedToppings
        .map((tId) => AVAILABLE_TOPPINGS.find((t) => t.id === tId)?.name)
        .filter(Boolean)
        .join(', ');
    }
    addItem(currentMeal, undefined, portionQty, optionsObj);
    setCartOpen(true);
  };

  // Get current meal's vendor name
  const currentVendor = vendors.find((v) => v.id === currentMeal?.vendor_id);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-12 pb-24 max-w-7xl mx-auto"
    >
      {/* Top University Selector Bar */}
      <UniversitySelector />

      {/* 1. FEATURED TODAY - HIGH-IMPACT FULL-WIDTH CAROUSEL */}
      <section
        className="relative"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D6001C]" />
            </span>
            <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
              Featured Today • Chef's Daily Picks
            </h2>
          </div>

          {/* Carousel Prev/Next Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevSlide}
              aria-label="Previous Featured Meal"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-rose-50 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextSlide}
              aria-label="Next Featured Meal"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-rose-50 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 rounded-3xl sm:rounded-[36px] overflow-hidden text-white shadow-2xl border border-rose-900/30">
          {/* Ambient Lighting FX */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D6001C]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <AnimatePresence mode="wait">
            {currentMeal && currentMeal.id ? (
              <motion.div
                key={currentMeal.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10 items-center"
              >
                {/* Left Content Area */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Badges & Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#D6001C] text-white text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-500/30">
                      <Flame className="w-3.5 h-3.5" />
                      <span>Featured Special #{carouselIndex + 1}</span>
                    </span>
                    <span className="bg-white/10 backdrop-blur-md text-rose-200 text-[11px] font-bold px-3 py-1 rounded-full border border-white/10 flex items-center gap-1">
                      <Store className="w-3 h-3 text-[#D6001C]" />
                      <span>{currentVendor?.name || 'MTU Campus Kitchen'}</span>
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>4.9 Star Rating</span>
                    </span>
                  </div>

                  {/* Meal Title & Description */}
                  <div>
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                      {currentMeal.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-2.5 max-w-xl leading-relaxed">
                      {currentMeal.description ||
                        'Slow-cooked with authentic spices and fresh campus ingredients. Prepared on demand for immediate pickup or delivery.'}
                    </p>
                  </div>

                  {/* Interactive Topping Sprinkle Customizer */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#D6001C]" />
                        Tap to add extras & drop toppings:
                      </span>
                      <span className="text-[11px] text-rose-300 font-bold">
                        {selectedToppings.length} selected
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_TOPPINGS.map((top) => {
                        const isSelected = selectedToppings.includes(top.id);
                        return (
                          <motion.button
                            key={top.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleToggleTopping(top)}
                            className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-[#D6001C] text-white border-red-500 shadow-md shadow-red-500/30'
                                : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                            }`}
                          >
                            <span className="text-sm">{top.emoji}</span>
                            <span>{top.name}</span>
                            <span className="text-[10px] opacity-80">(+₦{top.price})</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Portion, Price & Order Action Bar */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10">
                    {/* Portion Stepper */}
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-white/10">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          triggerHaptic(20);
                          setPortionQty(Math.max(1, portionQty - 1));
                        }}
                        className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </motion.button>
                      <span className="w-6 text-center font-black text-sm text-white">
                        {portionQty}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          triggerHaptic(20);
                          setPortionQty(portionQty + 1);
                        }}
                        className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>

                    {/* Dynamic Price */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                        Total Amount
                      </span>
                      <span className="text-2xl font-black text-white">
                        ₦{grandTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Add to Bag CTA */}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleAddHeroDishToCart}
                      className="flex-1 min-w-[150px] bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer ml-auto"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Bag</span>
                    </motion.button>
                  </div>
                </div>

                {/* Right Visual Area: Meal Showcase with Floating Dropped Particles */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                  <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#D6001C]/25 absolute blur-2xl pointer-events-none" />

                  {/* Circular Plate Container */}
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full p-2 border-4 border-white/20 shadow-2xl bg-white/5 flex items-center justify-center overflow-hidden">
                    <motion.div
                      className="w-full h-full rounded-full overflow-hidden relative cursor-pointer"
                      onClick={() => onSelectFood(currentMeal)}
                    >
                      <img
                        src={currentMeal.image_url || 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600'}
                        alt={currentMeal.name}
                        className="w-full h-full object-cover select-none pointer-events-none transform hover:scale-108 transition-transform duration-700"
                      />

                      {/* Dropped Particle Physics Layer */}
                      {droppedParticles.map((particle) => (
                        <motion.div
                          key={particle.id}
                          initial={{ y: -70, opacity: 0, scale: 0.2 }}
                          animate={{
                            y: particle.y,
                            x: particle.x,
                            opacity: 1,
                            scale: 1,
                            rotate: particle.rotate,
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow-md pointer-events-none z-20"
                        >
                          {particle.emoji}
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  <button
                    onClick={() => onSelectFood(currentMeal)}
                    className="mt-3 text-xs font-bold text-rose-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View Ingredients & Nutrition</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Carousel Progress Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {featuredMeals.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => {
                  triggerHaptic(20);
                  setCarouselIndex(idx);
                  setDroppedParticles([]);
                }}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  carouselIndex === idx
                    ? 'w-8 bg-[#D6001C]'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 2. QUICK ACTION TILES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigateToMenu && onNavigateToMenu()}
          className="bg-gradient-to-r from-rose-50 to-white border border-rose-100 rounded-3xl p-6 flex items-center justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[#D6001C] font-black text-xs uppercase tracking-wider">
              <UtensilsCrossed className="w-4 h-4" />
              <span>Full Marketplace Directory</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Browse All Meals by Stand & Category
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Explore custom filters for Rice, Swallows, Grills, Pastries, and Refreshing Drinks.
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#D6001C] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-red-500/20 shrink-0 ml-4">
            <ArrowRight className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigateToMenu && onNavigateToMenu()}
          className="bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-3xl p-6 flex items-center justify-between shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-rose-400 font-black text-xs uppercase tracking-wider">
              <Store className="w-4 h-4" />
              <span>Campus Kitchen Network</span>
            </div>
            <h3 className="text-xl font-black text-white">
              {vendors.length} Verified Food Stands & Bukas
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              Order directly with campus hostel delivery or express pickup stations.
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shrink-0 ml-4">
            <ChevronRight className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* 3. GRID LAYOUT CATEGORIZING MEALS BY VENDOR / KITCHEN */}
      <div className="space-y-12">
        <div className="flex items-center justify-between border-b border-rose-100 pb-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Meals by Kitchen & Stand
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Explore freshly prepared dishes arranged by each verified campus vendor.
            </p>
          </div>

          <button
            onClick={() => onNavigateToMenu && onNavigateToMenu()}
            className="text-xs font-extrabold text-[#D6001C] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Menu</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="h-10 bg-slate-200 rounded-2xl w-1/3" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-64 bg-slate-100 rounded-3xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {vendors.map((vendor) => {
              const vendorDishes = menuItems.filter((dish) => dish.vendor_id === vendor.id);
              if (vendorDishes.length === 0) return null;

              return (
                <section
                  key={vendor.id}
                  className="bg-white rounded-3xl sm:rounded-[32px] p-6 sm:p-8 border border-rose-100 shadow-xs space-y-6"
                >
                  {/* Vendor Stand Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-rose-50">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-rose-50 shrink-0 border border-rose-100 shadow-2xs">
                        <img
                          src={vendor.logo_url || vendor.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100'}
                          alt={vendor.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            {vendor.name}
                          </h3>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                            Open
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {vendor.description || 'Authentic dishes prepared fresh on campus.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-rose-50/80 px-3 py-1.5 rounded-xl border border-rose-100 text-xs font-bold text-slate-700">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{vendor.rating ? vendor.rating.toFixed(1) : '4.8'}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-rose-50/80 px-3 py-1.5 rounded-xl border border-rose-100 text-xs font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-[#D6001C]" />
                        <span>{vendor.opening_time || '07:30'} - {vendor.closing_time || '21:00'}</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (onNavigateToMenu) {
                            onNavigateToMenu(vendor.id);
                          } else {
                            onSelectRestaurant(vendor);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-[#D6001C] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <span>Full Menu ({vendorDishes.length})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Staggered Grid of Dishes for this Specific Vendor */}
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                  >
                    {vendorDishes.map((dish) => (
                      <motion.div
                        key={dish.id}
                        variants={staggerItem}
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      >
                        <FoodCard item={dish} onSelect={onSelectFood} />
                      </motion.div>
                    ))}
                  </motion.div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
