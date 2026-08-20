import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { useCartStore } from './stores/useCartStore';
import { useMarketplaceStore } from './stores/useMarketplaceStore';
import { seedInitialDataIfNeeded } from './lib/seed';
import { MenuItem } from './types';

import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';

import { SplashOnboarding } from './components/customer/SplashOnboarding';
import { HomeFeed } from './components/customer/HomeFeed';
import { MenuView } from './components/customer/MenuView';
import { VendorsView } from './components/customer/VendorsView';
import { WalletDealsView } from './components/customer/WalletDealsView';
import { FoodDetailModal } from './components/customer/FoodDetailModal';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutModal } from './components/customer/CheckoutModal';
import { OrderTracking } from './components/customer/OrderTracking';
import { FavoritesView } from './components/customer/FavoritesView';
import { OrdersHistory } from './components/customer/OrdersHistory';

import { RiderDashboard } from './components/rider/RiderDashboard';
import { KitchenDashboard } from './components/kitchen/KitchenDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { AuthGatewayPage } from './components/auth/AuthGatewayPage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { User, LogOut, Phone, MapPin, Shield, KeyRound, MailWarning, Bell, CheckCircle } from 'lucide-react';
import { requestFCMToken, setupForegroundFCMListener } from './lib/fcm';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { useRealtimeNotifications } from './services/notificationService';

