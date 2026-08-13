export const triggerHaptic = (pattern: number | number[] = 40) => {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
};
