import { serverDb } from '../embeddedServerDb';

export type LedgerEntryType =
  | 'CUSTOMER_PAYMENT'
  | 'RESTAURANT_PAYABLE'
  | 'RIDER_PAYABLE'
  | 'COMPANY_REVENUE'
  | 'PAYSTACK_FEE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'OPERATING_EXPENSE';

export type LedgerRecipientType =
  | 'CUSTOMER'
  | 'RESTAURANT'
  | 'RIDER'
  | 'PLATFORM'
  | 'PAYSTACK'
  | 'VENDOR';

export type LedgerDirection = 'credit' | 'debit';
export type LedgerEntryStatus = 'pending' | 'posted' | 'settled' | 'reversed';

export interface FinancialLedgerEntry {
  id: string;
  order_id: string;
  type: LedgerEntryType;
  recipient_type: LedgerRecipientType;
  recipient_id: string;
  amount: number; // positive number in Naira
  direction: LedgerDirection;
  status: LedgerEntryStatus;
  reference: string;
  description: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface RestaurantBalance {
  restaurant_id: string;
  restaurant_name?: string;
  pending_amount: number;
  available_for_settlement: number;
  paid_out_amount: number;
  total_earned: number;
  last_settled_at?: string;
  updated_at: string;
}

export interface RiderBalance {
  rider_id: string;
  rider_name?: string;
  pending_amount: number;
  available_amount: number;
  paid_amount: number;
  total_earned: number;
  last_payout_at?: string;
  updated_at: string;
}

export interface BusinessExpense {
  id: string;
  category: 'servers' | 'hosting' | 'sms' | 'email' | 'marketing' | 'advertising' | 'staff' | 'support' | 'operations' | 'refund_losses' | 'other';
  amount: number;
  description: string;
  date: string;
  recorded_by?: string;
  created_at: string;
}

export interface OrderFinancialBreakdown {
  order_id: string;
  food_subtotal: number;
  company_fee: number; // ₦250 platform gross
  rider_fee: number; // ₦100 rider payable
  customer_total: number; // ₦2,350 total
  paystack_fee: number; // e.g. ₦35.25
  restaurant_payable: number; // ₦2,000
  rider_payable: number; // ₦100
  company_gross_revenue: number; // ₦250
  company_net_revenue: number; // ₦250 - ₦35.25 = ₦214.75
}

export interface FinancialMetrics {
  totalOrders: number;
  totalCustomerGMV: number;
  totalRestaurantPayable: number;
  totalRiderPayable: number;
  totalBukkitGrossRevenue: number;
  totalPaystackFees: number;
  totalBukkitNetTransactionRevenue: number;
  totalOperatingExpenses: number;
  totalRefunds: number;
  totalPayouts: number;
  netProfit: number;
  averageOrderValue: number;
  platformRevenuePerOrder: number;
  paymentProcessingCostPerOrder: number;
}

export interface DailyFinancialItem {
  date: string;
  dayLabel: string;
  orders: number;
  gmv: number;
  companyGross: number;
  paystackFees: number;
  companyNet: number;
  restaurantPayable: number;
  riderPayable: number;
  operatingExpenses: number;
  refunds: number;
  netProfit: number;
}

export interface MonthlyFinancialItem {
  month: string; // '2026-08'
  monthLabel: string;
  orders: number;
  gmv: number;
  companyGross: number;
  paystackFees: number;
  companyNet: number;
  restaurantPayable: number;
  riderPayable: number;
  operatingExpenses: number;
  refunds: number;
  netProfit: number;
}

// -------------------------------------------------------------
// CORE FINANCIAL LEDGER ENGINE
// -------------------------------------------------------------

export class FinancialLedgerService {
  /**
   * Posts authoritative double-entry ledger entries upon confirmed payment.
   */
  recordOrderPayment(breakdown: OrderFinancialBreakdown, customerId: string, restaurantId: string, riderId?: string): FinancialLedgerEntry[] {
    const now = new Date().toISOString();
    const entries: FinancialLedgerEntry[] = [];

    // 1. Customer Payment (+₦2,350 credit received)
    const customerPaymentEntry: FinancialLedgerEntry = {
      id: `LED_CP_${breakdown.order_id}_${Date.now()}`,
      order_id: breakdown.order_id,
      type: 'CUSTOMER_PAYMENT',
      recipient_type: 'CUSTOMER',
      recipient_id: customerId,
      amount: breakdown.customer_total,
      direction: 'credit',
      status: 'posted',
      reference: `PAY_${breakdown.order_id}`,
      description: `Customer payment received for Order #${breakdown.order_id.slice(-6)}`,
      created_at: now,
      metadata: { ...breakdown }
    };
    entries.push(customerPaymentEntry);
    serverDb.setDoc('ledger_entries', customerPaymentEntry.id, customerPaymentEntry);

    // 2. Restaurant Payable (-₦2,000 liability credited to restaurant pending balance)
    const restaurantEntry: FinancialLedgerEntry = {
      id: `LED_RP_${breakdown.order_id}_${Date.now()}`,
      order_id: breakdown.order_id,
      type: 'RESTAURANT_PAYABLE',
      recipient_type: 'RESTAURANT',
      recipient_id: restaurantId,
      amount: breakdown.restaurant_payable,
      direction: 'debit',
      status: 'pending',
      reference: `REST_${restaurantId}_${breakdown.order_id}`,
      description: `Food subtotal payable to restaurant for Order #${breakdown.order_id.slice(-6)}`,
      created_at: now
    };
    entries.push(restaurantEntry);
    serverDb.setDoc('ledger_entries', restaurantEntry.id, restaurantEntry);
    this.creditRestaurantPending(restaurantId, breakdown.restaurant_payable);

    // 3. Rider Payable (-₦100 liability credited to rider pending balance)
    const effectiveRiderId = riderId || 'unassigned_rider';
    const riderEntry: FinancialLedgerEntry = {
      id: `LED_RD_${breakdown.order_id}_${Date.now()}`,
      order_id: breakdown.order_id,
      type: 'RIDER_PAYABLE',
      recipient_type: 'RIDER',
      recipient_id: effectiveRiderId,
      amount: breakdown.rider_payable,
      direction: 'debit',
      status: 'pending',
      reference: `RIDER_${effectiveRiderId}_${breakdown.order_id}`,
      description: `Delivery charge payable to courier for Order #${breakdown.order_id.slice(-6)}`,
      created_at: now
    };
    entries.push(riderEntry);
    serverDb.setDoc('ledger_entries', riderEntry.id, riderEntry);
    if (riderId) {
      this.creditRiderPending(riderId, breakdown.rider_payable);
    }

    // 4. BUKKIT Company Gross Revenue (+₦250 platform gross recognized)
    const companyEntry: FinancialLedgerEntry = {
      id: `LED_CR_${breakdown.order_id}_${Date.now()}`,
      order_id: breakdown.order_id,
      type: 'COMPANY_REVENUE',
      recipient_type: 'PLATFORM',
      recipient_id: 'bukkit_platform',
      amount: breakdown.company_gross_revenue,
      direction: 'credit',
      status: 'posted',
      reference: `BUKKIT_FEE_${breakdown.order_id}`,
      description: `BUKKIT ₦250 platform service charge for Order #${breakdown.order_id.slice(-6)}`,
      created_at: now
    };
    entries.push(companyEntry);
    serverDb.setDoc('ledger_entries', companyEntry.id, companyEntry);

    // 5. Paystack Processing Fee (-₦35.25 processing expense)
    const paystackEntry: FinancialLedgerEntry = {
      id: `LED_PF_${breakdown.order_id}_${Date.now()}`,
      order_id: breakdown.order_id,
      type: 'PAYSTACK_FEE',
      recipient_type: 'PAYSTACK',
      recipient_id: 'paystack_gateway',
      amount: breakdown.paystack_fee,
      direction: 'debit',
      status: 'posted',
      reference: `PSTK_FEE_${breakdown.order_id}`,
      description: `Paystack payment processing expense for Order #${breakdown.order_id.slice(-6)}`,
      created_at: now
    };
    entries.push(paystackEntry);
    serverDb.setDoc('ledger_entries', paystackEntry.id, paystackEntry);

    return entries;
  }

