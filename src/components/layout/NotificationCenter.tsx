import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  Check,
  Clock,
  ExternalLink,
  Volume2,
  VolumeX,
  Smartphone,
  ShieldAlert,
  ShoppingBag,
  Wallet,
  Sparkles,
  Play,
  Radio,
  Send
} from 'lucide-react';
import { NotificationRecord } from '../../types';
import { useNotificationStore, enablePushNotifications } from '../../services/notificationService';
import { useAuthStore } from '../../stores/useAuthStore';
import { triggerHaptic } from '../../utils/haptics';
import { apiFetch } from '../../lib/apiConfig';
import { toast } from 'sonner';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDeepLink?: (link: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNavigateToDeepLink
}) => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } =
    useNotificationStore();
  const { user, role } = useAuthStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'orders' | 'wallet' | 'admin'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<'granted' | 'default' | 'denied' | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission as any);
    } else {
      setPushStatus('unsupported');
    }
  }, [isOpen]);

  const handleEnablePush = async () => {
    const targetUid = user?.uid || 'guest_user';
    const appType =
      role === 'rider'
        ? 'RIDER'
        : role === 'kitchen' || role === 'kitchen_manager' || role === 'kitchen_staff'
        ? 'VENDOR'
        : role === 'admin' || role === 'super_admin'
        ? 'ADMIN'
        : 'CUSTOMER';

    const success = await enablePushNotifications(targetUid, appType);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission as any);
    }
  };

  const handleTestWebPush = async () => {
    try {
      toast.loading('Dispatching background Web Push...');
      const res = await apiFetch('/api/webpush/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anonymous_guest',
          title: '🔔 BUKKIT Live Push Verified',
          body: 'Real Web Push & FCM delivered to your active device.',
          deepLink: '/orders',
          severity: 'INFO'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.dismiss();
        toast.success('✓ Web Push dispatched to registered devices!');
      } else {
        toast.dismiss();
        toast.error('Could not send push: ' + (data.error || 'Check service worker'));
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error('Push test failed: ' + e.message);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'orders') return n.type === 'ORDER_STATUS' || n.type === 'DELIVERY_ALERT' || n.type === 'VENDOR_ALERT';
    if (activeFilter === 'wallet') return n.type === 'WALLET_ALERT';
    if (activeFilter === 'admin') return n.type === 'ADMIN_ALERT' || n.type === 'SYSTEM_ANNOUNCEMENT';
    return true;
  });

  const handleSimulateNotification = async (targetRole: 'customer' | 'rider' | 'vendor' | 'admin') => {
    setIsSimulating(true);
    triggerHaptic(30);
    try {
      await apiFetch('/api/notifications/test-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole,
          eventType: targetRole === 'rider' ? 'ORDER_READY' : targetRole === 'vendor' ? 'ORDER_CREATED' : 'ORDER_OUT_FOR_DELIVERY'
        })
      });
      setTimeout(() => {
        refetch();
        setIsSimulating(false);
      }, 300);
    } catch (e) {
      setIsSimulating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-rose-100 dark:border-slate-800"
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="relative p-2 bg-[#D6001C] rounded-2xl shadow-md shadow-red-500/30">
                  <Bell className="w-5 h-5 text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Notification Center</h3>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'orders', label: 'Orders' },
                  { id: 'wallet', label: 'Wallet' },
                  { id: 'admin', label: 'Alerts' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-[#D6001C] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-black text-[#D6001C] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold animate-pulse">
                  Loading notification events...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Bell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-1" />
                  <p className="text-sm font-extrabold text-slate-600 dark:text-slate-300">No notifications yet</p>
                  <p className="text-xs max-w-xs mx-auto text-slate-400 dark:text-slate-500">
                    Live updates for kitchen preparation, rider arrival, and wallet transactions will appear here.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isUnread = !notif.read_at && notif.status !== 'read';
                  const isCritical = notif.severity === 'CRITICAL';
                  const isWarning = notif.severity === 'WARNING';

                  const Icon =
                    notif.type === 'WALLET_ALERT'
                      ? Wallet
                      : notif.type === 'ADMIN_ALERT'
                      ? ShieldAlert
                      : ShoppingBag;

                  return (
                    <motion.div
                      key={notif.notification_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-2xl border transition-all relative ${
                        isUnread
                          ? isCritical
                            ? 'bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-800 shadow-sm'
                            : 'bg-rose-50/60 dark:bg-slate-800/80 border-rose-200 dark:border-slate-700 shadow-sm'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCritical
                              ? 'bg-red-600 text-white'
                              : isWarning
                              ? 'bg-amber-500 text-white'
                              : notif.type === 'WALLET_ALERT'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#D6001C] text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`text-xs font-black truncate ${isUnread ? 'text-slate-950 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                              {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{notif.body}</p>

                          <div className="mt-3 flex items-center justify-between">
                            {notif.deep_link ? (
                              <button
                                onClick={() => {
                                  markAsRead(notif.notification_id);
                                  onClose();
                                  if (onNavigateToDeepLink) {
                                    onNavigateToDeepLink(notif.deep_link);
                                  }
                                }}
                                className="text-[11px] font-black text-[#D6001C] dark:text-red-400 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                              >
                                <span>View Details</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : <div />}

                            {isUnread && (
                              <button
                                onClick={() => markAsRead(notif.notification_id)}
                                className="text-[10px] font-bold text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark read</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Web Push & APK System Status Bar */}
            <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className={`w-3.5 h-3.5 ${pushStatus === 'granted' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                <span className="text-[11px] font-bold text-slate-300">
                  {pushStatus === 'granted' ? 'Push Notifications Active' : 'Push Inactive / Pending'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {pushStatus !== 'granted' ? (
                  <button
                    onClick={handleEnablePush}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition-colors shadow-xs"
                  >
                    Enable Push
                  </button>
                ) : (
                  <button
                    onClick={handleTestWebPush}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>Test Web Push</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Test Simulator Footer */}
            <div className="p-4 bg-slate-950 text-white border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulate Test Notification:</span>
                </span>
                <span className="text-[10px] text-slate-500">Live FCM Dispatch</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-black">
                <button
                  disabled={isSimulating}
                  onClick={() => handleSimulateNotification('customer')}
                  className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-center cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Customer
                </button>
                <button
                  disabled={isSimulating}
                  onClick={() => handleSimulateNotification('rider')}
                  className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-center cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Rider
                </button>
                <button
                  disabled={isSimulating}
                  onClick={() => handleSimulateNotification('vendor')}
                  className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-center cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Vendor
                </button>
                <button
                  disabled={isSimulating}
                  onClick={() => handleSimulateNotification('admin')}
                  className="bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-center cursor-pointer transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Admin
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
