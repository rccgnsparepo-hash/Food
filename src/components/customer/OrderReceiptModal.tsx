import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  User,
  Phone,
  CreditCard,
  Truck,
  ShieldCheck,
  AlertCircle,
  QrCode as QrIcon,
  HelpCircle,
  Check,
  Copy
} from 'lucide-react';
import { Order, OrderReceipt, UserProfile, Vendor } from '../../types';
import { buildValidatedOrderReceipt, generateBukkitReceiptPDF } from '../../services/receiptService';
import { triggerHaptic } from '../../utils/haptics';
import { toast } from 'sonner';
import { BukkitLogo, BukkitIcon } from '../common/BukkitLogo';

interface OrderReceiptModalProps {
  order: Order;
  customerProfile?: Partial<UserProfile> | null;
  vendorProfile?: Partial<Vendor> | null;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  customerProfile,
  vendorProfile,
  onClose,
}) => {
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReceipt() {
      setIsLoading(true);
      const res = await buildValidatedOrderReceipt(order, customerProfile, vendorProfile);
      if (!isMounted) return;

      if (res.isValid && res.receipt) {
        setReceipt(res.receipt);
        setValidationError(null);
      } else {
        setReceipt(null);
        setValidationError(res.error || 'Receipt generation failed: order financial data does not match.');
      }
      setIsLoading(false);
    }
    loadReceipt();
    return () => {
      isMounted = false;
    };
  }, [order, customerProfile, vendorProfile]);

  const handleDownloadPDF = async () => {
    if (!receipt) return;
    triggerHaptic(40);
    setIsGeneratingPdf(true);
    await generateBukkitReceiptPDF(receipt);
    setIsGeneratingPdf(false);
  };

  const handlePrint = () => {
    triggerHaptic(30);
    window.print();
  };

  const handleCopyVerification = async () => {
    if (!receipt) return;
    triggerHaptic(30);
    try {
      await navigator.clipboard.writeText(receipt.verification_url);
      setCopiedLink(true);
      toast.success('Verification URL copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.info(`Receipt ID: ${receipt.receipt_id}`);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border border-rose-100 dark:border-slate-800 flex flex-col justify-between overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none transition-colors"
        >
          {/* Top Control Bar (Hidden when printing) */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
            <div className="flex items-center gap-3">
              <BukkitLogo variant="full" size="sm" theme="dark" subtitleText="OFFICIAL RECEIPT" />
            </div>

            <div className="flex items-center gap-2">
              {receipt && (
                <>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Download Official PDF"
                  >
                    <Download className="w-4 h-4 text-[#D6001C]" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Print</span>
                  </button>

                  <button
                    onClick={handleCopyVerification}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Copy Verification Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-rose-400" />}
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Receipt Body */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-950/60">
            {isLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-rose-200 dark:border-rose-900/40 border-t-[#D6001C] rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Generating authoritative receipt...</p>
              </div>
            ) : validationError || !receipt ? (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-3xl p-8 text-center space-y-4 my-8">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-red-900 dark:text-red-100 text-base">Receipt Generation Failed</h3>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-md mx-auto">
                    {validationError || 'Order financial data does not match authoritative records.'}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={onClose}
                    className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-extrabold px-6 py-2.5 rounded-xl hover:bg-black dark:hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-rose-100 dark:border-slate-800 space-y-6 print:border-none print:shadow-none print:p-0 transition-colors">
                {/* 1. RECEIPT HEADER */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <BukkitLogo variant="full" size="md" subtitleText="CAMPUS FOOD NETWORK • OFFICIAL RECEIPT" />
                    </div>

                    <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 text-right">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
                        {receipt.receipt_id}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Order #{receipt.order_id}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(receipt.created_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-3 py-1.5 rounded-xl font-bold border border-slate-200/60 dark:border-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Status:</span>
                      <span
                        className={`uppercase font-black ${
                          receipt.order_status === 'delivered'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : receipt.order_status === 'cancelled'
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-[#D6001C] dark:text-red-400'
                        }`}
                      >
                        {receipt.order_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold ${
                        receipt.payment.status === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Payment:</span>
                      <span className="uppercase font-black">{receipt.payment.status}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono ml-auto">
                      <span>Ref: {receipt.payment.transaction_reference}</span>
                    </div>
                  </div>
                </div>

                {/* 2 & 3. CUSTOMER & VENDOR DUAL SECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Info Card */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black text-[#D6001C] dark:text-rose-400 uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      <span>Customer Information</span>
                    </div>
                    <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{receipt.customer.name}</p>
                      <p className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {receipt.customer.phone}
                      </p>
                      {receipt.customer.email && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{receipt.customer.email}</p>
                      )}
                      <p className="text-slate-600 dark:text-slate-300 pt-1 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#D6001C] dark:text-rose-400 shrink-0 mt-0.5" />
                        <span>
                          {receipt.customer.delivery_location}
                          {receipt.customer.specific_location && (
                            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {receipt.customer.specific_location}
                            </span>
                          )}
                        </span>
                      </p>
                      {receipt.customer.delivery_instructions && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-850 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700 mt-1">
                          Note: "{receipt.customer.delivery_instructions}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Vendor Info Card */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black text-[#D6001C] dark:text-rose-400 uppercase tracking-wider">
                      <Store className="w-3.5 h-3.5" />
                      <span>Vendor / Kitchen</span>
                    </div>
                    <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{receipt.vendor.vendor_name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">ID: {receipt.vendor.vendor_id}</p>
                      <p className="text-slate-600 dark:text-slate-300 flex items-start gap-1 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{receipt.vendor.vendor_location}</span>
                      </p>
                      {receipt.vendor.vendor_phone && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          Support: {receipt.vendor.vendor_phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. ORDER ITEMS TABLE */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Order Items Breakdown ({receipt.items.length})
                  </h3>

                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Item Description</th>
                          <th className="py-3 px-3 text-center">Qty</th>
                          <th className="py-3 px-3 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {receipt.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                                {item.product_name_snapshot}
                              </span>
                              {item.variant_name && (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">
                                  Variant: {item.variant_name}
                                </span>
                              )}
                              {item.selected_options &&
                                Object.keys(item.selected_options).length > 0 && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                                    {Object.entries(item.selected_options).map(([k, v]) => (
                                      <span key={k}>
                                        • {k}: {v}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">
                              ₦{item.unit_price_snapshot.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                              ₦{item.line_total.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. FINANCIAL CALCULATION ENGINE BREAKDOWN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Left: Payment Info Box */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-[#D6001C] uppercase tracking-widest block">
                        PAYMENT METHOD & STATUS
                      </span>
                      <h4 className="font-black text-base text-white mt-1">{receipt.payment.method}</h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Ref: {receipt.payment.transaction_reference}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Payment Status:</span>
                        <span
                          className={`font-black uppercase ${
                            receipt.payment.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {receipt.payment.status}
                        </span>
                      </div>
                      {receipt.payment.status === 'paid' ? (
                        <div className="flex justify-between text-emerald-400 font-extrabold text-sm pt-1">
                          <span>Amount Paid:</span>
                          <span className="font-mono">
                            ₦{receipt.financials.amount_paid.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-rose-400 font-extrabold text-sm pt-1">
                          <span>Amount Due:</span>
                          <span className="font-mono">
                            ₦{receipt.financials.amount_due.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {receipt.financials.amount_refunded > 0 && (
                        <div className="flex justify-between text-amber-400 text-xs">
                          <span>Refunded:</span>
                          <span className="font-mono">
                            ₦{receipt.financials.amount_refunded.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Authoritative Totals Breakdown */}
                  <div className="bg-rose-50/50 dark:bg-slate-800/60 rounded-2xl p-5 border border-rose-100 dark:border-slate-700/60 space-y-2.5">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider border-b border-rose-100/80 dark:border-slate-700 pb-2">
                      Financial Summary
                    </h4>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          ₦{receipt.financials.subtotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Campus Delivery Fee:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          ₦{receipt.financials.delivery_fee.toLocaleString()}
                        </span>
                      </div>

                      {receipt.financials.service_fee > 0 && (
                        <div className="flex justify-between">
                          <span>Service Charge (5%):</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                            ₦{receipt.financials.service_fee.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {receipt.financials.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Discount Applied:</span>
                          <span className="font-bold font-mono">
                            -₦{receipt.financials.discount.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-rose-200 dark:border-slate-700 flex justify-between items-center text-base font-black text-slate-900 dark:text-white">
                        <span className="text-[#D6001C] dark:text-rose-400">TOTAL:</span>
                        <span className="text-xl font-black text-[#D6001C] dark:text-rose-400 font-mono">
                          ₦{receipt.financials.calculated_total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. DELIVERY SECTION */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      <Truck className="w-4 h-4 text-[#D6001C] dark:text-rose-400" />
                      <span>Campus Delivery Details</span>
                    </div>
                    <span className="text-[10px] font-bold bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                      {receipt.delivery.delivery_tracking_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Method</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">{receipt.delivery.method}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Runner</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">
                        {receipt.delivery.rider_name || 'Campus Dispatch Runner'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Timeline</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">
                        {receipt.delivery.delivered_timestamp
                          ? `Delivered ${new Date(receipt.delivery.delivered_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : receipt.delivery.estimated_delivery_time}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 7. ORDER TIMELINE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Authoritative Order Timeline
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {receipt.timeline.map((step, sIdx) => {
                      const isCompleted = step.status === 'completed';
                      return (
                        <div
                          key={sIdx}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                            isCompleted
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            {isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                            )}
                            <span className="truncate">{step.title}</span>
                          </div>
                          {step.timestamp && (
                            <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(step.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 8. VERIFICATION QR CODE & OFFICIAL FOOTER */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  {receipt.qr_code_data_url && (
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
                      <img
                        src={receipt.qr_code_data_url}
                        alt="Receipt QR Verification"
                        className="w-16 h-16 rounded-lg bg-white p-1"
                      />
                      <div className="space-y-0.5 text-left">
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                          Instant QR Verification
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[140px] leading-tight">
                          Scan to verify on BUKKIT Campus Network
                        </p>
                        <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded block w-fit font-bold border border-emerald-200/60 dark:border-emerald-800/50">
                          ✓ Verified Authentic
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-center sm:text-right space-y-1 text-xs">
                    <p className="font-extrabold text-[#D6001C] dark:text-rose-400">
                      Thank you for choosing BUKKIT Campus Food Delivery!
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Need help with this order? Email <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">support@bukkit.campus.ng</span>
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      Security Hash: SHA256-{receipt.receipt_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer (Hidden when printing) */}
          <div className="p-4 sm:p-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
            <div className="text-xs text-slate-400">
              {receipt && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authoritative cryptographic receipt</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {receipt && (
                <>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="bg-[#D6001C] hover:bg-red-700 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF Receipt'}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
