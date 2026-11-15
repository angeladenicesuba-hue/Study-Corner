import React, { useMemo, useState } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { formatPeso } from '@shared/billing';
import { LedgerResponse } from '../api';

interface LedgerChartsProps {
  data: LedgerResponse;
}

interface BucketPoint {
  key: string;
  label: string;
  shortLabel: string;
  sales: number;
  expenses: number;
  count: number;
}

function formatHourShort(hour: number): string {
  if (hour === 12) return '12p';
  if (hour > 12) return `${hour - 12}p`;
  return `${hour}a`;
}

function formatHourRange(hour: number): string {
  const start = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  return start;
}

export const LedgerCharts: React.FC<LedgerChartsProps> = ({ data }) => {
  const isMonth = data.period.length === 7;
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const buckets: BucketPoint[] = useMemo(() => {
    if (!isMonth) {
      // Single day: 8 AM to 9 PM operating hours (expand if override sales exist outside)
      let minHour = 8;
      let maxHour = 21;
      for (const s of data.sales) {
        const h = new Date(s.createdAt).getHours();
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
      for (const e of data.expenses) {
        const h = new Date(e.createdAt).getHours();
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }

      const map = new Map<number, BucketPoint>();
      for (let h = minHour; h <= maxHour; h++) {
        map.set(h, {
          key: String(h),
          label: formatHourRange(h),
          shortLabel: formatHourShort(h),
          sales: 0,
          expenses: 0,
          count: 0,
        });
      }

      for (const s of data.sales) {
        const h = new Date(s.createdAt).getHours();
        const pt = map.get(h);
        if (pt) {
          pt.sales += s.total;
          pt.count += 1;
        }
      }
      for (const e of data.expenses) {
        const h = new Date(e.createdAt).getHours();
        const pt = map.get(h);
        if (pt) {
          pt.expenses += e.amount;
        }
      }

      return Array.from(map.values());
    }

    // Month view: days 01..daysInMonth
    const [yearStr, monthStr] = data.period.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const month = Number(monthStr) || new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const map = new Map<number, BucketPoint>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      map.set(d, {
        key: dd,
        label: `${data.period}-${dd}`,
        shortLabel: d === 1 || d % 5 === 0 || d === daysInMonth ? String(d) : '',
        sales: 0,
        expenses: 0,
        count: 0,
      });
    }

    for (const s of data.sales) {
      const d = new Date(s.createdAt).getDate();
      const pt = map.get(d);
      if (pt) {
        pt.sales += s.total;
        pt.count += 1;
      }
    }
    for (const e of data.expenses) {
      const d = new Date(e.createdAt).getDate();
      const pt = map.get(d);
      if (pt) {
        pt.expenses += e.amount;
      }
    }

    return Array.from(map.values());
  }, [data.period, data.sales, data.expenses, isMonth]);

  const maxBucketValue = useMemo(() => {
    let max = 0;
    for (const b of buckets) {
      if (b.sales > max) max = b.sales;
      if (b.expenses > max) max = b.expenses;
    }
    return max;
  }, [buckets]);

  const peakBucket = useMemo(() => {
    let best: BucketPoint | null = null;
    for (const b of buckets) {
      if (!best || b.sales > best.sales) best = b;
    }
    return best && best.sales > 0 ? best : null;
  }, [buckets]);

  const selectedBucket =
    (activeKey ? buckets.find((b) => b.key === activeKey) : null) || peakBucket;

  // Revenue Mix (Green Screen Palette)
  const plansAndMember = data.byCategory.plan + data.byCategory.membership;
  const categoryItems = [
    { label: 'Study Time', amount: data.byCategory.time, color: '#1F4B2C', dotClass: 'bg-[#1F4B2C]' },
    { label: 'Food & Drinks', amount: data.byCategory.food, color: '#4D7111', dotClass: 'bg-[#4D7111]' },
    { label: 'Plans & Cards', amount: plansAndMember, color: '#91EAAF', dotClass: 'bg-[#91EAAF]' },
  ];
  const categoryTotal = categoryItems.reduce((sum, item) => sum + item.amount, 0);

  // Payment Methods Donut (Green Screen Palette)
  const paymentItems = [
    { label: 'Cash', amount: data.byPayment.cash, color: '#1F4B2C', dotClass: 'bg-[#1F4B2C]' },
    { label: 'QR Ph', amount: data.byPayment.qrph, color: '#4D7111', dotClass: 'bg-[#4D7111]' },
    { label: 'Card', amount: data.byPayment.card, color: '#C3E956', dotClass: 'bg-[#C3E956]' },
  ];
  const paymentTotal = paymentItems.reduce((sum, item) => sum + item.amount, 0);

  // Expense Categories (top 4)
  const expenseCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const ex of data.expenses) {
      totals.set(ex.category, (totals.get(ex.category) || 0) + ex.amount);
    }
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [data.expenses]);

  // SVG Donut geometry
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let runningOffset = 0;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Left: Sales & Expense Trend Bar Chart */}
      <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isMonth ? 'Daily Sales vs. Expenses' : 'Hourly Sales Activity'}
            </h3>
          </div>

          {selectedBucket && (
            <div className="text-right text-xs tabular-nums">
              <span className="font-semibold text-slate-600">
                {activeKey ? selectedBucket.label : `Peak (${selectedBucket.label})`}:{' '}
              </span>
              <span className="font-bold text-blue-700">{formatPeso(selectedBucket.sales)}</span>
              {selectedBucket.count > 0 && (
                <span className="text-slate-500"> ({selectedBucket.count})</span>
              )}
              {selectedBucket.expenses > 0 && (
                <span className="ml-2 font-semibold text-red-700">
                  −{formatPeso(selectedBucket.expenses)}
                </span>
              )}
            </div>
          )}
        </div>

        {maxBucketValue === 0 ? (
          <div className="my-auto flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-xs text-slate-500">
            No sales or expense activity recorded for {data.period}.
          </div>
        ) : (
          <div className="mt-4">
            <div
              className="flex h-44 items-end gap-1 sm:gap-1.5 border-b border-slate-200 pb-2"
              role="img"
              aria-label={isMonth ? 'Daily sales and expenses bar chart' : 'Hourly sales bar chart'}
            >
              {buckets.map((b) => {
                const salesHeightPct = Math.max(
                  b.sales > 0 ? 6 : 0,
                  Math.round((b.sales / maxBucketValue) * 100)
                );
                const expHeightPct = Math.max(
                  b.expenses > 0 ? 6 : 0,
                  Math.round((b.expenses / maxBucketValue) * 100)
                );
                const isSelected = activeKey === b.key;

                return (
                  <button
                    key={b.key}
                    type="button"
                    onMouseEnter={() => setActiveKey(b.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onFocus={() => setActiveKey(b.key)}
                    onClick={() => setActiveKey(isSelected ? null : b.key)}
                    title={`${b.label}: Sales ${formatPeso(b.sales)}${
                      b.expenses > 0 ? ` · Expenses ${formatPeso(b.expenses)}` : ''
                    }`}
                    className={`group flex h-full flex-1 items-end justify-center gap-0.5 rounded-t px-0.5 transition focus:outline-none ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      style={{ height: `${salesHeightPct}%` }}
                      className={`w-full max-w-[14px] rounded-t transition-all ${
                        b.sales > 0
                          ? isSelected
                            ? 'bg-blue-700'
                            : 'bg-blue-600 group-hover:bg-blue-700'
                          : 'bg-slate-100'
                      }`}
                    />
                    {b.expenses > 0 && (
                      <span
                        style={{ height: `${expHeightPct}%` }}
                        className="w-full max-w-[10px] rounded-t bg-red-500/85 transition-all"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="mt-1.5 flex items-center gap-1 sm:gap-1.5 text-[10px] font-medium text-slate-500 tabular-nums">
              {buckets.map((b) => (
                <div key={b.key} className="flex-1 text-center truncate">
                  {b.shortLabel}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                  Sales
                </span>
                {data.totalExpenses > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Expenses
                  </span>
                )}
              </div>
              <span className="text-slate-500">Hover or tap bars for details</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Revenue Mix & Payment Split */}
      <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-5">
        {/* Revenue Mix Stacked Bar */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Revenue Mix</h3>
            <span className="text-xs font-bold text-slate-700 tabular-nums">
              {formatPeso(categoryTotal)}
            </span>
          </div>

          <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {categoryTotal > 0 &&
              categoryItems.map((item) => {
                const pct = (item.amount / categoryTotal) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={item.label}
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                    title={`${item.label}: ${formatPeso(item.amount)} (${Math.round(pct)}%)`}
                    className="h-full transition-all"
                  />
                );
              })}
          </div>

          <div className="mt-3 space-y-1.5 text-xs tabular-nums">
            {categoryItems.map((item) => {
              const pct = categoryTotal > 0 ? Math.round((item.amount / categoryTotal) * 100) : 0;
              return (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatPeso(item.amount)}{' '}
                    <span className="font-medium text-slate-500">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method Donut */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Payment Methods</h3>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-label="Payment method split">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="#E3F9EE"
                  strokeWidth="12"
                />
                {paymentTotal > 0 &&
                  paymentItems.map((item) => {
                    const frac = item.amount / paymentTotal;
                    const dash = frac * circumference;
                    const offset = runningOffset;
                    runningOffset += dash;
                    if (dash <= 0) return null;
                    return (
                      <circle
                        key={item.label}
                        cx="48"
                        cy="48"
                        r={radius}
                        fill="none"
                        stroke={item.color}
                        strokeWidth="12"
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={-offset}
                      />
                    );
                  })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
                <span className="text-[10px] font-semibold text-slate-500">Paid</span>
                <span className="text-xs font-extrabold text-slate-900">
                  {formatPeso(paymentTotal)}
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs tabular-nums">
              {paymentItems.map((item) => {
                const pct = paymentTotal > 0 ? Math.round((item.amount / paymentTotal) * 100) : 0;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-slate-700">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                      <span>{item.label}</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatPeso(item.amount)}{' '}
                      <span className="font-medium text-slate-500">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Expense Breakdown (shown only when expenses exist) */}
        {expenseCategories.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800">Top Expenses</h3>
              <span className="text-xs font-bold text-red-700 tabular-nums">
                {formatPeso(data.totalExpenses)}
              </span>
            </div>
            <div className="space-y-2 text-xs tabular-nums">
              {expenseCategories.map((ex) => {
                const pct =
                  data.totalExpenses > 0 ? Math.round((ex.amount / data.totalExpenses) * 100) : 0;
                return (
                  <div key={ex.category}>
                    <div className="flex justify-between text-slate-700 mb-0.5">
                      <span className="truncate pr-2">{ex.category}</span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {formatPeso(ex.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-red-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
