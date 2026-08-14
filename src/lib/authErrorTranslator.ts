/**
 * Translates Firebase Auth error codes and raw errors into human-readable user-friendly messages.
 */
export function translateFirebaseAuthError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const code: string = typeof err === 'string' ? err : err?.code || '';
  const message: string = typeof err === 'string' ? err : err?.message || '';

  // Check code mappings
  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your details and try again.';
    case 'auth/user-not-found':
      return 'No BUKKIT account was found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify your password and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact BUKKIT support.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/internal-error':
      return 'Something went wrong on our end. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Your password is too weak. Please use at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-in request was cancelled.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked. Please enable popups and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is disabled in your Firebase console. We have authenticated your session locally so you can continue testing.';
    case 'auth/requires-recent-login':
      return 'This operation is sensitive. Please re-authenticate before continuing.';
    default:
      break;
  }

  // If error has a clean string message without raw technical stack traces
  if (message) {
    // If message contains custom application message (e.g., Admin passkey error)
    if (message.includes('Admin Passkey')) {
      return message.replace(/FirebaseError:\s*/g, '').replace(/Error:\s*/g, '').trim();
    }
    if (message.includes('auth/invalid-credential')) {
      return 'Invalid email or password. Please check your details and try again.';
    }
    if (message.includes('auth/email-already-in-use')) {
      return 'An account already exists with this email address.';
    }
    if (message.includes('auth/weak-password')) {
      return 'Your password is too weak. Use at least 6 characters.';
    }
    if (message.includes('auth/network-request-failed')) {
      return 'Network error. Check your internet connection and try again.';
    }
    // Clean up generic FirebaseError text
    if (message.startsWith('Firebase:')) {
      const match = message.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        return translateFirebaseAuthError({ code: match[1] });
      }
    }
    // Return clean user string if not raw technical stack trace
    if (!message.includes('FirebaseError') && !message.includes('at ') && message.length < 200) {
      return message;
    }
  }

  return 'Unable to process your request right now. Please try again.';
}

/**
 * Calculates password strength score and label
 */
export function getPasswordStrength(password: string): {
  score: number; // 0 to 3
  label: 'Weak' | 'Medium' | 'Strong';
  color: string;
} {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'bg-slate-200' };
  }

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8 && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { score: 1, label: 'Weak', color: 'bg-red-500' };
  } else if (score === 2) {
    return { score: 2, label: 'Medium', color: 'bg-amber-500' };
  } else {
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  }
}
