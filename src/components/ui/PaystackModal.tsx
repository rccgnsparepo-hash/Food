import React, { useState } from 'react';
import { ShieldCheck, CreditCard, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface PaystackModalProps {
  amount: number;
  email: string;
  orderId: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({
  amount,
  email,
  orderId,
  onSuccess,
  onClose
}) => {
  const [cardNumber, setCardNumber] = useState('4084 •••• •••• 1234');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('888');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'processing' | 'success' | 'failed'>('checkout');

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setStep('processing');

    try {
      // Call Paystack backend API endpoint
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount, orderId })
      });
      const data = await response.json();

      setTimeout(async () => {
        // Verify payment
        const verifyRes = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: data.data.reference })
        });
        const verifyData = await verifyRes.json();

        if (verifyData.status) {
          setStep('success');
          setTimeout(() => {
            onSuccess(data.data.reference);
          }, 1200);
        } else {
          setStep('failed');
          setIsProcessing(false);
        }
      }, 1800);
    } catch (err) {
      console.error('Paystack transaction error:', err);
      setStep('failed');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-rose-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-xs tracking-wider">
              PAYSTACK
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">Secured Checkout</h3>
              <p className="text-xs text-slate-400">{email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {step === 'checkout' && (
          <form onSubmit={handlePayNow} className="p-6 space-y-4">
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-900 uppercase tracking-wide">
                Amount Due
              </span>
              <span className="text-xl font-bold text-[#D6001C]">
                ₦{amount.toLocaleString()}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-[#D6001C] outline-none pl-10"
                  />
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    Expires
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    required
                    placeholder="MM/YY"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">
                    CVV / CVC
                  </label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    required
                    maxLength={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-[#D6001C] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>256-Bit SSL Encrypted Paystack Guarantee</span>
            </div>

            <button
              type="submit"
              className="w-full bg-[#D6001C] hover:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Pay ₦{amount.toLocaleString()} with Paystack
            </button>
          </form>
        )}

        {step === 'processing' && (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 border-4 border-rose-200 border-t-[#D6001C] rounded-full animate-spin mx-auto" />
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Verifying Payment</h4>
              <p className="text-xs text-slate-500 mt-1">Connecting with Paystack secure gateway...</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="p-10 text-center space-y-4 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <div>
              <h4 className="font-bold text-slate-800 text-xl">Payment Verified!</h4>
              <p className="text-xs text-slate-500 mt-1">Your transaction was successful. Placing order...</p>
            </div>
          </div>
        )}

        {step === 'failed' && (
          <div className="p-8 text-center space-y-4">
            <AlertCircle className="w-14 h-14 text-rose-500 mx-auto" />
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Transaction Failed</h4>
              <p className="text-xs text-slate-500 mt-1">Unable to complete Paystack payment. Please try again.</p>
            </div>
            <button
              onClick={() => setStep('checkout')}
              className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl text-sm"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
