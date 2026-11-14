import {
  AppSettings,
  Customer,
  ExpenseRecord,
  PaymentInput,
  PlanSub,
  Product,
  SaleLine,
  SaleRecord,
  ShiftRecord,
  Visit,
} from '@shared/types';
import {
  DEFAULT_CLOSE_HOUR,
  DEFAULT_OPEN_HOUR,
  DEFAULT_PLANS,
  DEFAULT_TIERS,
  computeElapsedMinutes,
  computePlanEndDate,
  computeTimeCharge,
  isPlanActiveOnDate,
} from '@shared/billing';
import type { BootstrapData, LedgerResponse } from './api';

export const STORAGE_KEY = 'sc_pos_state_v1';
export const OUTBOX_KEY = 'sc_pos_outbox_v1';

const DEFAULT_QR_SVG_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="320" height="360">
  <rect width="320" height="360" rx="16" fill="#ffffff" stroke="#1e293b" stroke-width="4"/>
  <rect x="20" y="20" width="280" height="44" rx="8" fill="#1e40af"/>
  <text x="160" y="48" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">QR Ph • Study Corner</text>
  <rect x="50" y="80" width="220" height="220" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,6"/>
  <rect x="70" y="100" width="50" height="50" fill="#0f172a"/>
  <rect x="80" y="110" width="30" height="30" fill="#ffffff"/>
  <rect x="88" y="118" width="14" height="14" fill="#0f172a"/>
  <rect x="200" y="100" width="50" height="50" fill="#0f172a"/>
  <rect x="210" y="110" width="30" height="30" fill="#ffffff"/>
  <rect x="218" y="118" width="14" height="14" fill="#0f172a"/>
  <rect x="70" y="230" width="50" height="50" fill="#0f172a"/>
  <rect x="80" y="240" width="30" height="30" fill="#ffffff"/>
  <rect x="88" y="248" width="14" height="14" fill="#0f172a"/>
  <rect x="135" y="165" width="50" height="50" rx="6" fill="#dc2626"/>
  <text x="160" y="196" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">QR Ph</text>
  <text x="160" y="330" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">Upload official QR in Settings</text>
