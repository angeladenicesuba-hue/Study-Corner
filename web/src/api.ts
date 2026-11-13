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
  downloadOfflineStateBackup,
  downloadTextFile,
  enqueueOutboxMutation,
  generateOfflineCsvContent,
  getOfflineBootstrap,
  getOfflineCurrentShift,
  getOutboxQueue,
  importOfflineStateBackup,
  loadOfflineState,
  mergeServerBootstrap,
  mergeServerLedger,
  offlineAddExpense,
  offlineAddFoodToVisit,
  offlineCloseShift,
  offlineGetLedger,
  offlineOpenShift,
  offlinePreviewCheckout,
  offlineRecordSale,
  offlineRemoveFoodFromVisit,
  offlineSaveCustomer,
  offlineSaveProduct,
  offlineSaveSettings,
  offlineTimeIn,
  setOutboxQueue,
} from './offlineStore';

export interface BootstrapData {
  settings: AppSettings;
  products: Product[];
  activeVisits: Visit[];
  customers: Customer[];
  planSubs: PlanSub[];
  currentShift: ShiftRecord | null;
  lanIps: string[];
  port: number;
  dataDir: string;
}

export interface LedgerResponse {
  period: string;
  grossSales: number;
  totalDiscounts: number;
  totalExpenses: number;
  netIncome: number;
  byCategory: { time: number; plan: number; membership: number; food: number };
  byPayment: { cash: number; card: number; qrph: number };
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
  currentShift: ShiftRecord | null;
  csvFiles: Array<{ name: string; month: string; relativePath: string; sizeBytes: number; updatedAt: string }>;
  backups: Array<{ fileName: string; filePath: string; sizeBytes: number; createdAt: string }>;
}

let serverReachable = true;

export function isServerOnline(): boolean {
  return serverReachable;
}

async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestServer<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, options);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & { isBusinessError?: boolean };
    err.isBusinessError = res.status >= 400 && res.status < 500;
    throw err;
  }
  serverReachable = true;
  return data as T;
}

export async function flushOutboxToServer(): Promise<number> {
  const queue = getOutboxQueue();
  if (queue.length === 0) return 0;

  const remaining = [...queue];
  let syncedCount = 0;

  while (remaining.length > 0) {
    const item = remaining[0];
    try {
      await fetchWithTimeout(item.endpoint, {
        method: item.method,
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      });
      remaining.shift();
      syncedCount++;
      setOutboxQueue(remaining);
    } catch {
      serverReachable = false;
      break;
    }
  }
  return syncedCount;
}