  /**
   * Moves restaurant balance from PENDING to AVAILABLE upon order delivery/completion.
   */
  settleRestaurantEarnings(restaurantId: string, amount: number) {
    const existing = serverDb.getDoc('restaurant_balances', restaurantId) as RestaurantBalance | null;
    const pending = Math.max(0, (existing?.pending_amount || 0) - amount);
    const available = (existing?.available_for_settlement || 0) + amount;
    const totalEarned = (existing?.total_earned || 0) + amount;

    const updated: RestaurantBalance = {
      restaurant_id: restaurantId,
      restaurant_name: existing?.restaurant_name || `Restaurant ${restaurantId}`,
      pending_amount: Number(pending.toFixed(2)),
      available_for_settlement: Number(available.toFixed(2)),
      paid_out_amount: existing?.paid_out_amount || 0,
      total_earned: Number(totalEarned.toFixed(2)),
      updated_at: new Date().toISOString()
    };
    serverDb.setDoc('restaurant_balances', restaurantId, updated);
  }

  /**
   * Moves rider earnings from PENDING to AVAILABLE upon verified delivery completion.
   */
  settleRiderEarnings(riderId: string, amount: number) {
    const existing = serverDb.getDoc('rider_balances', riderId) as RiderBalance | null;
    const pending = Math.max(0, (existing?.pending_amount || 0) - amount);
    const available = (existing?.available_amount || 0) + amount;
    const totalEarned = (existing?.total_earned || 0) + amount;

    const updated: RiderBalance = {
      rider_id: riderId,
      rider_name: existing?.rider_name || `Rider ${riderId}`,
      pending_amount: Number(pending.toFixed(2)),
      available_amount: Number(available.toFixed(2)),
      paid_amount: existing?.paid_amount || 0,
      total_earned: Number(totalEarned.toFixed(2)),
      updated_at: new Date().toISOString()
    };
    serverDb.setDoc('rider_balances', riderId, updated);
  }

