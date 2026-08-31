import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Lock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info,
  Building2,
  Smartphone,
  QrCode,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { apiFetchJson } from '../../lib/apiConfig';
import { triggerHaptic, triggerHapticSuccess, triggerHapticError } from '../../utils/haptics';

interface PaystackModalProps {
  amount: number;
  email: string;
  orderId: string;
  foodSubtotal?: number;
  deliveryFee?: number;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({
  amount,
  email,
  orderId,
  foodSubtotal = 2000,
  deliveryFee = 350,
  onSuccess,
  onClose
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'card' | 'transfer' | 'ussd' | 'qr'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'authorizing' | 'waiting_payment' | 'verifying' | 'success' | 'failed'>('checkout');
  const [activeReference, setActiveReference] = useState<string>('');
  const [authUrl, setAuthUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [gatewayConfig, setGatewayConfig] = useState<{
    configured: boolean;
    mode: string;
    hasPublicKey: boolean;
  }>({
    configured: false,
    mode: 'unconfigured',
    hasPublicKey: false
  });

  // Check backend Paystack configuration status
  useEffect(() => {
    async function checkConfig() {
      try {
        const res = await apiFetchJson<any>('/api/payments/config-status');
        if (res.ok && res.data) {
          setGatewayConfig({
            configured: res.data.configured,
            mode: res.data.mode,
            hasPublicKey: res.data.hasPublicKey
          });
        }
      } catch (e) {
        console.warn('Config status check notice:', e);
      }
    }
    checkConfig();
  }, []);

  const handleInitializeAndPay = async () => {
    triggerHaptic(40);
    setIsProcessing(true);
    setErrorMessage('');
    setStep('authorizing');

    try {
      // 1. Initialize Authoritative Payment with Backend
      const initRes = await apiFetchJson<any>('/api/payments/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          email: email || 'student@mtu.edu.ng',
          callbackUrl: window.location.origin
        })
      });

      if (!initRes.ok) {
        throw new Error(initRes.error || 'Failed to communicate with payment service');
      }

      const data = initRes.data;
      const ref = data.reference || data.data?.reference || `BUKKIT-${Date.now()}`;
      setActiveReference(ref);

      // If backend has Paystack credentials and returns authorization URL
      if (data.data?.authorization_url && data.data?.configured !== false) {
        const url = data.data.authorization_url;
        setAuthUrl(url);
        setStep('waiting_payment');
        setIsProcessing(false);

        // Open Paystack popup window or redirect
        const popup = window.open(url, 'paystack_checkout', 'width=500,height=700');
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // If popup blocked, let user click the direct button
        }
      } else {
        // Unconfigured mode: inform user with clear instructions
        setStep('verifying');
        setTimeout(async () => {
          await verifyPaymentWithBackend(ref);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Paystack initialization error:', err);
      triggerHapticError();
      setErrorMessage(err.message || 'Payment processing error');
      setStep('failed');
      setIsProcessing(false);
    }
  };

  const verifyPaymentWithBackend = async (refToCheck?: string) => {
    const ref = refToCheck || activeReference;
    if (!ref) return;

    setStep('verifying');
    setIsProcessing(true);

    try {
      const verifyRes = await apiFetchJson<any>(`/api/payments/paystack/verify/${encodeURIComponent(ref)}`);

      if (verifyRes.ok && (verifyRes.data?.status || verifyRes.data?.success)) {
        triggerHapticSuccess();
        setStep('success');
        setIsProcessing(false);
        setTimeout(() => {
          onSuccess(ref);
        }, 1200);
      } else {
        throw new Error(verifyRes.data?.message || 'Verification could not confirm payment.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      triggerHapticError();
      setErrorMessage(err.message || 'Payment confirmation failed');
      setStep('failed');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100">
        {/* Paystack Header */}
        <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-[#00C3F7] text-slate-950 font-black px-2.5 py-1 rounded-lg text-xs tracking-wider">
              PAYSTACK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-100">BUKKIT Secured Checkout</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${gatewayConfig.configured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                  {gatewayConfig.configured ? (gatewayConfig.mode === 'test' ? 'TEST GATEWAY' : 'LIVE GATEWAY') : 'KEYS PENDING'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{email || 'student@mtu.edu.ng'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing && step === 'verifying'}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Configuration Notice if Paystack Keys are blank */}
        {!gatewayConfig.configured && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 px-5 flex items-start gap-2.5 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Paystack Credentials Awaiting Input</p>
              <p className="text-[11px] text-amber-700 leading-snug mt-0.5">
                The app starts safely in development mode. Supply <code className="bg-amber-100 px-1 rounded font-mono">PAYSTACK_SECRET_KEY</code> in environment variables when ready.
              </p>
            </div>
          </div>
        )}

        {/* STEP: CHECKOUT BREAKDOWN */}
        {step === 'checkout' && (
          <div className="p-5 space-y-4">
            {/* Authoritative Financial Breakdown Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Meal Subtotal</span>
                <span className="font-medium font-mono text-slate-800">₦{foodSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Campus Delivery Fee</span>
                <span className="font-medium font-mono text-slate-800">₦{deliveryFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Total Payable
                </span>
                <span className="text-xl font-black text-[#D6001C] font-mono">
                  ₦{amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Channel Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Select Paystack Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('card')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-left text-xs font-medium transition-all ${
                    selectedChannel === 'card'
                      ? 'border-[#D6001C] bg-red-50/50 text-[#D6001C] shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">Debit Card</p>
                    <p className="text-[10px] text-slate-500">Mastercard, Visa, Verve</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('transfer')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-left text-xs font-medium transition-all ${
                    selectedChannel === 'transfer'
                      ? 'border-[#D6001C] bg-red-50/50 text-[#D6001C] shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">Bank Transfer</p>
                    <p className="text-[10px] text-slate-500">Instant Dynamic Account</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('ussd')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-left text-xs font-medium transition-all ${
                    selectedChannel === 'ussd'
                      ? 'border-[#D6001C] bg-red-50/50 text-[#D6001C] shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">USSD Banking</p>
                    <p className="text-[10px] text-slate-500">*737#, *894#, *966#</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('qr')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-left text-xs font-medium transition-all ${
                    selectedChannel === 'qr'
                      ? 'border-[#D6001C] bg-red-50/50 text-[#D6001C] shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <QrCode className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">Scan to Pay</p>
                    <p className="text-[10px] text-slate-500">NQR & Banking Apps</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Security Guarantee */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] text-slate-600">
                Processed via Paystack PCI-DSS Level 1 Encrypted Infrastructure.
              </span>
            </div>

            {/* Checkout Action Button */}
            <button
              type="button"
              onClick={handleInitializeAndPay}
              disabled={isProcessing}
              className="w-full bg-[#D6001C] hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Pay ₦{amount.toLocaleString()} with Paystack
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: WAITING FOR USER TO COMPLETE ON PAYSTACK WINDOW */}
        {step === 'waiting_payment' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-sky-50 text-[#00C3F7] rounded-full flex items-center justify-center mx-auto">
              <ExternalLink className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Complete Payment on Paystack</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                A secure checkout window was opened. If not visible, click the button below to resume.
              </p>
            </div>

            {authUrl && (
              <a
                href={authUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Re-open Paystack Checkout Page
              </a>
            )}

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => verifyPaymentWithBackend()}
                className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                I Have Completed Payment (Verify Now)
              </button>
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full text-slate-500 hover:text-slate-700 py-2 text-xs font-semibold"
              >
                Cancel or Choose Another Channel
              </button>
            </div>
          </div>
        )}

        {/* STEP: AUTHORIZING / VERIFYING */}
        {(step === 'authorizing' || step === 'verifying') && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 border-4 border-rose-200 border-t-[#D6001C] rounded-full animate-spin mx-auto" />
            <div>
              <h4 className="font-bold text-slate-900 text-base">
                {step === 'authorizing' ? 'Connecting to Paystack Gateway...' : 'Authoritatively Verifying Payment...'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Verifying amount, signature, and double-entry ledger allocation...
              </p>
            </div>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg">Payment Confirmed!</h4>
              <p className="text-xs text-slate-500 mt-1">
                ₦{amount.toLocaleString()} settled. Order confirmed & dispatched to kitchen.
              </p>
              {activeReference && (
                <p className="text-[11px] font-mono text-slate-400 mt-2 bg-slate-50 py-1 px-2 rounded-lg inline-block">
                  Ref: {activeReference}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP: FAILED */}
        {step === 'failed' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">Payment Not Verified</h4>
              <p className="text-xs text-rose-600 mt-1 max-w-xs mx-auto">
                {errorMessage || 'Unable to confirm payment from gateway.'}
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-xs"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-slate-500 hover:text-slate-700 py-2 text-xs"
              >
                Close Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
