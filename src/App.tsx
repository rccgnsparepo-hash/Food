import React, { useEffect, useState, useCallback } from 'react';
import { BukkitLogo } from './components/common/BukkitLogo';
import { useAuthStore } from './stores/useAuthStore';
import { useCartStore } from './stores/useCartStore';
import { useMarketplaceStore } from './stores/useMarketplaceStore';
import { useThemeStore } from './stores/useThemeStore';
import { seedInitialDataIfNeeded } from './lib/seed';
import { MenuItem, UserRole } from './types';

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
import { AppRoleMismatchScreen } from './components/auth/AppRoleMismatchScreen';
import { RealtimeDeliveryChatModal } from './components/common/RealtimeDeliveryChatModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { User, LogOut, Phone, MapPin, Shield, KeyRound, MailWarning, Bell, CheckCircle, Sun, Moon, Monitor, Smartphone, MessageSquare } from 'lucide-react';
import { requestFCMToken, setupForegroundFCMListener } from './lib/fcm';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { useNotificationStore, setGlobalDeepLinkHandler } from './services/notificationService';
import { useOrderNotificationListener } from './services/orderNotificationService';
import { getCurrentAppFlavor, isRoleAuthorizedForFlavor, BUKKIT_FLAVORS, setDevAppFlavor } from './config/appFlavor';
import { registerDeviceToken } from './services/fcmDeviceService';

