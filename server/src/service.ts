import type { DatabaseSync } from 'node:sqlite';
import {
  Customer,
  ExpenseRecord,
  PaymentInput,
  PlanSub,
  Product,
  SaleLine,
  SaleRecord,
  ShiftRecord,
  Visit,
  VisitFoodItem,
} from '../../shared/types';
import {
  computeElapsedMinutes,
  computePlanEndDate,
  computeTimeCharge,
  isPlanActiveOnDate,
} from '../../shared/billing';
import { getSettings } from './db';
import { appendExpenseToCsv, appendSaleToCsv } from './csv';
import { createDatabaseBackup } from './backup';

export class PosService {
  constructor(
    public db: DatabaseSync,
    private csvBaseDir?: string
  ) {}

  // --- PRODUCTS ---
  listProducts(includeInactive = false): Product[] {
    const sql = includeInactive
      ? 'SELECT id, name, category, price, active FROM products ORDER BY category, name'
      : 'SELECT id, name, category, price, active FROM products WHERE active = 1 ORDER BY category, name';
    return this.db.prepare(sql).all() as unknown as Product[];
  }

  saveProduct(input: { id?: number; name: string; category: string; price: number; active?: number }): Product {
    if (input.id) {
      this.db
        .prepare('UPDATE products SET name = ?, category = ?, price = ?, active = ? WHERE id = ?')
        .run(input.name, input.category, input.price, input.active ?? 1, input.id);
      return this.db.prepare('SELECT * FROM products WHERE id = ?').get(input.id) as unknown as Product;
    } else {
      const res = this.db
        .prepare('INSERT INTO products (name, category, price, active) VALUES (?, ?, ?, ?)')
        .run(input.name, input.category, input.price, input.active ?? 1);
      return this.db.prepare('SELECT * FROM products WHERE id = ?').get(res.lastInsertRowid) as unknown as Product;
    }
  }

