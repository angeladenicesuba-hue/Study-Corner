import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  Download,
  Lock,
  Unlock,
  ChevronDown,
} from 'lucide-react';
import { formatPeso } from '@shared/billing';
import { api, LedgerResponse } from '../api';

interface LedgerViewProps {
  staffName: string;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ staffName }) => {
  const [period, setPeriod] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePanel, setActivePanel] = useState<'none' | 'expense' | 'shift'>('none');
  const [tableTab, setTableTab] = useState<'sales' | 'expenses'>('sales');

  // Expense form
  const [expCategory, setExpCategory] = useState<string>('Food & Drink Supplies');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expMethod, setExpMethod] = useState<'cash' | 'qrph' | 'card' | 'bank'>('cash');
  const [expNote, setExpNote] = useState<string>('');

  // Shift form
  const [openingCash, setOpeningCash] = useState<string>('1000');
  const [countedCash, setCountedCash] = useState<string>('');
  const [shiftBanner, setShiftBanner] = useState<string>('');

  const loadLedger = async (targetPeriod = period) => {
    setLoading(true);
    try {
      const res = await api.getLedger(targetPeriod);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger(period);
  }, [period]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount) || 0;
    if (amt <= 0) return;
    await api.addExpense({
      category: expCategory,
      amount: amt,
      method: expMethod,
      note: expNote.trim(),
      staffName,
    });
    setExpAmount('');
    setExpNote('');
    setActivePanel('none');
    setTableTab('expenses');
    loadLedger(period);
  };

  const handleOpenShift = async () => {
    await api.openShift(staffName, Number(openingCash) || 0);
    setShiftBanner('Shift opened.');
    loadLedger(period);
  };

  const handleCloseShift = async () => {
    const res = await api.closeShift(staffName, Number(countedCash) || 0);
    setShiftBanner(
      `Shift closed. Expected: ${formatPeso(res.shift.expectedCash || 0)}, Counted: ${formatPeso(
        res.shift.countedCash || 0
      )}. Backup saved (${res.backupFile}).`
    );
    setCountedCash('');
    loadLedger(period);
  };

  const todayYmd = new Date().toISOString().slice(0, 10);
  const currentMonthYm = todayYmd.slice(0, 7);

  return (
    <div className="space-y-5">
      {/* Top Controls: Period Filter + Quick Actions + CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPeriod(todayYmd)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              period === todayYmd
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setPeriod(currentMonthYm)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              period === currentMonthYm
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            This Month
          </button>
          <input
            type="date"
            aria-label="Select Date"
            value={period.length === 10 ? period : todayYmd}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 tabular-nums"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'expense' ? 'none' : 'expense')}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              activePanel === 'expense'
                ? 'border-red-600 bg-red-50 text-red-900'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5 text-red-600" />
            <span>Record Expense</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'shift' ? 'none' : 'shift')}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              activePanel === 'shift'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {data?.currentShift ? (
              <>
                <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Shift Open</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                <span>Shift Closed</span>
              </>
            )}
          </button>

          {/* Compact CSV Export Dropdown */}
          <details className="relative group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50">
              <Download className="h-3.5 w-3.5 text-emerald-700" />
              <span>Export CSV</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </summary>
            <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg divide-y divide-slate-100 text-xs">
              <div className="pb-1">
                <button
                  type="button"
                  onClick={() => api.downloadLocalCsv('sales', period.slice(0, 7))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <span>Sales CSV</span>
                  <span className="text-slate-500 tabular-nums">{period.slice(0, 7)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => api.downloadLocalCsv('payments', period.slice(0, 7))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <span>Payments CSV</span>
                  <span className="text-slate-500 tabular-nums">{period.slice(0, 7)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => api.downloadLocalCsv('expenses', period.slice(0, 7))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <span>Expenses CSV</span>
                  <span className="text-slate-500 tabular-nums">{period.slice(0, 7)}</span>
                </button>
              </div>
              {data && data.csvFiles.length > 0 && (
                <div className="pt-1">
                  {data.csvFiles.slice(0, 3).map((f) => (
                    <a
                      key={f.relativePath}
                      href={`/api/csv/download/${f.relativePath}`}
                      download
                      className="block truncate rounded-lg px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Hub: {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Collapsible Action Drawer: Record Expense */}
      {activePanel === 'expense' && (
        <form
          onSubmit={handleAddExpense}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Record Shop Expense</h3>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-semibold text-slate-600 hover:underline"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="exp-cat" className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                id="exp-cat"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option>Food & Drink Supplies</option>
                <option>Coffee / Milk / Ice</option>
                <option>Electricity (Meralco)</option>
                <option>Water (Maynilad)</option>
                <option>Internet / Wi-Fi</option>
                <option>Rent</option>
                <option>Staff Wages / Allowance</option>
                <option>Cleaning & Pantry Supplies</option>
                <option>Other Expense</option>
              </select>
            </div>
            <div>
              <label htmlFor="exp-amt" className="block text-xs font-semibold text-slate-700">
                Amount (₱)
              </label>
              <input
                id="exp-amt"
                type="number"
                required
                min={1}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="e.g. 450"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="exp-method" className="block text-xs font-semibold text-slate-700">
                Paid From
              </label>
              <select
                id="exp-method"
                value={expMethod}
                onChange={(e) => setExpMethod(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option value="cash">Cash Drawer</option>
                <option value="qrph">GCash / Maya (QR Ph)</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label htmlFor="exp-note" className="block text-xs font-semibold text-slate-700">
                Particulars
              </label>
              <input
                id="exp-note"
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder="e.g. 2 bags of ice + milk"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              Save Expense
            </button>
          </div>
        </form>
      )}

      {/* Collapsible Action Drawer: Shift Drawer Control */}
      {activePanel === 'shift' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Shift & Cash Drawer</h3>
              <p className="text-xs text-slate-600">
                Closing a shift reconciles physical drawer cash and saves a backup file.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-semibold text-slate-600 hover:underline"
            >
              Close
            </button>
          </div>

          {shiftBanner && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-950">
              {shiftBanner}
            </div>
          )}

          {data?.currentShift ? (
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-3 tabular-nums">
              <div className="text-xs text-slate-700 space-y-1">
                <div>
                  Opened: <span className="font-bold text-slate-900">{new Date(data.currentShift.openedAt).toLocaleString()}</span>
                </div>
                <div>
                  Starting Cash: <span className="font-bold text-slate-900">{formatPeso(data.currentShift.openingCash)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2.5">
                <div>
                  <label htmlFor="counted-cash" className="block text-xs font-semibold text-slate-700">
                    Counted Drawer Cash (₱)
                  </label>
                  <input
                    id="counted-cash"
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="Physical count"
                    className="mt-1 w-44 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCloseShift}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Close Shift & Backup
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 tabular-nums">
              <div>
                <label htmlFor="opening-cash" className="block text-xs font-semibold text-slate-700">
                  Starting Drawer Cash (₱)
                </label>
                <input
                  id="opening-cash"
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="mt-1 w-44 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenShift}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Open Shift
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unified Financial Summary Strip (No Hero-Metric Card Grid) */}
      {data && (
        <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] lg:grid-cols-4 lg:divide-y-0 lg:divide-x tabular-nums">
          <div className="p-5">
            <div className="text-xs font-semibold text-slate-600">Gross Sales ({data.period})</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatPeso(data.grossSales)}</div>
            <div className="mt-1.5 text-xs text-slate-600">
              Time {formatPeso(data.byCategory.time)} · Food {formatPeso(data.byCategory.food)} · Plans{' '}
              {formatPeso(data.byCategory.plan + data.byCategory.membership)}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-semibold text-slate-600">By Payment Method</div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Cash</span>
                <span className="font-bold text-slate-900">{formatPeso(data.byPayment.cash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">QR Ph</span>
                <span className="font-bold text-blue-700">{formatPeso(data.byPayment.qrph)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Card</span>
                <span className="font-bold text-slate-900">{formatPeso(data.byPayment.card)}</span>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs font-semibold text-slate-600">Expenses</div>
            <div className="mt-1 text-2xl font-extrabold text-red-700">{formatPeso(data.totalExpenses)}</div>
            <div className="mt-1.5 text-xs text-slate-600">{data.expenses.length} recorded</div>
          </div>

          <div className="p-5">
            <div className="text-xs font-semibold text-slate-600">Net Cashflow</div>
            <div
              className={`mt-1 text-2xl font-extrabold ${
                data.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatPeso(data.netIncome)}
            </div>
            <div className="mt-1.5 text-xs text-slate-600">Sales minus expenses</div>
          </div>
        </div>
      )}

      {/* Transactions Log (Sales & Expenses Switcher) */}
      {!loading && data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTableTab('sales')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition tabular-nums ${
                  tableTab === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sales ({data.sales.length})
              </button>
              <button
                type="button"
                onClick={() => setTableTab('expenses')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition tabular-nums ${
                  tableTab === 'expenses' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expenses ({data.expenses.length})
              </button>
            </div>
          </div>

          {tableTab === 'sales' ? (
            data.sales.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-600">
                No sales recorded for {data.period}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2 pr-3 font-semibold">Receipt</th>
                      <th className="py-2 pr-3 font-semibold">Time</th>
                      <th className="py-2 pr-3 font-semibold">Customer</th>
                      <th className="py-2 pr-3 font-semibold">Items</th>
                      <th className="py-2 pr-3 font-semibold">Method</th>
                      <th className="py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{s.receiptNo}</td>
                        <td className="py-2.5 pr-3 text-slate-600">
                          {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">
                          {s.customerName}
                          {s.isMember ? (
                            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                              Member
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700">
                          {s.lines.map((l) => `${l.qty}× ${l.item}`).join(', ')}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-700">
                          {s.payments.map((p) => p.method.toUpperCase()).join(' + ')}
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-slate-900">{formatPeso(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : data.expenses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-600">
              No expenses recorded for {data.period}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 font-semibold">Time</th>
                    <th className="py-2 pr-3 font-semibold">Category</th>
                    <th className="py-2 pr-3 font-semibold">Particulars</th>
                    <th className="py-2 pr-3 font-semibold">Paid From</th>
                    <th className="py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.expenses.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 text-slate-600">
                        {new Date(ex.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">{ex.category}</td>
                      <td className="py-2.5 pr-3 text-slate-700">{ex.note || '—'}</td>
                      <td className="py-2.5 pr-3 uppercase font-medium text-slate-700">{ex.method}</td>
                      <td className="py-2.5 text-right font-extrabold text-red-700">{formatPeso(ex.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