  /**
   * Internal helpers for pending balance credits.
   */
  private creditRestaurantPending(restaurantId: string, amount: number) {
    const existing = serverDb.getDoc('restaurant_balances', restaurantId) as RestaurantBalance | null;
    const updated: RestaurantBalance = {
      restaurant_id: restaurantId,
      pending_amount: Number(((existing?.pending_amount || 0) + amount).toFixed(2)),
      available_for_settlement: existing?.available_for_settlement || 0,
      paid_out_amount: existing?.paid_out_amount || 0,
      total_earned: existing?.total_earned || 0,
      updated_at: new Date().toISOString()
    };
    serverDb.setDoc('restaurant_balances', restaurantId, updated);
  }

  private creditRiderPending(riderId: string, amount: number) {
    const existing = serverDb.getDoc('rider_balances', riderId) as RiderBalance | null;
    const updated: RiderBalance = {
      rider_id: riderId,
      pending_amount: Number(((existing?.pending_amount || 0) + amount).toFixed(2)),
      available_amount: existing?.available_amount || 0,
      paid_amount: existing?.paid_amount || 0,
      total_earned: existing?.total_earned || 0,
      updated_at: new Date().toISOString()
    };
    serverDb.setDoc('rider_balances', riderId, updated);
  }

  /**
   * Records reversal entries for a refund without ever deleting the original records.
   */
  recordRefundReversals(orderId: string, amount: number, reason: string, breakdown?: OrderFinancialBreakdown): FinancialLedgerEntry[] {
    const now = new Date().toISOString();
    const reversalEntries: FinancialLedgerEntry[] = [];

    // 1. Customer Refund Reversal
    const refundEntry: FinancialLedgerEntry = {
      id: `LED_REF_${orderId}_${Date.now()}`,
      order_id: orderId,
      type: 'REFUND',
      recipient_type: 'CUSTOMER',
      recipient_id: 'customer',
      amount: amount,
      direction: 'debit',
      status: 'posted',
      reference: `REFUND_${orderId}`,
      description: `Reversal refund: ${reason}`,
      created_at: now,
      metadata: { original_amount: amount, reason }
    };
    reversalEntries.push(refundEntry);
    serverDb.setDoc('ledger_entries', refundEntry.id, refundEntry);

    // 2. Adjust restaurant & rider pending liabilities if unfulfilled
    if (breakdown) {
      if (breakdown.restaurant_payable > 0) {
        const restAdj: FinancialLedgerEntry = {
          id: `LED_ADJ_REST_${orderId}_${Date.now()}`,
          order_id: orderId,
          type: 'ADJUSTMENT',
          recipient_type: 'RESTAURANT',
          recipient_id: 'restaurant',
          amount: breakdown.restaurant_payable,
          direction: 'credit',
          status: 'reversed',
          reference: `ADJ_REST_${orderId}`,
          description: `Restaurant payable reversal for refunded order`,
          created_at: now
        };
        reversalEntries.push(restAdj);
        serverDb.setDoc('ledger_entries', restAdj.id, restAdj);
      }
    }

    return reversalEntries;
  }

