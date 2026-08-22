import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  MapPin,
  Heart,
  QrCode,
  ShieldCheck,
  Zap,
  X,
  Ban,
  AlertTriangle,
  History,
  Trash2
} from 'lucide-react';
import { useMarketplaceStore } from '../../stores/useMarketplaceStore';
import { useCartStore } from '../../stores/useCartStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFavoriteStore } from '../../stores/useFavoriteStore';
import { getItemAvailability } from '../../utils/availability';
import { FoodCard } from './FoodCard';
import { BukkitLogo } from '../common/BukkitLogo';
import { MenuItem, Vendor } from '../../types';
import { pageVariants, staggerContainer, staggerItem } from '../../utils/motion';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';

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
}

const AVAILABLE_TOPPINGS: ToppingOption[] = [
  { id: 'top-beef', name: 'Asun Goat Meat', emoji: '🥩', price: 600 },
  { id: 'top-plantain', name: 'Fried Dodo', emoji: '🍌', price: 300 },
  { id: 'top-egg', name: 'Boiled Egg', emoji: '🥚', price: 200 },
  { id: 'top-chicken', name: 'Grilled Chicken', emoji: '🍗', price: 800 },
  { id: 'top-pepper', name: 'Ata Din Din', emoji: '🌶️', price: 150 },
];

const FOOD_CATEGORIES = [
  { id: 'all', label: 'All Dishes', emoji: '🍽️' },
  { id: 'rice', label: 'With Rice', emoji: '🍚' },
  { id: 'swallow', label: 'Swallow & Soups', emoji: '🍲' },
  { id: 'grill', label: 'Grills & Suya', emoji: '🍗' },
  { id: 'pastry', label: 'Shawarma & Bread', emoji: '🥐' },
  { id: 'drink', label: 'Drinks & Chill', emoji: '🥤' },
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
];