export default function App() {
  const { initAuth, user, role, setRole, logout, isInitLoading, isEmailVerified } = useAuthStore();
  const { isOpen: isCartOpen, setCartOpen } = useCartStore();
  const { initMarketplace } = useMarketplaceStore();
  const { theme, setTheme, initTheme } = useThemeStore();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  // Active Android Flavor Detection
  const currentFlavor = getCurrentAppFlavor();
  const flavorConfig = BUKKIT_FLAVORS[currentFlavor];

  // Real-time Push & Order Notification listener
  useOrderNotificationListener();

  const [activeView, setActiveView] = useState<string>(flavorConfig.defaultRoute || 'home');
  const [targetVendorId, setTargetVendorId] = useState<string | undefined>(undefined);
  const [selectedFood, setSelectedFood] = useState<MenuItem | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [fcmPermissionGranted, setFcmPermissionGranted] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [showFlavorPicker, setShowFlavorPicker] = useState(false);

  // Delivery Chat Modal State
  const [activeChat, setActiveChat] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber?: string;
    recipientId: string;
    recipientName: string;
    vendorName?: string;
    isDelivered?: boolean;
  }>({
    isOpen: false,
    orderId: '',
    recipientId: '',
    recipientName: ''
  });

  // Open delivery chat helper
  const handleOpenDeliveryChat = useCallback((params: {
    orderId: string;
    orderNumber?: string;
    recipientId: string;
    recipientName: string;
    vendorName?: string;
    isDelivered?: boolean;
  }) => {
    setActiveChat({
      isOpen: true,
      ...params
    });
  }, []);

  // Deep Link Navigator for Push Notifications and In-App Drawer clicks
  const handleNavigateToDeepLink = useCallback((link: string) => {
    if (!link) return;
    if (link.includes('/chat/')) {
      const parts = link.split('/chat/');
      const convOrOrderId = parts[1]?.split('?')[0];
      if (convOrOrderId) {
        const orderId = convOrOrderId.replace(/^conv_/, '');
        setActiveChat({
          isOpen: true,
          orderId,
          recipientId: role === 'rider' ? 'customer' : 'rider',
          recipientName: role === 'rider' ? 'Customer' : 'Delivery Courier'
        });
      }
    } else if (link.includes('/orders/')) {
      const parts = link.split('/orders/');
      const orderId = parts[1]?.split('?')[0];
      if (orderId) {
        setTrackingOrderId(orderId);
        setActiveView('tracking');
      } else {
        setActiveView('orders');
      }
    } else if (link.includes('/tracking/')) {
      const parts = link.split('/tracking/');
      const orderId = parts[1]?.split('?')[0];
      if (orderId) {
        setTrackingOrderId(orderId);
        setActiveView('tracking');
      }
    } else if (link.includes('/deliveries/')) {
      setActiveView('rider');
    } else if (link.includes('/kitchen/')) {
      setActiveView('kitchen');
    } else if (link.includes('/admin/')) {
      setActiveView('admin');
    } else if (link.includes('/wallet')) {
      setActiveView('wallet');
    } else if (link.includes('/menu')) {
      setActiveView('menu');
    } else if (link.includes('/vendors')) {
      setActiveView('vendors');
    } else if (link.includes('/profile')) {
      setActiveView('profile');
    }
  }, [role]);

  // Register deep link handler
  useEffect(() => {
    setGlobalDeepLinkHandler(handleNavigateToDeepLink);
  }, [handleNavigateToDeepLink]);

  // Subscribe user to real-time notification pipeline
  useEffect(() => {
    if (!user?.uid) return;
    const appType =
      role === 'rider'
        ? 'RIDER'
        : role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff'
        ? 'VENDOR'
        : role === 'admin' || role === 'super_admin'
        ? 'ADMIN'
        : 'CUSTOMER';

    const unsubNotifications = useNotificationStore.getState().initNotifications(user.uid, appType);
    return () => {
      unsubNotifications();
    };
  }, [user?.uid, role]);

  useEffect(() => {
    const unsubTheme = initTheme();
    const unsub = initAuth();
    initMarketplace();
    seedInitialDataIfNeeded();

    // Check notification permission state
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setFcmPermissionGranted(Notification.permission === 'granted');
    }

    // Setup foreground FCM notification handler & token registration
    let unsubFcm: (() => void) | undefined;
    setupForegroundFCMListener().then((unsubFn) => {
      unsubFcm = unsubFn;
    });

    // Automatically obtain and register FCM token on load/login
    if (user?.uid) {
      requestFCMToken(user.uid).then((token) => {
        if (token) {
          setFcmPermissionGranted(true);
          registerDeviceToken({
            userId: user.uid,
            role: (user.active_role || user.role || role) as UserRole,
            fcmToken: token,
            appFlavor: currentFlavor,
            permissionGranted: true
          });
        }
      });
    }

    // Listen for service worker deep link navigation messages
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BUKKIT_NOTIFICATION_CLICK' && event.data.deepLink) {
        handleNavigateToDeepLink(event.data.deepLink);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      unsubTheme();
      unsub();
      if (unsubFcm) unsubFcm();
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [user?.uid]);

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
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center text-white transition-colors">
        <BukkitLogo variant="stacked" size="xl" theme="dark" subtitleText="CAMPUS FOOD DELIVERY • PRAYER CITY" />
        <div className="mt-8 flex items-center gap-2.5 text-xs font-bold text-slate-400 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700">
          <div className="w-4 h-4 border-2 border-[#FF5A00] border-t-transparent rounded-full animate-spin"></div>
          <span>Loading {flavorConfig.appName}...</span>
        </div>
      </div>
    );
  }

  // 2. HARD GATE ACCESS: User MUST log in AND have a verified email before doing or seeing anything in the app
  if (!user || (!isEmailVerified && !user.uid.startsWith('guest_'))) {
    return <AuthGatewayPage />;
  }

  // 3. Authoritative role determination
  const effectiveRole = (user.active_role || user.role || role) as UserRole;
  const isAuthorizedForCurrentApk = isRoleAuthorizedForFlavor(effectiveRole, currentFlavor);

  if (!isAuthorizedForCurrentApk) {
    const isNativeAndroid = typeof window !== 'undefined' && Boolean((window as any).BUKKIT_NATIVE_FLAVOR);
    if (!isNativeAndroid) {
      // In web/preview environment, auto-align flavor to match the active authenticated role
      const targetFlavor = effectiveRole === 'rider' 
        ? 'rider' 
        : (effectiveRole === 'kitchen' || effectiveRole === 'kitchen_manager' || effectiveRole === 'kitchen_staff') 
        ? 'vendor' 
        : (effectiveRole === 'admin' || effectiveRole === 'super_admin') 
        ? 'admin' 
        : 'customer';
      if (currentFlavor !== targetFlavor) {
        setDevAppFlavor(targetFlavor);
      }
    } else {
      return (
        <AppRoleMismatchScreen
          currentFlavor={currentFlavor}
          userRole={effectiveRole}
        />
      );
    }
  }

  const isGuest = user.uid.startsWith('guest_');

  return (
    <div className="min-h-screen bg-[#F9ECEC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-[#D6001C] selection:text-white transition-colors duration-200">
      {/* Real-time Network Connectivity Resilience Banner */}
      <NetworkStatusBanner />

      {/* 1. Splash / Onboarding Screen */}
      {activeView === 'splash' && effectiveRole === 'customer' ? (
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
              {effectiveRole === 'customer' && (
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
                    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xs border border-rose-100 dark:border-slate-800 text-center space-y-4 transition-colors">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#D6001C] mx-auto shadow-md">
                        <img
                          src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'user')}`}
                          alt={user?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-xl text-slate-900 dark:text-slate-100">{user?.name}</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{user?.email}</p>
                        <span className="inline-block mt-1 bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          Account: {user?.role || role}
                        </span>
                      </div>

                      {/* Theme Preference Settings Box in Profile */}
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-200">Theme Appearance</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{theme}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setTheme('light')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              theme === 'light'
                                ? 'bg-white text-[#0D472B] shadow-xs font-black border border-emerald-200'
                                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Sun className="w-3.5 h-3.5 text-amber-500" />
                            <span>Light</span>
                          </button>
                          <button
                            onClick={() => setTheme('dark')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-slate-950 text-white shadow-xs font-black border border-slate-700'
                                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Moon className="w-3.5 h-3.5 text-blue-400" />
                            <span>Dark</span>
                          </button>
                          <button
                            onClick={() => setTheme('system')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              theme === 'system'
                                ? 'bg-white dark:bg-slate-950 text-[#0D472B] dark:text-emerald-400 shadow-xs font-black border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Monitor className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Auto</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-rose-50/80 dark:bg-slate-800/80 p-4 rounded-2xl text-xs text-slate-700 dark:text-slate-200 space-y-2 text-left border border-rose-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#D6001C] dark:text-red-400" />
                          <span>{user?.phone || '+234 810 000 0000'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#D6001C] dark:text-red-400" />
                          <span>{user?.address || 'Mountain Top University Campus'}</span>
                        </div>
                      </div>

                      {/* FCM Notifications Setting Box */}
                      <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-2xl text-xs text-left space-y-2 border border-slate-800 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-200">
                            <Bell className="w-4 h-4 text-[#D6001C] dark:text-red-400" />
                            <span>Native Push Notifications</span>
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
                              const token = await requestFCMToken(user?.uid, true);
                              if (token) {
                                setFcmPermissionGranted(true);
                                registerDeviceToken({
                                  userId: user.uid,
                                  role: 'customer',
                                  fcmToken: token,
                                  appFlavor: 'customer'
                                });
                              }
                            }}
                            className="w-full mt-2 bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-red-500/20"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Enable Native Push Alerts</span>
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => logout()}
                        className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-transparent dark:border-slate-700"
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
              {(effectiveRole === 'kitchen' || effectiveRole === 'kitchen_manager' || effectiveRole === 'kitchen_staff') && <KitchenDashboard />}

              {/* Rider View: Strictly Rider Delivery Dashboard */}
              {effectiveRole === 'rider' && <RiderDashboard />}

              {/* Admin View: Strictly Campus Operations & Admin Console */}
              {(effectiveRole === 'admin' || effectiveRole === 'super_admin') && <AdminDashboard />}
            </ErrorBoundary>
          </main>

          {/* Floating Bottom Navigation */}
          {effectiveRole === 'customer' && activeView !== 'tracking' && (
            <BottomNav activeView={activeView} setActiveView={setActiveView} />
          )}

        </div>
      )}

      {/* Realtime Delivery Chat Modal (Rider <-> Customer) */}
      {activeChat.isOpen && (
        <RealtimeDeliveryChatModal
          orderId={activeChat.orderId}
          orderNumber={activeChat.orderNumber}
          currentUserId={user?.uid || ''}
          currentUserName={user?.name || 'BUKKIT User'}
          currentUserRole={userAuthoritativeRole === 'rider' ? 'rider' : userAuthoritativeRole === 'admin' ? 'admin' : 'customer'}
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          vendorName={activeChat.vendorName}
          isOrderDelivered={activeChat.isDelivered}
          onClose={() => setActiveChat({ isOpen: false, orderId: '', recipientId: '', recipientName: '' })}
        />
      )}

      {/* Dev Preview APK Flavor Switcher Pill */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="relative">
          {showFlavorPicker && (
            <div className="absolute bottom-12 right-0 mb-2 w-60 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2 text-xs text-white">
              <div className="font-extrabold text-[11px] text-slate-400 uppercase tracking-wider px-1">
                Select APK Build Flavor
              </div>
              <div className="space-y-1">
                {(['customer', 'vendor', 'rider', 'admin'] as const).map((f) => {
                  const cfg = BUKKIT_FLAVORS[f];
                  const isCurrent = currentFlavor === f;
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        setShowFlavorPicker(false);
                        setDevAppFlavor(f);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#FF5A00] text-white font-black'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <p>{cfg.appName}</p>
                        <p className="text-[10px] opacity-75 font-mono">{cfg.packageName}</p>
                      </div>
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-white ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowFlavorPicker(!showFlavorPicker)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 text-white rounded-full shadow-lg text-[11px] font-bold backdrop-blur-md cursor-pointer hover:border-orange-500 transition-all"
            title="Switch Native APK Flavor Preview"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#FF5A00]" />
            <span className="capitalize">{currentFlavor} APK</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>

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