  /**
   * Records an operational business expense (e.g. servers, SMS, marketing, staff).
   */
  recordBusinessExpense(expense: Omit<BusinessExpense, 'id' | 'created_at'>): BusinessExpense {
    const id = `EXP_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const fullExpense: BusinessExpense = {
      ...expense,
      id,
      created_at: new Date().toISOString()
    };
    serverDb.setDoc('business_expenses', id, fullExpense);

    const ledgerEntry: FinancialLedgerEntry = {
      id: `LED_EXP_${id}`,
      order_id: 'business_operations',
      type: 'OPERATING_EXPENSE',
      recipient_type: 'PLATFORM',
      recipient_id: expense.category,
      amount: expense.amount,
      direction: 'debit',
      status: 'posted',
      reference: id,
      description: `Operating Expense [${expense.category.toUpperCase()}]: ${expense.description}`,
      created_at: fullExpense.created_at
    };
    serverDb.setDoc('ledger_entries', ledgerEntry.id, ledgerEntry);

    return fullExpense;
  }

  // -------------------------------------------------------------
  // ANALYTICS & AGGREGATIONS ENGINE
  // -------------------------------------------------------------

  getFinancialMetrics(startDate?: Date, endDate?: Date): FinancialMetrics {
    const allLedger = serverDb.getAll('ledger_entries') as FinancialLedgerEntry[];
    const allPayments = serverDb.getAll('payments');
    const allExpenses = serverDb.getAll('business_expenses') as BusinessExpense[];

    const filteredLedger = allLedger.filter((e) => {
      if (!startDate && !endDate) return true;
      const t = new Date(e.created_at).getTime();
      if (startDate && t < startDate.getTime()) return false;
      if (endDate && t > endDate.getTime()) return false;
      return true;
    });

    const filteredExpenses = allExpenses.filter((e) => {
      if (!startDate && !endDate) return true;
      const t = new Date(e.date || e.created_at).getTime();
      if (startDate && t < startDate.getTime()) return false;
      if (endDate && t > endDate.getTime()) return false;
      return true;
    });

    // Compute distinct paid orders in range
    const paidOrderIds = new Set<string>();
    let totalCustomerGMV = 0;
    let totalRestaurantPayable = 0;
    let totalRiderPayable = 0;
    let totalBukkitGrossRevenue = 0;
    let totalPaystackFees = 0;
    let totalRefunds = 0;

    for (const entry of filteredLedger) {
      if (entry.type === 'CUSTOMER_PAYMENT' && entry.status === 'posted') {
        paidOrderIds.add(entry.order_id);
        totalCustomerGMV += entry.amount;
      } else if (entry.type === 'RESTAURANT_PAYABLE') {
        totalRestaurantPayable += entry.amount;
      } else if (entry.type === 'RIDER_PAYABLE') {
        totalRiderPayable += entry.amount;
      } else if (entry.type === 'COMPANY_REVENUE') {
        totalBukkitGrossRevenue += entry.amount;
      } else if (entry.type === 'PAYSTACK_FEE') {
        totalPaystackFees += entry.amount;
      } else if (entry.type === 'REFUND') {
        totalRefunds += entry.amount;
      }
    }

    const totalOperatingExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalBukkitNetTransactionRevenue = Number((totalBukkitGrossRevenue - totalPaystackFees).toFixed(2));
    const netProfit = Number((totalBukkitNetTransactionRevenue - totalRefunds - totalOperatingExpenses).toFixed(2));
    const totalOrders = paidOrderIds.size;

    const averageOrderValue = totalOrders > 0 ? Number((totalCustomerGMV / totalOrders).toFixed(2)) : 0;
    const platformRevenuePerOrder = totalOrders > 0 ? Number((totalBukkitGrossRevenue / totalOrders).toFixed(2)) : 0;
    const paymentProcessingCostPerOrder = totalOrders > 0 ? Number((totalPaystackFees / totalOrders).toFixed(2)) : 0;

    return {
      totalOrders,
      totalCustomerGMV: Number(totalCustomerGMV.toFixed(2)),
      totalRestaurantPayable: Number(totalRestaurantPayable.toFixed(2)),
      totalRiderPayable: Number(totalRiderPayable.toFixed(2)),
      totalBukkitGrossRevenue: Number(totalBukkitGrossRevenue.toFixed(2)),
      totalPaystackFees: Number(totalPaystackFees.toFixed(2)),
      totalBukkitNetTransactionRevenue,
      totalOperatingExpenses: Number(totalOperatingExpenses.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
      totalPayouts: 0,
      netProfit,
      averageOrderValue,
      platformRevenuePerOrder,
      paymentProcessingCostPerOrder
    };
  }

  getDailyAnalytics(daysCount: number = 30): DailyFinancialItem[] {
    const dailyMap = new Map<string, DailyFinancialItem>();
    const now = new Date();

    // Initialize consecutive past N days
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoDate = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(isoDate, {
        date: isoDate,
        dayLabel,
        orders: 0,
        gmv: 0,
        companyGross: 0,
        paystackFees: 0,
        companyNet: 0,
        restaurantPayable: 0,
        riderPayable: 0,
        operatingExpenses: 0,
        refunds: 0,
        netProfit: 0
      });
    }

    const allLedger = serverDb.getAll('ledger_entries') as FinancialLedgerEntry[];
    const dayOrdersMap = new Map<string, Set<string>>();

    for (const entry of allLedger) {
      const dateKey = entry.created_at.split('T')[0];
      const item = dailyMap.get(dateKey);
      if (!item) continue;

      if (entry.type === 'CUSTOMER_PAYMENT' && entry.status === 'posted') {
        item.gmv += entry.amount;
        if (!dayOrdersMap.has(dateKey)) dayOrdersMap.set(dateKey, new Set());
        dayOrdersMap.get(dateKey)!.add(entry.order_id);
      } else if (entry.type === 'RESTAURANT_PAYABLE') {
        item.restaurantPayable += entry.amount;
      } else if (entry.type === 'RIDER_PAYABLE') {
        item.riderPayable += entry.amount;
      } else if (entry.type === 'COMPANY_REVENUE') {
        item.companyGross += entry.amount;
      } else if (entry.type === 'PAYSTACK_FEE') {
        item.paystackFees += entry.amount;
      } else if (entry.type === 'REFUND') {
        item.refunds += entry.amount;
      }
    }

    const allExpenses = serverDb.getAll('business_expenses') as BusinessExpense[];
    for (const exp of allExpenses) {
      const dateKey = (exp.date || exp.created_at).split('T')[0];
      const item = dailyMap.get(dateKey);
      if (item) {
        item.operatingExpenses += exp.amount;
      }
    }

    // Format & finalize daily totals
    return Array.from(dailyMap.values()).map((day) => {
      const dayOrderSet = dayOrdersMap.get(day.date);
      const orders = dayOrderSet ? dayOrderSet.size : 0;
      const companyNet = Number((day.companyGross - day.paystackFees).toFixed(2));
      const netProfit = Number((companyNet - day.refunds - day.operatingExpenses).toFixed(2));
      return {
        ...day,
        orders,
        gmv: Number(day.gmv.toFixed(2)),
        companyGross: Number(day.companyGross.toFixed(2)),
        paystackFees: Number(day.paystackFees.toFixed(2)),
        companyNet,
        restaurantPayable: Number(day.restaurantPayable.toFixed(2)),
        riderPayable: Number(day.riderPayable.toFixed(2)),
        operatingExpenses: Number(day.operatingExpenses.toFixed(2)),
        refunds: Number(day.refunds.toFixed(2)),
        netProfit
      };
    });
  }

  getMonthlyAnalytics(monthsCount: number = 6): MonthlyFinancialItem[] {
    const monthMap = new Map<string, MonthlyFinancialItem>();
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthMap.set(yearMonth, {
        month: yearMonth,
        monthLabel,
        orders: 0,
        gmv: 0,
        companyGross: 0,
        paystackFees: 0,
        companyNet: 0,
        restaurantPayable: 0,
        riderPayable: 0,
        operatingExpenses: 0,
        refunds: 0,
        netProfit: 0
      });
    }

    const allLedger = serverDb.getAll('ledger_entries') as FinancialLedgerEntry[];
    const monthOrdersMap = new Map<string, Set<string>>();

    for (const entry of allLedger) {
      const yearMonth = entry.created_at.slice(0, 7);
      const item = monthMap.get(yearMonth);
      if (!item) continue;

      if (entry.type === 'CUSTOMER_PAYMENT' && entry.status === 'posted') {
        item.gmv += entry.amount;
        if (!monthOrdersMap.has(yearMonth)) monthOrdersMap.set(yearMonth, new Set());
        monthOrdersMap.get(yearMonth)!.add(entry.order_id);
      } else if (entry.type === 'RESTAURANT_PAYABLE') {
        item.restaurantPayable += entry.amount;
      } else if (entry.type === 'RIDER_PAYABLE') {
        item.riderPayable += entry.amount;
      } else if (entry.type === 'COMPANY_REVENUE') {
        item.companyGross += entry.amount;
      } else if (entry.type === 'PAYSTACK_FEE') {
        item.paystackFees += entry.amount;
      } else if (entry.type === 'REFUND') {
        item.refunds += entry.amount;
      }
    }

    const allExpenses = serverDb.getAll('business_expenses') as BusinessExpense[];
    for (const exp of allExpenses) {
      const yearMonth = (exp.date || exp.created_at).slice(0, 7);
      const item = monthMap.get(yearMonth);
      if (item) {
        item.operatingExpenses += exp.amount;
      }
    }

    return Array.from(monthMap.values()).map((m) => {
      const orderSet = monthOrdersMap.get(m.month);
      const orders = orderSet ? orderSet.size : 0;
      const companyNet = Number((m.companyGross - m.paystackFees).toFixed(2));
      const netProfit = Number((companyNet - m.refunds - m.operatingExpenses).toFixed(2));
      return {
        ...m,
        orders,
        gmv: Number(m.gmv.toFixed(2)),
        companyGross: Number(m.companyGross.toFixed(2)),
        paystackFees: Number(m.paystackFees.toFixed(2)),
        companyNet,
        restaurantPayable: Number(m.restaurantPayable.toFixed(2)),
        riderPayable: Number(m.riderPayable.toFixed(2)),
        operatingExpenses: Number(m.operatingExpenses.toFixed(2)),
        refunds: Number(m.refunds.toFixed(2)),
        netProfit
      };
    });
  }
}

export const financialLedger = new FinancialLedgerService();
