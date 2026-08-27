import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Trigger dynamic haptic vibration feedback for both Capacitor Native Android/iOS
 * and Web browsers with navigator.vibrate fallback.
 */
export const triggerHaptic = async (pattern: number | number[] = 40) => {
  // 1. Try Capacitor Native Haptics
  try {
    if (typeof pattern === 'number') {
      if (pattern >= 80) {
        await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      } else if (pattern >= 35) {
        await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      } else {
        await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    } else if (Array.isArray(pattern) && pattern.length > 0) {
      await Haptics.vibrate({ duration: pattern[0] || 50 }).catch(() => {});
    }
  } catch {
    // Non-native or web context fallback
  }

  // 2. HTML5 Web Vibration API Fallback
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored if permissions / iframe restricted
    }
  }
};

/**
 * Haptic feedback for successful actions (e.g. Added to Cart, Reorder, Payment Complete)
 */
export const triggerHapticSuccess = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  } catch {}

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([40, 50, 40, 70]);
    } catch {}
  }
};

/**
 * Haptic feedback for warning alerts
 */
export const triggerHapticWarning = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  } catch {}

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([60, 60, 60]);
    } catch {}
  }
};

/**
 * Haptic feedback for error conditions
 */
export const triggerHapticError = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  } catch {}

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch {}
  }
};

/**
 * Haptic feedback for incoming order alerts & notifications
 */
export const triggerHapticNotification = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    await Haptics.vibrate({ duration: 150 }).catch(() => {});
  } catch {}

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([100, 60, 100, 60, 180]);
    } catch {}
  }
};

/**
 * Subtle selection tick
 */
export const triggerHapticSelection = async () => {
  try {
    await Haptics.selectionChanged().catch(() => {});
  } catch {}

  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(25);
    } catch {}
  }
};