export default function App() {
  const { initAuth, user, role, setRole, logout, isInitLoading, isEmailVerified } = useAuthStore();
  const { isOpen: isCartOpen, setCartOpen } = useCartStore();
  const { initMarketplace } = useMarketplaceStore();

  const [activeView, setActiveView] = useState<string>('home');
  const [targetVendorId, setTargetVendorId] = useState<string | undefined>(undefined);
  const [selectedFood, setSelectedFood] = useState<MenuItem | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [fcmPermissionGranted, setFcmPermissionGranted] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);

  // Deep Link Navigator for Push Notifications and In-App Drawer clicks
  const handleNavigateToDeepLink = (link: string) => {
    if (!link) return;
    if (link.includes('/orders/')) {
      const parts = link.split('/orders/');
      const orderId = parts[1]?.split('?')[0];
      if (orderId) {
        setTrackingOrderId(orderId);
        setActiveView('tracking');
      } else {
        setActiveView('orders');
      }
    } else if (link.includes('/wallet')) {
      setActiveView('wallet');
    } else if (link.includes('/menu')) {
      setActiveView('menu');
    } else if (link.includes('/vendors')) {
      setActiveView('vendors');
    } else if (link.includes('/profile')) {
      setActiveView('profile');
    }
  };

  // Centralized Real-time Notifications Hook
  const { unreadCount, refetch } = useRealtimeNotifications(handleNavigateToDeepLink);

  useEffect(() => {
    const unsub = initAuth();
    initMarketplace();
    seedInitialDataIfNeeded();

    // Check notification permission state
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setFcmPermissionGranted(Notification.permission === 'granted');
    }

    // Setup foreground FCM notification handler
    let unsubFcm: (() => void) | undefined;
    setupForegroundFCMListener().then((unsubFn) => {
      unsubFcm = unsubFn;
    });

    // Listen for service worker deep link navigation messages
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BUKKIT_NOTIFICATION_CLICK' && event.data.deepLink) {
        handleNavigateToDeepLink(event.data.deepLink);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      unsub();
      if (unsubFcm) unsubFcm();
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  const handleStartMealOrder = () => {
    setActiveView('home');
  };

  const handleOrderCreated = (orderId: string) => {
    setShowCheckout(false);
    setTrackingOrderId(orderId);
    setActiveView('tracking');
  };

  // 1. Initial Page Load State
  if (isInitLoading) {
    return (
      <div className="min-h-screen bg-[#F9ECEC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-[#D6001C] text-white rounded-3xl font-black text-3xl flex items-center justify-center shadow-xl shadow-red-500/30 animate-pulse mb-4">
          B
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">BUKKIT MARKETPLACE</h2>
        <p className="text-xs font-extrabold text-[#D6001C] uppercase tracking-widest mt-1">Mountain Top University • Prayer City</p>
        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-500">
          <div className="w-4 h-4 border-2 border-[#D6001C] border-t-transparent rounded-full animate-spin"></div>
          <span>Loading BUKKIT Marketplace...</span>
        </div>
      </div>
    );
  }

  // 2. HARD GATE ACCESS: User MUST log in before doing or seeing anything in the app
  if (!user) {
    return <AuthGatewayPage />;
  }

  const isGuest = user.uid.startsWith('guest_');

  return (
    <div className="min-h-screen bg-[#F9ECEC] text-slate-900 font-sans antialiased selection:bg-[#D6001C] selection:text-white">
      {/* Real-time Network Connectivity Resilience Banner */}
      <NetworkStatusBanner />

      {/* 1. Splash / Onboarding Screen */}
      {activeView === 'splash' ? (
        <SplashOnboarding onStart={handleStartMealOrder} />
      ) : (
        <div className="flex flex-col min-h-screen">
          
          {/* Top Sticky Navigation */}
          <Navbar
            onOpenCart={() => setCartOpen(true)}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setShowAuthModal(true);
            }}
            onOpenNotifications={() => setShowNotificationCenter(true)}
            unreadNotificationsCount={unreadCount}
            activeView={activeView}
            setActiveView={setActiveView}
          />

          {/* Email Verification Banner if logged in via Auth with unverified email */}
          {!isEmailVerified && !isGuest && (
            <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-extrabold flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <MailWarning className="w-4 h-4 shrink-0" />
                <span>Your email address is not verified yet. Please check your inbox.</span>
              </div>
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-full hover:bg-black transition-colors"
              >
                Verify
              </button>
            </div>
          )}

          {/* Main View Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
            <ErrorBoundary>
              {/* Customer Views: Strictly home, menu, vendors, wallet, orders, tracking, profile */}
              {role === 'customer' && (
                <>
                  {activeView === 'home' && (
                    <HomeFeed
                      onSelectFood={(item) => setSelectedFood(item)}
                      onSelectRestaurant={(vendor) => {
                        setTargetVendorId(vendor.id);
                        setActiveView('menu');
                      }}
                      onNavigateToMenu={(vendorId) => {
                        setTargetVendorId(vendorId);
                        setActiveView('menu');
                      }}
                    />
                  )}

                  {activeView === 'menu' && (
                    <MenuView
                      onSelectFood={(item) => setSelectedFood(item)}
                      initialVendorId={targetVendorId}
                    />
                  )}

                  {activeView === 'vendors' && (
                    <VendorsView
                      onSelectRestaurant={(vendor) => {
                        setTargetVendorId(vendor.id);
                        setActiveView('menu');
                      }}
                      onExploreMenuForVendor={(vendorId) => {
                        setTargetVendorId(vendorId);
                        setActiveView('menu');
                      }}
                    />
                  )}

                  {activeView === 'wallet' && <WalletDealsView />}

                  {activeView === 'favorites' && (
                    <FavoritesView onSelectFood={(item) => setSelectedFood(item)} />
                  )}

                  {activeView === 'orders' && (
                    <OrdersHistory
                      onTrackOrder={(ordId) => {
                        setTrackingOrderId(ordId);
                        setActiveView('tracking');
                      }}
                    />
                  )}

                  {activeView === 'tracking' && trackingOrderId && (
                    <OrderTracking
                      orderId={trackingOrderId}
                      onBack={() => setActiveView('orders')}
                    />
                  )}

                  {activeView === 'profile' && (
                    <div className="max-w-md mx-auto bg-white rounded-3xl p-8 shadow-xs border border-rose-100 text-center space-y-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#D6001C] mx-auto shadow-md">
                        <img
                          src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'user')}`}
                          alt={user?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-xl text-slate-900">{user?.name}</h2>
                        <p className="text-xs text-slate-400 font-medium">{user?.email}</p>
                        <span className="inline-block mt-1 bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          Account: {user?.role || role}
                        </span>
                      </div>

                      <div className="bg-rose-50/80 p-4 rounded-2xl text-xs text-slate-700 space-y-2 text-left border border-rose-100">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#D6001C]" />
                          <span>{user?.phone || '+234 810 000 0000'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#D6001C]" />
                          <span>{user?.address || 'Mountain Top University Campus'}</span>
                        </div>
                      </div>

                      {/* FCM Notifications Setting Box */}
                      <div className="bg-slate-900 text-white p-4 rounded-2xl text-xs text-left space-y-2 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-200">
                            <Bell className="w-4 h-4 text-[#D6001C]" />
                            <span>Live Order Notifications</span>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${fcmPermissionGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                            {fcmPermissionGranted ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Receive real-time push alerts when the kitchen prepares your meal and the rider heads your way.
                        </p>
                        {!fcmPermissionGranted && (
                          <button
                            onClick={async () => {
                              const token = await requestFCMToken(user?.uid);
                              if (token) setFcmPermissionGranted(true);
                            }}
                            className="w-full mt-2 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-red-500/20"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Enable Real-Time Alerts</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => logout()}
                        className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out & Exit</span>
                      </button>
                    </div>
                  )}

                  {/* Fallback if an unexpected view is passed */}
                  {!['home', 'menu', 'vendors', 'wallet', 'favorites', 'orders', 'tracking', 'profile'].includes(activeView) && (
                    <HomeFeed
                      onSelectFood={(item) => setSelectedFood(item)}
                      onSelectRestaurant={(vendor) => {
                        setTargetVendorId(vendor.id);
                        setActiveView('menu');
                      }}
                      onNavigateToMenu={(vendorId) => {
                        setTargetVendorId(vendorId);
                        setActiveView('menu');
                      }}
                    />
                  )}
                </>
              )}

              {/* Kitchen / Stand View: Strictly Kitchen Stand Dashboard */}
              {(role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff') && <KitchenDashboard />}

              {/* Rider View: Strictly Rider Delivery Dashboard */}
              {role === 'rider' && <RiderDashboard />}

              {/* Admin View: Strictly Campus Operations & Admin Console */}
              {(role === 'admin' || role === 'super_admin') && <AdminDashboard />}
            </ErrorBoundary>
          </main>

          {/* Floating Bottom Navigation */}
          {role === 'customer' && activeView !== 'tracking' && (
            <BottomNav activeView={activeView} setActiveView={setActiveView} />
          )}

        </div>
      )}

      {/* Food Product Detail Modal */}
      {selectedFood && (
        <FoodDetailModal
          item={selectedFood}
          onClose={() => setSelectedFood(null)}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer onCheckout={() => setShowCheckout(true)} />

      {/* Checkout Modal with Map & Paystack */}
      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onOrderCreated={handleOrderCreated}
        />
      )}

      {/* Auth Modal (Login / Register / Forgot Password) */}
      {showAuthModal && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* App-wide Toast Notifications */}
      <Toaster position="top-center" richColors closeButton />

      {/* Centralized In-App Notification Center Drawer */}
      <NotificationCenter
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        onNavigateToDeepLink={handleNavigateToDeepLink}
      />

    </div>
  );
}