</svg>`);

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, name: 'Americano', category: 'iced_coffee', price: 60, active: 1 },
  { id: 2, name: 'Iced Latte', category: 'iced_coffee', price: 80, active: 1 },
  { id: 3, name: 'Vietnamese', category: 'iced_coffee', price: 95, active: 1 },
  { id: 4, name: 'Spanish Latte', category: 'iced_coffee', price: 95, active: 1 },
  { id: 5, name: 'Salted Caramel', category: 'iced_coffee', price: 95, active: 1 },
  { id: 6, name: 'Butterscotch', category: 'iced_coffee', price: 95, active: 1 },
  { id: 7, name: 'White Mocha', category: 'iced_coffee', price: 95, active: 1 },
  { id: 8, name: 'Lemon Sprite-Tea', category: 'non_coffee', price: 70, active: 1 },
  { id: 9, name: 'Milo Dinosaur', category: 'non_coffee', price: 85, active: 1 },
  { id: 10, name: 'Strawberry Milk', category: 'non_coffee', price: 90, active: 1 },
  { id: 11, name: 'Matcha Latte', category: 'non_coffee', price: 95, active: 1 },
  { id: 12, name: 'Milo Godzilla', category: 'non_coffee', price: 95, active: 1 },
  { id: 13, name: 'Beef Bulgogi', category: 'lunch_dinner', price: 169, active: 1 },
  { id: 14, name: 'Chicken Pastil w/ Egg', category: 'lunch_dinner', price: 80, active: 1 },
  { id: 15, name: 'Chicken Bulgogi', category: 'lunch_dinner', price: 169, active: 1 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Study Corner',
  branchName: 'Sta. Mesa / San Marcelino',
  address: '1943 Rd 5 Sta. Mesa / San Marcelino Ermita, Manila',
  openHour: DEFAULT_OPEN_HOUR,
  closeHour: DEFAULT_CLOSE_HOUR,
  membershipCardPrice: 100,
  qrPhImageUrl: DEFAULT_QR_SVG_DATA_URL,
  backupFolder: 'Browser LocalStorage + StudyCorner_Data/backups',
  tiers: DEFAULT_TIERS,
  plans: DEFAULT_PLANS,
};

export interface OfflineDatabaseState {
  version: number;
  lastUpdatedAt: string;
  lastServerSyncAt: string | null;
  settings: AppSettings;
  products: Product[];
  customers: Customer[];
  planSubs: PlanSub[];
  visits: Visit[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  shifts: ShiftRecord[];
  lanIps: string[];
  port: number;
  dataDir: string;
}

export interface OutboxMutation {
  id: string;
  createdAt: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

// Fallback memory store when running in Node tests without window.localStorage
const memoryStorage = new Map<string, string>();

function getRawStorage(key: string): string | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage.getItem(key);
    }
  } catch {
    // ignore storage errors
  }
  return memoryStorage.get(key) ?? null;
}

function setRawStorage(key: string, value: string): void {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore quota/private mode errors
  }
  memoryStorage.set(key, value);
}

export function createInitialOfflineState(): OfflineDatabaseState {
  return {
    version: 1,
    lastUpdatedAt: new Date().toISOString(),
    lastServerSyncAt: null,
    settings: { ...DEFAULT_SETTINGS, tiers: [...DEFAULT_TIERS], plans: [...DEFAULT_PLANS] },
    products: DEFAULT_PRODUCTS.map((p) => ({ ...p })),
    customers: [],
    planSubs: [],
    visits: [],
    sales: [],
    expenses: [],
    shifts: [],
    lanIps: [],
    port: 8787,
    dataDir: 'Browser LocalStorage (Offline Mode)',
  };
}

export function loadOfflineState(): OfflineDatabaseState {
  const raw = getRawStorage(STORAGE_KEY);
  if (!raw) {
    const initial = createInitialOfflineState();
    saveOfflineState(initial);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineDatabaseState>;
    return {
      ...createInitialOfflineState(),
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : DEFAULT_PRODUCTS,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      planSubs: Array.isArray(parsed.planSubs) ? parsed.planSubs : [],
      visits: Array.isArray(parsed.visits) ? parsed.visits : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
    };
  } catch {
    const initial = createInitialOfflineState();
    saveOfflineState(initial);
    return initial;
  }
}

export function saveOfflineState(state: OfflineDatabaseState): OfflineDatabaseState {
  state.lastUpdatedAt = new Date().toISOString();
  setRawStorage(STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function resetOfflineState(): OfflineDatabaseState {
  const fresh = createInitialOfflineState();
  saveOfflineState(fresh);
  setRawStorage(OUTBOX_KEY, JSON.stringify([]));
  return fresh;
}

// --- OUTBOX QUEUE ---
export function getOutboxQueue(): OutboxMutation[] {
  const raw = getRawStorage(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueOutboxMutation(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): OutboxMutation {
  const queue = getOutboxQueue();
  const item: OutboxMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    endpoint,
    method,
    body,
  };
  queue.push(item);
  setRawStorage(OUTBOX_KEY, JSON.stringify(queue));
  return item;
}

export function setOutboxQueue(queue: OutboxMutation[]): void {
  setRawStorage(OUTBOX_KEY, JSON.stringify(queue));
}

// --- SERVER MIRRORING ---
export function mergeServerBootstrap(data: BootstrapData): BootstrapData {
  const state = loadOfflineState();
  state.settings = data.settings;
  state.products = data.products;
  state.customers = data.customers;
  state.planSubs = data.planSubs;
  state.lanIps = data.lanIps || state.lanIps;
  state.port = data.port || state.port;
  state.dataDir = data.dataDir || state.dataDir;

  // Keep checked_out historical visits in local state, replace active visits with server activeVisits
  const inactiveVisits = state.visits.filter((v) => v.status !== 'active');
  state.visits = [...inactiveVisits, ...data.activeVisits];

  if (data.currentShift) {
    const idx = state.shifts.findIndex((s) => s.id === data.currentShift!.id);
    if (idx >= 0) {
      state.shifts[idx] = data.currentShift;
    } else {
      state.shifts.push(data.currentShift);
    }
  } else {
    state.shifts = state.shifts.map((s) =>
      s.closedAt === null ? { ...s, closedAt: new Date().toISOString() } : s
    );
  }

  state.lastServerSyncAt = new Date().toISOString();
  saveOfflineState(state);
  return getOfflineBootstrap();
}

export function mergeServerLedger(res: LedgerResponse): void {
  const state = loadOfflineState();
  // Merge sales by receiptNo
  const saleMap = new Map<string, SaleRecord>();
  for (const s of state.sales) saleMap.set(s.receiptNo, s);
  for (const s of res.sales) saleMap.set(s.receiptNo, s);
  state.sales = Array.from(saleMap.values()).sort((a, b) => b.id - a.id);

  // Merge expenses by id + createdAt
  const expMap = new Map<string, ExpenseRecord>();
  for (const e of state.expenses) expMap.set(`${e.createdAt}_${e.amount}_${e.category}`, e);
  for (const e of res.expenses) expMap.set(`${e.createdAt}_${e.amount}_${e.category}`, e);
  state.expenses = Array.from(expMap.values()).sort((a, b) => b.id - a.id);

  state.lastServerSyncAt = new Date().toISOString();
  saveOfflineState(state);
}

// --- OFFLINE POS OPERATIONS ---
function nextId<T extends { id: number }>(items: T[]): number {
  return items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

export function getOfflineCurrentShift(state: OfflineDatabaseState = loadOfflineState()): ShiftRecord | null {
  const openShifts = state.shifts.filter((s) => !s.closedAt);
  return openShifts.length > 0 ? openShifts[openShifts.length - 1] : null;
}

export function getOfflineBootstrap(): BootstrapData {
  const state = loadOfflineState();
  const activeVisits = state.visits
    .filter((v) => v.status === 'active')
    .sort((a, b) => a.timeIn.localeCompare(b.timeIn));

  return {
    settings: state.settings,
    products: [...state.products].sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    ),
    activeVisits,
    customers: [...state.customers].sort((a, b) => b.id - a.id),
    planSubs: [...state.planSubs].sort((a, b) => b.id - a.id),
    currentShift: getOfflineCurrentShift(state),
    lanIps: state.lanIps,
    port: state.port,
    dataDir: state.dataDir,
  };
}

export function offlineTimeIn(input: {
  customerId?: number | null;
  customerName: string;
  memberCardNo?: string | null;
  isMember?: boolean;
  planSubId?: number | null;
  notes?: string | null;
  timeInIso?: string;
  allowOutsideHours?: boolean;
}): Visit {
  const state = loadOfflineState();
  const nowIso = input.timeInIso ?? new Date().toISOString();
  const nowDate = new Date(nowIso);
  const hour = nowDate.getHours();

  if (!input.allowOutsideHours && (hour < state.settings.openHour || hour >= state.settings.closeHour)) {
    throw new Error(
      `Shop operating hours are ${state.settings.openHour}:00 to ${state.settings.closeHour}:00. Use override if needed.`
    );
  }

  let isMember = Boolean(input.isMember);
  let memberCardNo = input.memberCardNo ?? null;
  let planSubId = input.planSubId ?? null;

  if (input.customerId) {
    const cust = state.customers.find((c) => c.id === input.customerId);
    if (cust) {
      isMember = Boolean(cust.isMember);
      memberCardNo = cust.memberCardNo;
      if (!planSubId) {
        const todayYmd = nowIso.slice(0, 10);
        const activePlan = state.planSubs.find(
          (s) => s.customerId === cust.id && isPlanActiveOnDate(s, todayYmd)
        );
        if (activePlan) planSubId = activePlan.id;
      }
    }
  }

  const visit: Visit = {
    id: nextId(state.visits),
    customerId: input.customerId ?? null,
    customerName: input.customerName.trim(),
    memberCardNo,
    isMember: isMember ? 1 : 0,
    planSubId,
    timeIn: nowIso,
    timeOut: null,
    status: 'active',
    notes: input.notes ?? null,
    foodItems: [],
  };

  state.visits.push(visit);
  saveOfflineState(state);
  return visit;
}

export function offlineAddFoodToVisit(visitId: number, productId: number, qty: number): Visit {
  const state = loadOfflineState();
  const visit = state.visits.find((v) => v.id === visitId && v.status === 'active');
  if (!visit) throw new Error('Active visit not found');

  const product = state.products.find((p) => p.id === productId);
  if (!product) throw new Error('Product not found');

  const existingIdx = visit.foodItems.findIndex((f) => f.productId === productId);
  if (existingIdx >= 0) {
    const newQty = visit.foodItems[existingIdx].qty + qty;
    if (newQty <= 0) {
      visit.foodItems.splice(existingIdx, 1);
    } else {
      visit.foodItems[existingIdx] = {
        ...visit.foodItems[existingIdx],
        qty: newQty,
        amount: newQty * product.price,
      };
    }
  } else if (qty > 0) {
    const nextFoodId =
      visit.foodItems.reduce((max, f) => Math.max(max, f.id || 0), 0) + 1;
    visit.foodItems.push({
      id: nextFoodId,
      visitId: visit.id,
      productId: product.id,
      itemName: product.name,
      qty,
      unitPrice: product.price,
      amount: qty * product.price,
    });
  }

  saveOfflineState(state);
  return visit;
}

export function offlineRemoveFoodFromVisit(visitId: number, itemId: number): Visit {
  const state = loadOfflineState();
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) throw new Error('Visit not found');

  visit.foodItems = visit.foodItems.filter((f) => f.id !== itemId);
  saveOfflineState(state);
  return visit;
}

export function offlinePreviewCheckout(visitId: number, timeOutIso?: string) {
  const state = loadOfflineState();
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) throw new Error('Visit not found');

  const outIso = timeOutIso ?? new Date().toISOString();
  const minutesStayed = computeElapsedMinutes(visit.timeIn, outIso, state.settings.closeHour);
  const hasPlan = Boolean(visit.planSubId);
  const timeBill = computeTimeCharge(
    minutesStayed,
    Boolean(visit.isMember),
    hasPlan,
    state.settings.tiers
  );

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

export function offlineSaveCustomer(input: {
  id?: number;
  name: string;
  memberCardNo?: string | null;
  isMember?: boolean;
  phone?: string | null;
}): Customer {
  const state = loadOfflineState();
  const now = new Date().toISOString();

  if (input.id) {
    const existing = state.customers.find((c) => c.id === input.id);
    if (existing) {
      existing.name = input.name.trim();
      existing.memberCardNo = input.memberCardNo || null;
      existing.isMember = input.isMember ? 1 : 0;
      existing.phone = input.phone || null;
      saveOfflineState(state);
      return existing;
    }
  }

  const created: Customer = {
    id: nextId(state.customers),
    name: input.name.trim(),
    memberCardNo: input.memberCardNo || null,
    isMember: input.isMember ? 1 : 0,
    phone: input.phone || null,
    createdAt: now,
  };
  state.customers.push(created);
  saveOfflineState(state);
  return created;
}

export function offlineRecordSale(input: {
  visitId?: number;
  timeOutIso?: string;
  staffName: string;
  customerName: string;
  isMember: boolean;
  minutesStayed?: number;
  lines: SaleLine[];
  discount?: number;
  payments: PaymentInput[];
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

  let resolvedCustomerId = input.newMembership?.customerId ?? input.newPlan?.customerId;
  if (input.newMembership) {
    const cust = offlineSaveCustomer({
      id: input.newMembership.customerId,
      name: input.newMembership.customerName,
      memberCardNo: input.newMembership.memberCardNo,
      isMember: true,
      phone: input.newMembership.phone,
    });
    resolvedCustomerId = cust.id;
  }

  if (input.newPlan && !resolvedCustomerId) {
    const cust = offlineSaveCustomer({
      name: input.newPlan.customerName,
      isMember: input.newPlan.isMember,
    });
    resolvedCustomerId = cust.id;
  }

  const state = loadOfflineState();
  const nowIso = input.timeOutIso ?? new Date().toISOString();

  if (input.newPlan && resolvedCustomerId) {
    const endDate = computePlanEndDate(input.newPlan.startDate, input.newPlan.days);
    state.planSubs.push({
      id: nextId(state.planSubs),
      customerId: resolvedCustomerId,
      customerName: input.newPlan.customerName,
      planType: input.newPlan.planType,
      startDate: input.newPlan.startDate,
      endDate,
      price: input.newPlan.price,
      isMember: input.newPlan.isMember ? 1 : 0,
      active: 1,
    });
  }

  if (input.visitId) {
    const v = state.visits.find((vis) => vis.id === input.visitId);
    if (v) {
      v.timeOut = nowIso;
      v.status = 'checked_out';
    }
  }

  const saleId = nextId(state.sales);
  const seq = saleId.toString().padStart(5, '0');
  const ymd = nowIso.slice(0, 10).replace(/-/g, '');
  const receiptNo = `SC-${ymd}-${seq}`;

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

  state.sales.unshift(record);
  saveOfflineState(state);
  return record;
}

export function offlineAddExpense(input: {
  category: string;
  amount: number;
  method: 'cash' | 'card' | 'qrph' | 'bank';
  note: string;
  staffName: string;
  createdAt?: string;
}): ExpenseRecord {
  const state = loadOfflineState();
  const record: ExpenseRecord = {
    id: nextId(state.expenses),
    createdAt: input.createdAt ?? new Date().toISOString(),
    category: input.category,
    amount: input.amount,
    method: input.method,
    note: input.note ?? '',
    staffName: input.staffName,
  };
  state.expenses.unshift(record);
  saveOfflineState(state);
  return record;
}

export function offlineOpenShift(openedBy: string, openingCash: number, openedAt?: string): ShiftRecord {
  const state = loadOfflineState();
  const existing = getOfflineCurrentShift(state);
  if (existing) return existing;

  const shift: ShiftRecord = {
    id: nextId(state.shifts),
    openedAt: openedAt ?? new Date().toISOString(),
    closedAt: null,
    openedBy,
    closedBy: null,
    openingCash,
    countedCash: null,
    expectedCash: null,
    notes: null,
  };
  state.shifts.push(shift);
  saveOfflineState(state);
  return shift;
}

export function offlineCloseShift(
  closedBy: string,
  countedCash: number,
  notes?: string
): { shift: ShiftRecord; backupFile: string } {
  const state = loadOfflineState();
  const current = getOfflineCurrentShift(state);
  if (!current) throw new Error('No open shift');

  const now = new Date().toISOString();
  let cashSales = 0;
  for (const s of state.sales) {
    if (s.status === 'paid' && s.createdAt >= current.openedAt) {
      for (const p of s.payments) {
        if (p.method === 'cash') cashSales += p.amount;
      }
    }
  }

  let cashExpenses = 0;
  for (const e of state.expenses) {
    if (e.method === 'cash' && e.createdAt >= current.openedAt) {
      cashExpenses += e.amount;
    }
  }

  current.closedAt = now;
  current.closedBy = closedBy;
  current.countedCash = countedCash;
  current.expectedCash = current.openingCash + cashSales - cashExpenses;
  current.notes = notes ?? null;

  saveOfflineState(state);
  return {
    shift: current,
    backupFile: `localStorage_snapshot_${now.slice(0, 10)}.json`,
  };
}

export function offlineSaveProduct(input: {
  id?: number;
  name: string;
  category: string;
  price: number;
  active?: number;
}): Product {
  const state = loadOfflineState();
  if (input.id) {
    const existing = state.products.find((p) => p.id === input.id);
    if (existing) {
      existing.name = input.name;
      existing.category = input.category as Product['category'];
      existing.price = input.price;
      existing.active = input.active ?? 1;
      saveOfflineState(state);
      return existing;
    }
  }
  const prod: Product = {
    id: nextId(state.products),
    name: input.name,
    category: input.category as Product['category'],
    price: input.price,
    active: input.active ?? 1,
  };
  state.products.push(prod);
  saveOfflineState(state);
  return prod;
}

export function offlineSaveSettings(partial: Partial<AppSettings>): AppSettings {
  const state = loadOfflineState();
  state.settings = {
    ...state.settings,
    ...partial,
  };
  saveOfflineState(state);
  return state.settings;
}

export function offlineGetLedger(datePrefix?: string): LedgerResponse {
  const state = loadOfflineState();
  const prefix = datePrefix || new Date().toISOString().slice(0, 10);

  const sales = state.sales
    .filter((s) => s.status === 'paid' && s.createdAt.startsWith(prefix))
    .sort((a, b) => b.id - a.id);

  const expenses = state.expenses
    .filter((e) => e.createdAt.startsWith(prefix))
    .sort((a, b) => b.id - a.id);

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
    currentShift: getOfflineCurrentShift(state),
    csvFiles: [],
    backups: [],
  };
}

// --- CLIENT-SIDE CSV & BACKUP EXPORTS ---
function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvFromRecords(
  type: 'sales' | 'payments' | 'expenses',
  sales: SaleRecord[],
  expenses: ExpenseRecord[]
): string {
  if (type === 'sales') {
    const rows = [
      ['ReceiptNo', 'CreatedAt', 'Staff', 'Customer', 'IsMember', 'MinutesStayed', 'Subtotal', 'Discount', 'Total', 'Items'].join(','),
    ];
    for (const s of sales) {
      const itemsText = s.lines.map((l) => `${l.qty}x ${l.item} (${l.amount})`).join('; ');
      rows.push(
        [
          s.receiptNo,
          s.createdAt,
          s.staffName,
          s.customerName,
          s.isMember ? 'Yes' : 'No',
          s.minutesStayed,
          s.subtotal,
          s.discount,
          s.total,
          itemsText,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    return rows.join('\n');
  }

  if (type === 'payments') {
    const rows = [['ReceiptNo', 'CreatedAt', 'Customer', 'Method', 'Amount', 'Tendered', 'RefNo'].join(',')];
    for (const s of sales) {
      for (const p of s.payments) {
        rows.push(
          [
            s.receiptNo,
            s.createdAt,
            s.customerName,
            p.method,
            p.amount,
            p.tendered ?? p.amount,
            p.refNo ?? '',
          ]
            .map(csvEscape)
            .join(',')
        );
      }
    }
    return rows.join('\n');
  }

  const rows = [['Id', 'CreatedAt', 'Category', 'Amount', 'Method', 'Note', 'Staff'].join(',')];
  for (const e of expenses) {
    rows.push([e.id, e.createdAt, e.category, e.amount, e.method, e.note, e.staffName].map(csvEscape).join(','));
  }
  return rows.join('\n');
}

export function generateOfflineCsvContent(type: 'sales' | 'payments' | 'expenses', periodPrefix?: string): string {
  const state = loadOfflineState();
  const prefix = periodPrefix || new Date().toISOString().slice(0, 7);
  const filteredSales = state.sales.filter((x) => x.createdAt.startsWith(prefix));
  const filteredExpenses = state.expenses.filter((x) => x.createdAt.startsWith(prefix));
  return buildCsvFromRecords(type, filteredSales, filteredExpenses);
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;'): void {
  if (typeof document === 'undefined') return;
  const payload = mimeType.includes('text/csv') && !content.startsWith('\uFEFF') ? `\uFEFF${content}` : content;
  const a = document.createElement('a');
  a.style.display = 'none';

  try {
    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 3000);
  } catch {
    const dataUrl = `data:${mimeType},${encodeURIComponent(payload)}`;
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1000);
  }
}

export function downloadOfflineStateBackup(): string {
  const state = loadOfflineState();
  const outbox = getOutboxQueue();
  const payload = JSON.stringify({ state, outbox, exportedAt: new Date().toISOString() }, null, 2);
  const fileName = `StudyCorner_LocalBackup_${new Date().toISOString().slice(0, 10)}.json`;
  downloadTextFile(fileName, payload, 'application/json;charset=utf-8;');
  return fileName;
}

export function importOfflineStateBackup(jsonText: string): OfflineDatabaseState {
  const parsed = JSON.parse(jsonText);
  const nextState: OfflineDatabaseState = parsed.state ? parsed.state : parsed;
  if (!nextState || !nextState.settings || !Array.isArray(nextState.products)) {
    throw new Error('Invalid Study Corner backup file format');
  }
  saveOfflineState(nextState);
  return nextState;
}