export const api = {
  getBootstrap: async (): Promise<BootstrapData> => {
    try {
      await flushOutboxToServer();
      const serverData = await requestServer<BootstrapData>('/api/bootstrap');
      return mergeServerBootstrap(serverData);
    } catch {
      serverReachable = false;
      return getOfflineBootstrap();
    }
  },

  timeIn: async (body: {
    customerId?: number | null;
    customerName: string;
    memberCardNo?: string | null;
    isMember?: boolean;
    planSubId?: number | null;
    notes?: string | null;
    allowOutsideHours?: boolean;
  }): Promise<Visit> => {
    try {
      const visit = await requestServer<Visit>('/api/visits/time-in', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // Keep localStorage in sync
      const state = loadOfflineState();
      state.visits = [...state.visits.filter((v) => v.id !== visit.id), visit];
      return visit;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const visit = offlineTimeIn(body);
      enqueueOutboxMutation('/api/visits/time-in', 'POST', body);
      return visit;
    }
  },

  addFoodToVisit: async (visitId: number, productId: number, qty: number): Promise<Visit> => {
    try {
      const visit = await requestServer<Visit>(`/api/visits/${visitId}/food`, {
        method: 'POST',
        body: JSON.stringify({ productId, qty }),
      });
      offlineAddFoodToVisit(visitId, productId, qty);
      return visit;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const visit = offlineAddFoodToVisit(visitId, productId, qty);
      enqueueOutboxMutation(`/api/visits/${visitId}/food`, 'POST', { productId, qty });
      return visit;
    }
  },

  removeFoodFromVisit: async (visitId: number, itemId: number): Promise<Visit> => {
    try {
      const visit = await requestServer<Visit>(`/api/visits/${visitId}/food/${itemId}`, {
        method: 'DELETE',
      });
      offlineRemoveFoodFromVisit(visitId, itemId);
      return visit;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const visit = offlineRemoveFoodFromVisit(visitId, itemId);
      enqueueOutboxMutation(`/api/visits/${visitId}/food/${itemId}`, 'DELETE');
      return visit;
    }
  },

  previewCheckout: async (visitId: number) => {
    try {
      return await requestServer<{
        visit: Visit;
        timeOutIso: string;
        minutesStayed: number;
        hoursBilled: number;
        tierLabel: string;
        timeCharge: number;
        lines: SaleLine[];
        subtotal: number;
      }>(`/api/visits/${visitId}/preview`);
    } catch {
      serverReachable = false;
      return offlinePreviewCheckout(visitId);
    }
  },

  recordSale: async (body: {
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
  }): Promise<SaleRecord> => {
    try {
      const sale = await requestServer<SaleRecord>('/api/sales', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      offlineRecordSale(body);
      return sale;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const sale = offlineRecordSale(body);
      enqueueOutboxMutation('/api/sales', 'POST', body);
      return sale;
    }
  },

  addExpense: async (body: {
    category: string;
    amount: number;
    method: 'cash' | 'card' | 'qrph' | 'bank';
    note: string;
    staffName: string;
  }): Promise<ExpenseRecord> => {
    try {
      const exp = await requestServer<ExpenseRecord>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      offlineAddExpense(body);
      return exp;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const exp = offlineAddExpense(body);
      enqueueOutboxMutation('/api/expenses', 'POST', body);
      return exp;
    }
  },

  getLedger: async (period?: string): Promise<LedgerResponse> => {
    try {
      await flushOutboxToServer();
      const res = await requestServer<LedgerResponse>(
        `/api/ledger${period ? `?period=${encodeURIComponent(period)}` : ''}`
      );
      mergeServerLedger(res);
      return res;
    } catch {
      serverReachable = false;
      return offlineGetLedger(period);
    }
  },

  openShift: async (openedBy: string, openingCash: number): Promise<ShiftRecord> => {
    try {
      const shift = await requestServer<ShiftRecord>('/api/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openedBy, openingCash }),
      });
      offlineOpenShift(openedBy, openingCash);
      return shift;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const shift = offlineOpenShift(openedBy, openingCash);
      enqueueOutboxMutation('/api/shifts/open', 'POST', { openedBy, openingCash });
      return shift;
    }
  },

  closeShift: async (
    closedBy: string,
    countedCash: number,
    notes?: string
  ): Promise<{ shift: ShiftRecord; backupFile: string }> => {
    try {
      const res = await requestServer<{ shift: ShiftRecord; backupFile: string }>('/api/shifts/close', {
        method: 'POST',
        body: JSON.stringify({ closedBy, countedCash, notes }),
      });
      try {
        offlineCloseShift(closedBy, countedCash, notes);
      } catch {
        // ignore if already closed locally
      }
      return res;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const res = offlineCloseShift(closedBy, countedCash, notes);
      enqueueOutboxMutation('/api/shifts/close', 'POST', { closedBy, countedCash, notes });
      return res;
    }
  },

  saveProduct: async (body: {
    id?: number;
    name: string;
    category: string;
    price: number;
    active?: number;
  }): Promise<Product> => {
    try {
      const prod = await requestServer<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      offlineSaveProduct(body);
      return prod;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const prod = offlineSaveProduct(body);
      enqueueOutboxMutation('/api/products', 'POST', body);
      return prod;
    }
  },

  saveCustomer: async (body: {
    id?: number;
    name: string;
    memberCardNo?: string | null;
    isMember?: boolean;
    phone?: string | null;
  }): Promise<Customer> => {
    try {
      const cust = await requestServer<Customer>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      offlineSaveCustomer(body);
      return cust;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const cust = offlineSaveCustomer(body);
      enqueueOutboxMutation('/api/customers', 'POST', body);
      return cust;
    }
  },

  saveSettings: async (body: Partial<AppSettings>): Promise<AppSettings> => {
    try {
      const updated = await requestServer<AppSettings>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      offlineSaveSettings(updated);
      return updated;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const updated = offlineSaveSettings(body);
      enqueueOutboxMutation('/api/settings', 'POST', body);
      return updated;
    }
  },

  uploadQrPh: async (dataUrl: string): Promise<AppSettings> => {
    try {
      const updated = await requestServer<AppSettings>('/api/settings/qrph', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      // Store DataURL in localStorage so it renders even when server is offline
      offlineSaveSettings({ ...updated, qrPhImageUrl: dataUrl });
      return updated;
    } catch (err: any) {
      if (err?.isBusinessError) throw err;
      serverReachable = false;
      const updated = offlineSaveSettings({ qrPhImageUrl: dataUrl });
      enqueueOutboxMutation('/api/settings/qrph', 'POST', { dataUrl });
      return updated;
    }
  },

  createBackup: async (): Promise<{ filePath: string; fileName: string; createdAt: string }> => {
    try {
      const res = await requestServer<{ filePath: string; fileName: string; createdAt: string }>(
        '/api/backups/create',
        { method: 'POST' }
      );
      downloadOfflineStateBackup();
      return res;
    } catch {
      serverReachable = false;
      const fileName = downloadOfflineStateBackup();
      return {
        filePath: 'Browser Downloads + localStorage',
        fileName,
        createdAt: new Date().toISOString(),
      };
    }
  },

  // Offline / Local Storage helpers for UI
  getOfflineStats: () => {
    const state = loadOfflineState();
    const outbox = getOutboxQueue();
    return {
      salesCount: state.sales.length,
      visitsCount: state.visits.filter((v) => v.status === 'active').length,
      customersCount: state.customers.length,
      expensesCount: state.expenses.length,
      pendingSyncCount: outbox.length,
      lastUpdatedAt: state.lastUpdatedAt,
      lastServerSyncAt: state.lastServerSyncAt,
      currentShift: getOfflineCurrentShift(state),
    };
  },

  downloadLocalCsv: (type: 'sales' | 'payments' | 'expenses', periodPrefix?: string) => {
    const prefix = periodPrefix || new Date().toISOString().slice(0, 7);
    const csv = generateOfflineCsvContent(type, prefix);
    downloadTextFile(`${type}_${prefix}.csv`, csv);
  },

  exportLocalBackup: () => downloadOfflineStateBackup(),

  importLocalBackup: (jsonText: string) => importOfflineStateBackup(jsonText),

  syncNow: async () => {
    const count = await flushOutboxToServer();
    await api.getBootstrap();
    return count;
  },
};
