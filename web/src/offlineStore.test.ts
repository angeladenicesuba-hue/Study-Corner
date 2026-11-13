import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetOfflineState,
  getOfflineBootstrap,
  offlineTimeIn,
  offlineAddFoodToVisit,
  offlinePreviewCheckout,
  offlineRecordSale,
  offlineAddExpense,
  offlineOpenShift,
  offlineCloseShift,
  offlineGetLedger,
  enqueueOutboxMutation,
  getOutboxQueue,
  generateOfflineCsvContent,
} from './offlineStore';

describe('Offline LocalStorage Engine (offlineStore)', () => {
  beforeEach(() => {
    resetOfflineState();
  });

  it('initializes default Study Corner settings and 15 menu items in localStorage', () => {
    const boot = getOfflineBootstrap();
    expect(boot.settings.shopName).toBe('Study Corner');
    expect(boot.products.length).toBe(15);
    expect(boot.activeVisits.length).toBe(0);
  });

  it('handles full offline Time In -> Add Food -> Preview -> Checkout workflow', () => {
    const visit = offlineTimeIn({
      customerName: 'Juan Dela Cruz',
      isMember: true,
      memberCardNo: 'SC-101',
      timeInIso: '2026-11-12T10:00:00.000Z',
      allowOutsideHours: true,
    });
    expect(visit.id).toBe(1);
    expect(visit.isMember).toBe(1);

    // Add 2x Spanish Latte (id=4, price=95)
    const updatedVisit = offlineAddFoodToVisit(visit.id, 4, 2);
    expect(updatedVisit.foodItems.length).toBe(1);
    expect(updatedVisit.foodItems[0].amount).toBe(190);

    // Preview checkout after 2 hours (120 mins -> 1-2h Member rate = 70)
    const preview = offlinePreviewCheckout(visit.id, '2026-11-12T12:00:00.000Z');
    expect(preview.timeCharge).toBe(70);
    expect(preview.subtotal).toBe(260);

    // Record sale offline
    const sale = offlineRecordSale({
      visitId: visit.id,
      timeOutIso: '2026-11-12T12:00:00.000Z',
      staffName: 'Front Desk',
      customerName: visit.customerName,
      isMember: true,
      minutesStayed: preview.minutesStayed,
      lines: preview.lines,
      payments: [{ method: 'cash', amount: 260, tendered: 300 }],
    });

    expect(sale.receiptNo).toBe('SC-20261112-00001');
    expect(sale.total).toBe(260);
    expect(getOfflineBootstrap().activeVisits.length).toBe(0);
  });

  it('supports offline Plans, Expenses, Shifts, Ledger summary, CSV export, and Outbox queue', () => {
    offlineOpenShift('Cashier A', 1000, '2026-11-12T08:00:00.000Z');

    // Sell a Weekly Plan (Member rate = 800)
    offlineRecordSale({
      timeOutIso: '2026-11-12T09:00:00.000Z',
      staffName: 'Cashier A',
      customerName: 'Maria Santos',
      isMember: true,
      lines: [{ type: 'plan', item: 'Weekly (7 Days)', qty: 1, unitPrice: 800, amount: 800 }],
      payments: [{ method: 'cash', amount: 800, tendered: 1000 }],
      newPlan: {
        customerName: 'Maria Santos',
        isMember: true,
        planType: 'weekly',
        startDate: '2026-11-12',
        days: 7,
        price: 800,
      },
    });

    // Log a cash expense of 150
    offlineAddExpense({
      category: 'Coffee / Milk / Ice',
      amount: 150,
      method: 'cash',
      note: '2 bags of ice',
      staffName: 'Cashier A',
      createdAt: '2026-11-12T11:00:00.000Z',
    });

    const ledger = offlineGetLedger('2026-11-12');
    expect(ledger.grossSales).toBe(800);
    expect(ledger.totalExpenses).toBe(150);
    expect(ledger.netIncome).toBe(650);

    // Close shift: expected cash = 1000 + 800 - 150 = 1650
    const closed = offlineCloseShift('Cashier A', 1650, 'All balanced');
    expect(closed.shift.expectedCash).toBe(1650);

    // CSV export contains our sale
    const salesCsv = generateOfflineCsvContent('sales', '2026-11');
    expect(salesCsv).toContain('Maria Santos');
    expect(salesCsv).toContain('Weekly (7 Days)');

    // Outbox queue stores offline mutations
    enqueueOutboxMutation('/api/sales', 'POST', { total: 800 });
    expect(getOutboxQueue().length).toBe(1);
  });
});