  // --- CUSTOMERS & MEMBERSHIPS ---
  listCustomers(search = ''): Customer[] {
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      return this.db
        .prepare(
          `SELECT id, name, member_card_no as memberCardNo, is_member as isMember, phone, created_at as createdAt
           FROM customers WHERE name LIKE ? OR member_card_no LIKE ? ORDER BY name LIMIT 100`
        )
        .all(q, q) as unknown as Customer[];
    }
    return this.db
      .prepare(
        `SELECT id, name, member_card_no as memberCardNo, is_member as isMember, phone, created_at as createdAt
         FROM customers ORDER BY id DESC LIMIT 100`
      )
      .all() as unknown as Customer[];
  }

  createOrUpdateCustomer(input: {
    id?: number;
    name: string;
    memberCardNo?: string | null;
    isMember?: boolean;
    phone?: string | null;
  }): Customer {
    const now = new Date().toISOString();
    if (input.id) {
      this.db
        .prepare('UPDATE customers SET name = ?, member_card_no = ?, is_member = ?, phone = ? WHERE id = ?')
        .run(input.name.trim(), input.memberCardNo || null, input.isMember ? 1 : 0, input.phone || null, input.id);
      return this.getCustomerById(input.id)!;
    }
    const res = this.db
      .prepare('INSERT INTO customers (name, member_card_no, is_member, phone, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(input.name.trim(), input.memberCardNo || null, input.isMember ? 1 : 0, input.phone || null, now);
    return this.getCustomerById(Number(res.lastInsertRowid))!;
  }

  getCustomerById(id: number): Customer | undefined {
    return this.db
      .prepare(
        `SELECT id, name, member_card_no as memberCardNo, is_member as isMember, phone, created_at as createdAt
         FROM customers WHERE id = ?`
      )
      .get(id) as unknown as Customer | undefined;
  }

  // --- PLANS ---
  listPlanSubs(onlyActiveToday = false): PlanSub[] {
    const rows = this.db
      .prepare(
        `SELECT id, customer_id as customerId, customer_name as customerName, plan_type as planType,
                start_date as startDate, end_date as endDate, price, is_member as isMember, active
         FROM plan_subs ORDER BY id DESC`
      )
      .all() as unknown as PlanSub[];

    if (!onlyActiveToday) return rows;
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => isPlanActiveOnDate(r, today));
  }

  getActivePlanForCustomer(customerId: number, dateYmd: string): PlanSub | undefined {
    const subs = this.db
      .prepare(
        `SELECT id, customer_id as customerId, customer_name as customerName, plan_type as planType,
                start_date as startDate, end_date as endDate, price, is_member as isMember, active
         FROM plan_subs WHERE customer_id = ? AND active = 1 ORDER BY end_date DESC`
      )
      .all(customerId) as unknown as PlanSub[];

    return subs.find((s) => isPlanActiveOnDate(s, dateYmd));
  }

  // --- VISITS (TIME IN / WHO'S IN / TIME OUT) ---
  listActiveVisits(): Visit[] {
    const visits = this.db
      .prepare(
        `SELECT id, customer_id as customerId, customer_name as customerName, member_card_no as memberCardNo,
                is_member as isMember, plan_sub_id as planSubId, time_in as timeIn, time_out as timeOut,
                status, notes
         FROM visits WHERE status = 'active' ORDER BY time_in ASC`
      )
      .all() as unknown as Omit<Visit, 'foodItems'>[];

    const getFood = this.db.prepare(
      `SELECT id, visit_id as visitId, product_id as productId, item_name as itemName,
              qty, unit_price as unitPrice, amount
       FROM visit_food_items WHERE visit_id = ?`
    );

    return visits.map((v) => ({
      ...v,
      foodItems: getFood.all(v.id) as unknown as VisitFoodItem[],
    }));
  }

  getVisitById(visitId: number): Visit | undefined {
    const v = this.db
      .prepare(
        `SELECT id, customer_id as customerId, customer_name as customerName, member_card_no as memberCardNo,
                is_member as isMember, plan_sub_id as planSubId, time_in as timeIn, time_out as timeOut,
                status, notes
         FROM visits WHERE id = ?`
      )
      .get(visitId) as unknown as Omit<Visit, 'foodItems'> | undefined;

    if (!v) return undefined;
    const foodItems = this.db
      .prepare(
        `SELECT id, visit_id as visitId, product_id as productId, item_name as itemName,
                qty, unit_price as unitPrice, amount
         FROM visit_food_items WHERE visit_id = ?`
      )
      .all(visitId) as unknown as VisitFoodItem[];

    return { ...v, foodItems };
  }

  timeIn(input: {
    customerId?: number | null;
    customerName: string;
    memberCardNo?: string | null;
    isMember?: boolean;
    planSubId?: number | null;
    notes?: string | null;
    timeInIso?: string;
    allowOutsideHours?: boolean;
  }): Visit {
    const settings = getSettings(this.db);
    const nowIso = input.timeInIso ?? new Date().toISOString();
    const nowDate = new Date(nowIso);
    const hour = nowDate.getHours();

    if (!input.allowOutsideHours && (hour < settings.openHour || hour >= settings.closeHour)) {
      throw new Error(
        `Shop operating hours are ${settings.openHour}:00 to ${settings.closeHour}:00. Use override if needed.`
      );
    }

    let isMember = Boolean(input.isMember);
    let memberCardNo = input.memberCardNo ?? null;
    let planSubId = input.planSubId ?? null;

    if (input.customerId) {
      const cust = this.getCustomerById(input.customerId);
      if (cust) {
        isMember = Boolean(cust.isMember);
        memberCardNo = cust.memberCardNo;
        if (!planSubId) {
          const activePlan = this.getActivePlanForCustomer(cust.id, nowIso.slice(0, 10));
          if (activePlan) planSubId = activePlan.id;
        }
      }
    }

    const res = this.db
      .prepare(
        `INSERT INTO visits (customer_id, customer_name, member_card_no, is_member, plan_sub_id, time_in, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .run(
        input.customerId ?? null,
        input.customerName.trim(),
        memberCardNo,
        isMember ? 1 : 0,
        planSubId,
        nowIso,
        input.notes ?? null
      );

    return this.getVisitById(Number(res.lastInsertRowid))!;
  }

  addFoodToVisit(visitId: number, productId: number, qty: number): Visit {
    const visit = this.getVisitById(visitId);
    if (!visit || visit.status !== 'active') throw new Error('Active visit not found');

    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as unknown as Product | undefined;
    if (!product) throw new Error('Product not found');

    const existing = this.db
      .prepare('SELECT id, qty FROM visit_food_items WHERE visit_id = ? AND product_id = ?')
      .get(visitId, productId) as { id: number; qty: number } | undefined;

    if (existing) {
      const newQty = existing.qty + qty;
      if (newQty <= 0) {
        this.db.prepare('DELETE FROM visit_food_items WHERE id = ?').run(existing.id);
      } else {
        this.db
          .prepare('UPDATE visit_food_items SET qty = ?, amount = ? WHERE id = ?')
          .run(newQty, newQty * product.price, existing.id);
      }
    } else if (qty > 0) {
      this.db
        .prepare(
          'INSERT INTO visit_food_items (visit_id, product_id, item_name, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(visitId, product.id, product.name, qty, product.price, qty * product.price);
    }

    return this.getVisitById(visitId)!;
  }

  removeFoodItemFromVisit(visitId: number, visitFoodItemId: number): Visit {
    this.db.prepare('DELETE FROM visit_food_items WHERE id = ? AND visit_id = ?').run(visitFoodItemId, visitId);
    return this.getVisitById(visitId)!;
  }

  /**
   * Previews the bill for an active visit as of `timeOutIso` (defaults to now).
   */
  previewVisitCheckout(visitId: number, timeOutIso?: string) {
    const visit = this.getVisitById(visitId);
    if (!visit) throw new Error('Visit not found');

    const settings = getSettings(this.db);
    const outIso = timeOutIso ?? new Date().toISOString();
    const minutesStayed = computeElapsedMinutes(visit.timeIn, outIso, settings.closeHour);
    const hasPlan = Boolean(visit.planSubId);
    const timeBill = computeTimeCharge(minutesStayed, Boolean(visit.isMember), hasPlan, settings.tiers);

    const lines: SaleLine[] = [
      {
        type: 'time',
        item: `Study Time - ${timeBill.tierLabel}`,
        qty: 1,
        unitPrice: timeBill.amount,
        amount: timeBill.amount,
      },
      ...visit.foodItems.map((f) => ({
        type: 'food' as const,
        item: f.itemName,
        qty: f.qty,
        unitPrice: f.unitPrice,
        amount: f.amount,
      })),
    ];

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    return {
      visit,
      timeOutIso: outIso,
      minutesStayed,
      hoursBilled: timeBill.hours,
      tierLabel: timeBill.tierLabel,
      timeCharge: timeBill.amount,
      lines,
      subtotal,
    };
  }

  // --- SALES & CHECKOUT ---
  private nextReceiptNo(): string {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM sales').get() as { cnt: number };
    const seq = (row.cnt + 1).toString().padStart(5, '0');
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `SC-${ymd}-${seq}`;
  }

  recordSale(input: {
    visitId?: number;
    timeOutIso?: string;
    staffName: string;
    customerName: string;
    isMember: boolean;
    minutesStayed?: number;
    lines: SaleLine[];
    discount?: number;
    payments: PaymentInput[];
    // Optional: if selling a Plan or Membership Card, create records atomically
    newMembership?: {
      customerId?: number;
      customerName: string;
      memberCardNo: string;
      phone?: string;
    };
    newPlan?: {
      customerId?: number;
      customerName: string;
      isMember: boolean;
      planType: 'weekly' | 'semi_month' | 'monthly';
      startDate: string;
      days: number;
      price: number;
    };
  }): SaleRecord {
    const discount = Math.max(0, input.discount ?? 0);
    const subtotal = input.lines.reduce((sum, l) => sum + l.amount, 0);
    const total = Math.max(0, subtotal - discount);
    const paidSum = input.payments.reduce((sum, p) => sum + p.amount, 0);

    if (paidSum < total) {
      throw new Error(`Payment total (${paidSum}) is less than sale total (${total})`);
    }

    const nowIso = input.timeOutIso ?? new Date().toISOString();
    const receiptNo = this.nextReceiptNo();

    this.db.exec('BEGIN TRANSACTION;');
    try {
      let resolvedCustomerId = input.newMembership?.customerId ?? input.newPlan?.customerId;

      if (input.newMembership) {
        const cust = this.createOrUpdateCustomer({
          id: input.newMembership.customerId,
          name: input.newMembership.customerName,
          memberCardNo: input.newMembership.memberCardNo,
          isMember: true,
          phone: input.newMembership.phone,
        });
        resolvedCustomerId = cust.id;
      }

      if (input.newPlan) {
        if (!resolvedCustomerId) {
          const cust = this.createOrUpdateCustomer({
            name: input.newPlan.customerName,
            isMember: input.newPlan.isMember,
          });
          resolvedCustomerId = cust.id;
        }
        const endDate = computePlanEndDate(input.newPlan.startDate, input.newPlan.days);
        this.db
          .prepare(
            `INSERT INTO plan_subs (customer_id, customer_name, plan_type, start_date, end_date, price, is_member, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
          )
          .run(
            resolvedCustomerId,
            input.newPlan.customerName,
            input.newPlan.planType,
            input.newPlan.startDate,
            endDate,
            input.newPlan.price,
            input.newPlan.isMember ? 1 : 0,
            nowIso
          );
      }

      if (input.visitId) {
        this.db
          .prepare("UPDATE visits SET time_out = ?, status = 'checked_out' WHERE id = ?")
          .run(nowIso, input.visitId);
      }

      const saleRes = this.db
        .prepare(
          `INSERT INTO sales (receipt_no, created_at, staff_name, customer_name, is_member, minutes_stayed, subtotal, discount, total, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')`
        )
        .run(
          receiptNo,
          nowIso,
          input.staffName,
          input.customerName,
          input.isMember ? 1 : 0,
          input.minutesStayed ?? 0,
          subtotal,
          discount,
          total
        );

      const saleId = Number(saleRes.lastInsertRowid);

      const insertLine = this.db.prepare(
        'INSERT INTO sale_lines (sale_id, type, item, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const line of input.lines) {
        insertLine.run(saleId, line.type, line.item, line.qty, line.unitPrice, line.amount);
      }

      const insertPay = this.db.prepare(
        'INSERT INTO payments (sale_id, method, amount, tendered, ref_no) VALUES (?, ?, ?, ?, ?)'
      );
      for (const p of input.payments) {
        insertPay.run(saleId, p.method, p.amount, p.tendered ?? p.amount, p.refNo ?? null);
      }

      this.db.exec('COMMIT;');

      const record: SaleRecord = {
        id: saleId,
        receiptNo,
        createdAt: nowIso,
        staffName: input.staffName,
        customerName: input.customerName,
        isMember: input.isMember ? 1 : 0,
        minutesStayed: input.minutesStayed ?? 0,
        subtotal,
        discount,
        total,
        status: 'paid',
        lines: input.lines,
        payments: input.payments,
      };

      // Immediately save to CSV
      appendSaleToCsv(record, this.csvBaseDir);
      return record;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  // --- EXPENSES ---
  addExpense(input: {
    category: string;
    amount: number;
    method: 'cash' | 'card' | 'qrph' | 'bank';
    note: string;
    staffName: string;
    createdAt?: string;
  }): ExpenseRecord {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const res = this.db
      .prepare('INSERT INTO expenses (created_at, category, amount, method, note, staff_name) VALUES (?, ?, ?, ?, ?, ?)')
      .run(createdAt, input.category, input.amount, input.method, input.note ?? '', input.staffName);

    const record: ExpenseRecord = {
      id: Number(res.lastInsertRowid),
      createdAt,
      category: input.category,
      amount: input.amount,
      method: input.method,
      note: input.note ?? '',
      staffName: input.staffName,
    };

    appendExpenseToCsv(record, this.csvBaseDir);
    return record;
  }

  // --- SHIFTS ---
  getCurrentShift(): ShiftRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, opened_at as openedAt, closed_at as closedAt, opened_by as openedBy,
                closed_by as closedBy, opening_cash as openingCash, counted_cash as countedCash,
                expected_cash as expectedCash, notes
         FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`
      )
      .get() as unknown as ShiftRecord | undefined;
    return row ?? null;
  }

  openShift(openedBy: string, openingCash: number): ShiftRecord {
    const current = this.getCurrentShift();
    if (current) return current;
    const now = new Date().toISOString();
    const res = this.db
      .prepare('INSERT INTO shifts (opened_at, opened_by, opening_cash) VALUES (?, ?, ?)')
      .run(now, openedBy, openingCash);
    return this.db
      .prepare(
        `SELECT id, opened_at as openedAt, closed_at as closedAt, opened_by as openedBy,
                closed_by as closedBy, opening_cash as openingCash, counted_cash as countedCash,
                expected_cash as expectedCash, notes
         FROM shifts WHERE id = ?`
      )
      .get(res.lastInsertRowid) as unknown as ShiftRecord;
  }

  closeShift(closedBy: string, countedCash: number, notes?: string): { shift: ShiftRecord; backupFile: string } {
    const current = this.getCurrentShift();
    if (!current) throw new Error('No open shift');

    const now = new Date().toISOString();
    const cashSales = this.db
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         JOIN sales s ON s.id = p.sale_id
         WHERE p.method = 'cash' AND s.status = 'paid' AND s.created_at >= ?`
      )
      .get(current.openedAt) as { total: number };

    const cashExpenses = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses
         WHERE method = 'cash' AND created_at >= ?`
      )
      .get(current.openedAt) as { total: number };

    const expectedCash = current.openingCash + cashSales.total - cashExpenses.total;

    this.db
      .prepare(
        'UPDATE shifts SET closed_at = ?, closed_by = ?, counted_cash = ?, expected_cash = ?, notes = ? WHERE id = ?'
      )
      .run(now, closedBy, countedCash, expectedCash, notes ?? null, current.id);

    const updated = this.db
      .prepare(
        `SELECT id, opened_at as openedAt, closed_at as closedAt, opened_by as openedBy,
                closed_by as closedBy, opening_cash as openingCash, counted_cash as countedCash,
                expected_cash as expectedCash, notes
         FROM shifts WHERE id = ?`
      )
      .get(current.id) as unknown as ShiftRecord;

    // Automatic database backup on every shift close
    const backup = createDatabaseBackup(this.db, 'shift_close');
    return { shift: updated, backupFile: backup.fileName };
  }

  // --- LEDGER & SUMMARY ---
  getLedgerSummary(datePrefix?: string) {
    const prefix = datePrefix || new Date().toISOString().slice(0, 10); // YYYY-MM-DD or YYYY-MM
    const likePattern = `${prefix}%`;

    const salesRows = this.db
      .prepare(
        `SELECT id, receipt_no as receiptNo, created_at as createdAt, staff_name as staffName,
                customer_name as customerName, is_member as isMember, minutes_stayed as minutesStayed,
                subtotal, discount, total, status
         FROM sales WHERE created_at LIKE ? AND status = 'paid' ORDER BY id DESC`
      )
      .all(likePattern) as unknown as Omit<SaleRecord, 'lines' | 'payments'>[];

    const getLines = this.db.prepare(
      'SELECT id, sale_id as saleId, type, item, qty, unit_price as unitPrice, amount FROM sale_lines WHERE sale_id = ?'
    );
    const getPays = this.db.prepare(
      'SELECT method, amount, tendered, ref_no as refNo FROM payments WHERE sale_id = ?'
    );

    const sales: SaleRecord[] = salesRows.map((s) => ({
      ...s,
      lines: getLines.all(s.id) as unknown as SaleLine[],
      payments: getPays.all(s.id) as unknown as PaymentInput[],
    }));

    const expenses = this.db
      .prepare(
        `SELECT id, created_at as createdAt, category, amount, method, note, staff_name as staffName
         FROM expenses WHERE created_at LIKE ? ORDER BY id DESC`
      )
      .all(likePattern) as unknown as ExpenseRecord[];

    const byCategory = { time: 0, plan: 0, membership: 0, food: 0 };
    const byPayment = { cash: 0, card: 0, qrph: 0 };
    let grossSales = 0;
    let totalDiscounts = 0;

    for (const s of sales) {
      grossSales += s.total;
      totalDiscounts += s.discount;
      for (const l of s.lines) {
        if (l.type in byCategory) {
          byCategory[l.type] += l.amount;
        }
      }
      for (const p of s.payments) {
        if (p.method in byPayment) {
          byPayment[p.method] += p.amount;
        }
      }
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = grossSales - totalExpenses;

    return {
      period: prefix,
      grossSales,
      totalDiscounts,
      totalExpenses,
      netIncome,
      byCategory,
      byPayment,
      sales,
      expenses,
      currentShift: this.getCurrentShift(),
    };
  }
}
