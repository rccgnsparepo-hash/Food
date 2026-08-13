import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/useAuthStore';
import { useCartStore } from './stores/useCartStore';
import { seedInitialDataIfNeeded } from './lib/seed';
import { MenuItem } from './types';

import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';

import { SplashOnboarding } from './components/customer/SplashOnboarding';
import { HomeFeed } from './components/customer/HomeFeed';
import { FoodDetailModal } from './components/customer/FoodDetailModal';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutModal } from './components/customer/CheckoutModal';
import { OrderTracking } from './components/customer/OrderTracking';
import { FavoritesView } from './components/customer/FavoritesView';
import { OrdersHistory } from './components/customer/OrdersHistory';

import { RiderDashboard } from './components/rider/RiderDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { AuthGatewayPage } from './components/auth/AuthGatewayPage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { User, LogOut, Phone, MapPin, Shield, KeyRound, MailWarning, Bell, CheckCircle } from 'lucide-react';
import { useOrderNotificationListener } from './services/orderNotificationService';
import { requestFCMToken, setupForegroundFCMListener } from './lib/fcm';

export default function App() {
  const { initAuth, user, role, setRole, logout, isLoading, isEmailVerified } = useAuthStore();
  const { isOpen: isCartOpen, setCartOpen } = useCartStore();

  const [activeView, setActiveView] = useState<string>('home');
  const [selectedFood, setSelectedFood] = useState<MenuItem | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [fcmPermissionGranted, setFcmPermissionGranted] = useState(false);

  // Real-time Order status change listener for FCM push notifications
  useOrderNotificationListener();

  useEffect(() => {
    const unsub = initAuth();
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

    return () => {
      unsub();
      if (unsubFcm) unsubFcm();
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

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9ECEC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-[#D6001C] text-white rounded-3xl font-black text-3xl flex items-center justify-center shadow-xl shadow-red-500/30 animate-pulse mb-4">
          B
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">BUKKIT MARKETPLACE</h2>
        <p className="text-xs font-extrabold text-[#D6001C] uppercase tracking-widest mt-1">Mountain Top University • Prayer City</p>
        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-500">
          <div className="w-4 h-4 border-2 border-[#D6001C] border-t-transparent rounded-full animate-spin"></div>
          <span>Verifying Firebase Authentication...</span>
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
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <ErrorBoundary>
              {/* Customer Views */}
              {role === 'customer' && (
                <>
                  {activeView === 'home' && (
                    <HomeFeed
                      onSelectFood={(item) => setSelectedFood(item)}
                      onSelectRestaurant={() => {}}
                    />
                  )}

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
                          src={user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop'}
                          alt={user?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-xl text-slate-900">{user?.name}</h2>
                        <p className="text-xs text-slate-400 font-medium">{user?.email}</p>
                        <span className="inline-block mt-1 bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          Role: {user?.role || role}
                        </span>
                      </div>

                      <div className="bg-rose-50/80 p-4 rounded-2xl text-xs text-slate-700 space-y-2 text-left border border-rose-100">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#D6001C]" />
                          <span>{user?.phone || '+234 810 000 0000'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#D6001C]" />
                          <span>{user?.address || 'Prayer City, Mountain Top University'}</span>
                        </div>
                      </div>

                      {/* FCM Notifications Setting Box */}
                      <div className="bg-slate-900 text-white p-4 rounded-2xl text-xs text-left space-y-2 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-200">
                            <Bell className="w-4 h-4 text-[#D6001C]" />
                            <span>FCM Status Push Alerts</span>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${fcmPermissionGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                            {fcmPermissionGranted ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Receive real-time push notifications when your order document status updates in Firestore.
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
                            <span>Enable Firebase Notifications</span>
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
                </>
              )}

              {/* Rider View */}
              {role === 'rider' && <RiderDashboard />}

              {/* Admin View */}
              {role === 'admin' && <AdminDashboard />}
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

    </div>
  );
}



