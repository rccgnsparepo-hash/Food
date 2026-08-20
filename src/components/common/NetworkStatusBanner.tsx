import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export const NetworkStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedAlert, setShowReconnectedAlert] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      setTimeout(() => setShowReconnectedAlert(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedAlert(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsOnline(navigator.onLine);
      setIsRetrying(false);
      if (navigator.onLine) {
        setShowReconnectedAlert(true);
        setTimeout(() => setShowReconnectedAlert(false), 3000);
      }
    }, 800);
  };

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-slate-900 text-white px-4 py-2 text-xs font-bold border-b border-amber-500/30 sticky top-0 z-50 shadow-md"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-300">
              <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
              <span>Offline: Operating in offline mode. Live orders will sync automatically upon reconnection.</span>
            </div>
            <button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Reconnecting...' : 'Retry Connection'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {isOnline && showReconnectedAlert && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-extrabold sticky top-0 z-50 flex items-center justify-center gap-2 shadow-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Back Online — Real-time order synchronization active.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