export const HomeFeed: React.FC<HomeFeedProps> = ({
  onSelectFood,
  onSelectRestaurant,
  onNavigateToMenu,
}) => {
  const { vendors, menuItems, isLoading } = useMarketplaceStore();
  const { addItem, setCartOpen, getItemQuantity } = useCartStore();
  const { user } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoriteStore();

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bukkit_recent_searches');
      return saved ? JSON.parse(saved) : ['Jollof Rice', 'Shawarma', 'Suya', 'Cold Drinks'];
    } catch {
      return ['Jollof Rice', 'Shawarma', 'Suya', 'Cold Drinks'];
    }
  });

  const saveSearchTerm = (term: string) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== cleaned.toLowerCase());
      const next = [cleaned, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('bukkit_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleRemoveHistoryItem = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(20);
    setSearchHistory((prev) => {
      const next = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem('bukkit_recent_searches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearHistory = () => {
    triggerHaptic(30);
    setSearchHistory([]);
    try {
      localStorage.removeItem('bukkit_recent_searches');
    } catch {}
  };

  // Featured Today Dish Showcase state (Inspired by Inspiration 3 & 4)
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [portionQty, setPortionQty] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>(['top-beef']);

  // Get top meals for Interactive Dish Showcase
  const showcaseMeals = useMemo(() => {
    return menuItems.length > 0 ? menuItems.slice(0, 5) : [];
  }, [menuItems]);

  const currentMeal = showcaseMeals[showcaseIndex] || showcaseMeals[0] || ({} as MenuItem);
  const currentVendorId = currentMeal?.vendor_id || currentMeal?.restaurant_id;
  const currentMealVendor = currentVendorId ? vendors.find((v) => v.id === currentVendorId) : undefined;
  const showcaseAvailability = getItemAvailability(currentMeal, currentMealVendor);

  const isMealFavorite = isFavorite(currentMeal?.id);

  // Auto-advance showcase
  useEffect(() => {
    if (!isAutoPlaying || showcaseMeals.length <= 1) return;
    const timer = setInterval(() => {
      setShowcaseIndex((prev) => (prev + 1) % showcaseMeals.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, showcaseMeals.length]);

  const handleNextSlide = () => {
    triggerHaptic(20);
    setShowcaseIndex((prev) => (prev + 1) % showcaseMeals.length);
  };

  const handlePrevSlide = () => {
    triggerHaptic(20);
    setShowcaseIndex((prev) => (prev - 1 + showcaseMeals.length) % showcaseMeals.length);
  };

  // Pricing calculation for featured item
  const toppingsTotal = selectedToppings.reduce((sum, topId) => {
    const top = AVAILABLE_TOPPINGS.find((t) => t.id === topId);
    return sum + (top ? top.price : 0);
  }, 0);
  const basePrice = currentMeal?.base_price || currentMeal?.price || 1800;
  const grandTotal = (basePrice + toppingsTotal) * portionQty;

  const handleToggleTopping = (top: ToppingOption) => {
    if (!showcaseAvailability.isAvailable) return;
    triggerHaptic(30);
    const exists = selectedToppings.includes(top.id);
    if (exists) {
      setSelectedToppings((prev) => prev.filter((id) => id !== top.id));
    } else {
      setSelectedToppings((prev) => [...prev, top.id]);
    }
  };

  const handleAddShowcaseDishToCart = () => {
    if (!currentMeal?.id) return;
    if (!showcaseAvailability.isAvailable) {
      toast.error(`Cannot add: ${showcaseAvailability.reasonText}`);
      return;
    }
    triggerHaptic([60, 40, 60]);
    const optionsObj: Record<string, string> = {};
    if (selectedToppings.length > 0) {
      optionsObj['Toppings'] = selectedToppings
        .map((tId) => AVAILABLE_TOPPINGS.find((t) => t.id === tId)?.name)
        .filter(Boolean)
        .join(', ');
    }
    const success = addItem(currentMeal, currentMealVendor, portionQty, optionsObj);
    if (success) {
      setCartOpen(true);
    }
  };

  // Filtered meals based on search & category
  const filteredMeals = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category_id?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'all' ||
        (item.category_id && item.category_id.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchesSearch && matchesCat;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Full Screen Skeleton Loading state for high perceived performance
  if (isLoading) {
    return (
      <div className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-1 sm:px-2 animate-pulse">
        {/* Location & Search Header Skeleton */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl bg-slate-200/80 dark:bg-slate-800" />
              <div className="space-y-1.5">
                <div className="w-24 h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded" />
                <div className="w-44 h-4 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
              </div>
            </div>
            <div className="w-36 h-7 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
          </div>

          {/* Search Bar Skeleton */}
          <div className="h-12 bg-slate-200/70 dark:bg-slate-800 rounded-2xl w-full" />

          {/* Category Chips Skeleton */}
          <div className="flex gap-2 overflow-hidden pt-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-8 w-24 bg-slate-200/70 dark:bg-slate-800 rounded-full shrink-0" />
            ))}
          </div>
        </div>

        {/* Featured Showcase Skeleton */}
        <div className="h-72 sm:h-80 bg-gradient-to-r from-slate-200/90 to-slate-200/60 dark:from-slate-800 dark:to-slate-900 rounded-3xl w-full shadow-xs" />

        {/* Kitchen Stands Rail Skeleton */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <div className="w-40 h-5 bg-slate-200/80 dark:bg-slate-800 rounded" />
            <div className="w-16 h-4 bg-slate-200/80 dark:bg-slate-800 rounded" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-44 h-28 bg-slate-200/70 dark:bg-slate-800 rounded-3xl shrink-0" />
            ))}
          </div>
        </div>

        {/* Popular Meals Grid Skeleton */}
        <div className="space-y-3">
          <div className="w-48 h-5 bg-slate-200/80 dark:bg-slate-800 rounded px-1" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-3 border border-slate-100 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="aspect-square bg-slate-200/80 dark:bg-slate-800 rounded-2xl w-full" />
                <div className="space-y-1.5">
                  <div className="w-2/3 h-4 bg-slate-200/80 dark:bg-slate-800 rounded" />
                  <div className="w-1/2 h-3 bg-slate-200/60 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="w-16 h-5 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
                  <div className="w-7 h-7 bg-slate-200/80 dark:bg-slate-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-1 sm:px-2"
    >
      {/* 1. TOP LOCATION & LIVE SEARCH BAR */}
      <div className="space-y-3">
        {/* Delivery Location Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-2 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-[#0D472B] dark:text-emerald-400 border border-emerald-100/80 dark:border-slate-700 shadow-2xs">
              <MapPin className="w-4 h-4 text-[#FF7A00]" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 block uppercase tracking-wider leading-tight">
                DELIVERING TO CAMPUS SPOT
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100 truncate max-w-[220px] sm:max-w-none text-sm">
                {user?.address || 'Mountain Top University Campus'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0D472B]/10 dark:bg-emerald-950/40 text-[#0D472B] dark:text-emerald-400 text-[11px] font-black px-3 py-1.5 rounded-full border border-[#0D472B]/20 dark:border-emerald-800/40 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-ping" />
            <span>Campus Express: ~15-20 mins</span>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#0D472B] dark:text-emerald-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                saveSearchTerm(searchQuery);
              }
            }}
            placeholder="Search party jollof, amala, suya chicken, shawarma, cold drinks..."
            className="w-full bg-white dark:bg-slate-900 border border-emerald-100/90 dark:border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs focus:outline-none focus:border-[#0D472B] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D472B]/10 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recent Search History Chips */}
        {searchHistory.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1">
              <History className="w-3 h-3 text-slate-400" />
              <span>Recent:</span>
            </span>
            {searchHistory.map((item) => (
              <button
                key={item}
                onClick={() => {
                  triggerHaptic(20);
                  setSearchQuery(item);
                  saveSearchTerm(item);
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  searchQuery.toLowerCase() === item.toLowerCase()
                    ? 'bg-[#0D472B] dark:bg-emerald-700 text-white border-emerald-800 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:text-[#0D472B] dark:hover:text-emerald-400'
                }`}
              >
                <span>{item}</span>
                <span
                  onClick={(e) => handleRemoveHistoryItem(item, e)}
                  className="text-slate-400 hover:text-red-500 rounded-full p-0.5"
                  title="Remove"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </button>
            ))}
            <button
              onClick={handleClearHistory}
              className="text-[10px] font-bold text-slate-400 hover:text-red-500 shrink-0 px-2 py-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Category Filter Chips Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          {FOOD_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic(20);
                  setSelectedCategory(cat.id);
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                  isSelected
                    ? 'bg-[#0D472B] dark:bg-emerald-700 text-white border-emerald-800 dark:border-emerald-600 shadow-xs shadow-emerald-900/20'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-emerald-50/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. INSPIRATION BANNER 1: "SATISFY YOUR HUNGER NOW" CAMPUS BANNER (Inspired by Image 4) */}
      {!searchQuery && selectedCategory === 'all' && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0D472B] via-[#0A3A22] to-[#FF7A00] p-5 sm:p-7 text-white shadow-xl border border-emerald-800/40">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#FF7A00] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  BUKKIT CAMPUS EXPRESS
                </span>
                <span className="bg-white/15 text-emerald-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 border border-white/10">
                  <MapPin className="w-3 h-3 text-[#FF7A00]" />
                  <span>Mountain Top University • Ibafo / Prayer City</span>
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Satisfy Your Campus Hunger Now!
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-medium max-w-xl leading-relaxed">
                Deliciously crafted, freshly served meals from registered MTU cafeteria kitchens delivered hot to hostels, lecture halls, and offices in 15–20 minutes.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigateToMenu && onNavigateToMenu()}
                  className="px-5 py-2.5 bg-[#FF7A00] hover:bg-[#E65100] text-white rounded-full font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-orange-950/20 cursor-pointer transition-colors"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>Order MTU Food Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>

                <div className="flex items-center gap-2 text-xs font-bold text-white/90 bg-black/20 px-3 py-2 rounded-full backdrop-blur-xs border border-white/10">
                  <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Avg Delivery: 18 Mins</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 hidden md:flex flex-col items-center justify-center text-center space-y-2 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
              <QrCode className="w-16 h-16 text-white" />
              <span className="text-[11px] font-black text-white uppercase tracking-wider">
                Scan to Track & Pickup
              </span>
              <span className="text-[10px] text-emerald-200 font-medium">
                Live verification with verified MTU riders
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 3. INSPIRATION DISH SHOWCASE: INTERACTIVE DISH HERO (Inspired by Image 3) */}
      {showcaseMeals.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A00] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF7A00]" />
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Chef's Daily Spotlight Meals
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevSlide}
                aria-label="Previous special"
                className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 text-[#0D472B] dark:text-emerald-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextSlide}
                aria-label="Next special"
                className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 text-[#0D472B] dark:text-emerald-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs font-bold"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Showcase Card Layout (Inspiration 3 format) */}
          <div className="bg-gradient-to-br from-white via-emerald-50/30 to-orange-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 rounded-3xl border border-emerald-100/90 dark:border-slate-800 shadow-lg p-4 sm:p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Left Column: Quick Dish Selectors Column (Inspiration 3 Circular Thumbnails) */}
              <div className="lg:col-span-2 flex lg:flex-col items-center gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
                <span className="hidden lg:block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Picks ({showcaseMeals.length})
                </span>
                {showcaseMeals.map((dish, idx) => {
                  const isActive = idx === showcaseIndex;
                  return (
                    <motion.button
                      key={dish.id}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        triggerHaptic(20);
                        setShowcaseIndex(idx);
                      }}
                      className={`relative rounded-2xl p-1 transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                        isActive
                          ? 'ring-2 ring-[#FF7A00] bg-[#FF7A00]/10 shadow-md shadow-orange-500/10'
                          : 'opacity-70 hover:opacity-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                        <img
                          src={dish.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150'}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="hidden xl:block text-left pr-2">
                        <p className={`text-xs font-black truncate max-w-[90px] ${isActive ? 'text-[#0D472B] dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {dish.name}
                        </p>
                        <p className="text-[10px] font-bold text-[#FF7A00]">
                          ₦{dish.base_price || dish.price || 1500}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Center Column: Big Dish Showcase Presentation Plate */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
                <AnimatePresence mode="wait">
                  {currentMeal && currentMeal.id && (
                    <motion.div
                      key={currentMeal.id}
                      initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.92, rotate: 3 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="relative flex flex-col items-center"
                    >
                      {/* Big Plate Shadow & Frame */}
                      <div
                        onClick={() => onSelectFood(currentMeal)}
                        className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-full p-2 bg-white dark:bg-slate-800 shadow-2xl shadow-emerald-950/15 border-4 border-white dark:border-slate-700 cursor-pointer group"
                      >
                        <div className="w-full h-full rounded-full overflow-hidden">
                          <img
                            src={
                              currentMeal.image_url ||
                              'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600'
                            }
                            alt={currentMeal.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                        </div>
                        {/* Rating floating pill */}
                        <div className="absolute top-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-black text-slate-800 dark:text-slate-200 shadow-md border border-slate-100 dark:border-slate-700 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>4.9</span>
                        </div>
                      </div>

                      {/* Tap to inspect badge */}
                      <button
                        onClick={() => onSelectFood(currentMeal)}
                        className="mt-3 text-[11px] font-black text-[#0D472B] dark:text-emerald-400 hover:text-[#FF7A00] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>View Nutritional Facts & Recipe Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Column: Dish Specs, Extras & Add to Bag */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#0D472B] dark:bg-emerald-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      TOP SPECIAL
                    </span>
                    <span className="bg-emerald-100 dark:bg-slate-800 text-[#0D472B] dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-transparent dark:border-slate-700">
                      <Store className="w-3 h-3 text-[#FF7A00]" />
                      <span>{currentMeal.restaurant_name || 'MTU Campus Stand'}</span>
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      if (user?.uid && currentMeal?.id) {
                        toggleFavorite(user.uid, currentMeal.id, 'menu_item');
                      }
                    }}
                    className="p-2 rounded-full bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isMealFavorite ? 'fill-[#FF7A00] text-[#FF7A00]' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    {currentMeal.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed line-clamp-2">
                    {currentMeal.description ||
                      'Authentic Nigerian campus delicacy prepared fresh in MTU kitchens with rich spices.'}
                  </p>
                </div>

                {/* Extras & Toppings Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FF7A00]" />
                    <span>Select Portions & Extras:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_TOPPINGS.map((top) => {
                      const isSelected = selectedToppings.includes(top.id);
                      return (
                        <button
                          key={top.id}
                          onClick={() => handleToggleTopping(top)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-[#0D472B] dark:bg-emerald-700 text-white border-emerald-900 shadow-xs'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span>{top.emoji}</span>
                          <span>{top.name}</span>
                          <span className="text-[10px] opacity-80">+₦{top.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stepper, Grand Price & Add to Bag (Inspiration 3 Style) */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        triggerHaptic(20);
                        setPortionQty(Math.max(1, portionQty - 1));
                      }}
                      className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black shadow-2xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-black text-sm text-slate-900 dark:text-slate-100">
                      {portionQty}
                    </span>
                    <button
                      onClick={() => {
                        triggerHaptic(20);
                        setPortionQty(portionQty + 1);
                      }}
                      className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-black uppercase tracking-wider">
                      TOTAL
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                      ₦{grandTotal.toLocaleString()}
                    </span>
                  </div>

                  {!showcaseAvailability.isAvailable ? (
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-extrabold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed ml-auto select-none">
                      <Ban className="w-3.5 h-3.5 text-rose-500" />
                      <span>{showcaseAvailability.badgeLabel}</span>
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleAddShowcaseDishToCart}
                      className="flex-1 bg-[#FF7A00] hover:bg-[#E65100] text-white font-black py-3 px-4 rounded-2xl shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer ml-auto transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Bag</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. VERIFIED CAMPUS KITCHENS / STANDS RAIL */}
      {vendors.length > 0 && !searchQuery && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                MTU Registered Food Kitchens & Stands
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Order from certified on-campus cafeteria partners</p>
            </div>
            <button
              onClick={() => onNavigateToMenu && onNavigateToMenu()}
              className="text-xs font-extrabold text-[#0D472B] dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>See All Stands</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {vendors.map((vendor) => {
              const isVendorOpen = vendor.is_open !== false && vendor.is_active !== false && vendor.kitchen_details?.operating_status !== 'closed';
              return (
                <motion.div
                  key={vendor.id}
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (onNavigateToMenu) onNavigateToMenu(vendor.id);
                    else onSelectRestaurant(vendor);
                  }}
                  className="min-w-[210px] sm:min-w-[230px] bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-emerald-100/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3 shrink-0"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 shrink-0">
                    <img
                      src={vendor.logo_url || vendor.cover_image_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100'}
                      alt={vendor.name}
                      className={`w-full h-full object-cover ${!isVendorOpen ? 'grayscale-40' : ''}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {vendor.name}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="font-bold">{vendor.rating ? vendor.rating.toFixed(1) : '4.8'}</span>
                      <span>•</span>
                      {isVendorOpen ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">Open Now</span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400 font-bold">Closed</span>
                      )}
                    </div>
                    <span className="text-[9px] text-[#FF7A00] font-black block mt-0.5 truncate uppercase">
                      {vendor.estimated_delivery_time || '15-25 min delivery'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. MAIN FOOD MEALS GRID */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {searchQuery
                ? `Search results for "${searchQuery}" (${filteredMeals.length})`
                : selectedCategory !== 'all'
                ? `Category: ${FOOD_CATEGORIES.find((c) => c.id === selectedCategory)?.label || ''} (${filteredMeals.length})`
                : 'Popular Campus Meals'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Fresh dishes cooked daily on campus</p>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-[#0D472B] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-56 bg-slate-200/70 dark:bg-slate-800 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredMeals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-emerald-100 dark:border-slate-800 text-center space-y-3">
            <UtensilsCrossed className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">No dishes found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              We couldn't find any meals matching your search. Try checking another category or clearing your query.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-[#0D472B] dark:bg-emerald-700 text-white text-xs font-bold rounded-full cursor-pointer hover:bg-emerald-800"
            >
              Show All Meals
            </button>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5"
          >
            {filteredMeals.map((dish) => (
              <motion.div key={dish.id} variants={staggerItem}>
                <FoodCard item={dish} onSelect={onSelectFood} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
};
