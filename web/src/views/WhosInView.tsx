import React, { useEffect, useState } from 'react';
import {
  Users,
  LogOut,
  Plus,
  Trash2,
  Award,
  CheckCircle2,
  Clock,
  Utensils,
} from 'lucide-react';
import { AppSettings, PaymentInput, Product, SaleLine, SaleRecord, Visit } from '@shared/types';
import { computeElapsedMinutes, computeTimeCharge, formatPeso } from '@shared/billing';
import { api } from '../api';
import { PaymentModal } from '../components/PaymentModal';

interface WhosInViewProps {
  visits: Visit[];
  products: Product[];
  settings: AppSettings;
  staffName: string;
  onRefresh: () => void;
  onSaleCompleted: (sale: SaleRecord) => void;
  onGoTimeIn: () => void;
}

export const WhosInView: React.FC<WhosInViewProps> = ({
  visits,
  products,
  settings,
  staffName,
  onRefresh,
  onSaleCompleted,
  onGoTimeIn,
}) => {
  const [nowIso, setNowIso] = useState<string>(() => new Date().toISOString());
  const [foodDrawerVisitId, setFoodDrawerVisitId] = useState<number | null>(null);
  const [checkoutPreview, setCheckoutPreview] = useState<{
    visit: Visit;
    timeOutIso: string;
    minutesStayed: number;
    lines: SaleLine[];
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowIso(new Date().toISOString()), 15000);
    return () => clearInterval(timer);
  }, []);

  const handleAddFood = async (visitId: number, productId: number) => {
    await api.addFoodToVisit(visitId, productId, 1);
    onRefresh();
  };

  const handleRemoveFood = async (visitId: number, itemId: number) => {
    await api.removeFoodFromVisit(visitId, itemId);
    onRefresh();
  };

  const handleStartCheckout = async (visitId: number) => {
    const preview = await api.previewCheckout(visitId);
    setCheckoutPreview({
      visit: preview.visit,
      timeOutIso: preview.timeOutIso,
      minutesStayed: preview.minutesStayed,
      lines: preview.lines,
    });
  };

  const handleConfirmPayment = async (payments: PaymentInput[], discount: number) => {
    if (!checkoutPreview) return;
    const sale = await api.recordSale({
      visitId: checkoutPreview.visit.id,
      timeOutIso: checkoutPreview.timeOutIso,
      staffName,
      customerName: checkoutPreview.visit.customerName,
      isMember: Boolean(checkoutPreview.visit.isMember),
      minutesStayed: checkoutPreview.minutesStayed,
      lines: checkoutPreview.lines,
      discount,
      payments,
    });
    setCheckoutPreview(null);
    onSaleCompleted(sale);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  };

  if (visits.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">No Active Sessions</h2>
        <p className="mt-1 text-sm text-slate-600">
          Check in a student when they arrive to start their post-pay timer.
        </p>
        <button
          onClick={onGoTimeIn}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700"
        >
          <Clock className="h-4 w-4" />
          Time In Customer
        </button>
      </div>
    );
  }

  const activeProducts = products.filter((p) => p.active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Who's In <span className="text-slate-600 font-semibold tabular-nums">({visits.length})</span>
        </h2>
        <button
          onClick={onGoTimeIn}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.2)] hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Time In
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visits.map((v) => {
          const mins = computeElapsedMinutes(v.timeIn, nowIso, settings.closeHour);
          const timeBill = computeTimeCharge(mins, Boolean(v.isMember), Boolean(v.planSubId), settings.tiers);
          const foodTotal = v.foodItems.reduce((s, f) => s + f.amount, 0);
          const runningTotal = timeBill.amount + foodTotal;
          const isFoodOpen = foodDrawerVisitId === v.id;

          return (
            <div
              key={v.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
            >
              <div>
                {/* Customer Identity & Status Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{v.customerName}</h3>
                    <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
                      In {new Date(v.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {v.notes ? ` · ${v.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {Boolean(v.isMember) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                        <Award className="h-3.5 w-3.5" /> Member
                      </span>
                    )}
                    {Boolean(v.planSubId) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Plan
                      </span>
                    )}
                  </div>
                </div>

                {/* Flat Duration & Running Total Row */}
                <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3.5 tabular-nums">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{formatDuration(mins)}</div>
                    <div className="text-xs text-slate-600">{timeBill.tierLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-blue-700">{formatPeso(runningTotal)}</div>
                    {foodTotal > 0 && (
                      <div className="text-xs text-slate-600">
                        Time {formatPeso(timeBill.amount)} + Food {formatPeso(foodTotal)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ordered Food Items */}
                {v.foodItems.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
                    {v.foodItems.map((f) => (
                      <li key={f.id} className="flex items-center justify-between py-1.5 text-slate-800">
                        <span>
                          <span className="font-semibold tabular-nums">{f.qty}×</span> {f.itemName}
                        </span>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="font-semibold text-slate-900">{formatPeso(f.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFood(v.id, f.id)}
                            className="rounded p-0.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            title={`Remove ${f.itemName}`}
                            aria-label={`Remove ${f.itemName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Inline Quick Add Food Picker */}
                {isFoodOpen && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Add to tab</span>
                      <button
                        type="button"
                        onClick={() => setFoodDrawerVisitId(null)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Done
                      </button>
                    </div>
                    <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                      {activeProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddFood(v.id, p.id)}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-left text-xs hover:border-blue-500 hover:bg-blue-50"
                        >
                          <span className="font-medium text-slate-900 truncate pr-1">{p.name}</span>
                          <span className="shrink-0 font-bold text-blue-700 tabular-nums">{formatPeso(p.price)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => setFoodDrawerVisitId(isFoodOpen ? null : v.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold transition ${
                    isFoodOpen
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5" />
                  <span>{isFoodOpen ? 'Close Menu' : '+ Food'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCheckout(v.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white shadow-[0_2px_6px_rgba(5,150,105,0.2)] hover:bg-emerald-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Time Out & Pay</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {checkoutPreview && (
        <PaymentModal
          title="Time Out & Checkout"
          customerName={checkoutPreview.visit.customerName}
          isMember={Boolean(checkoutPreview.visit.isMember)}
          lines={checkoutPreview.lines}
          qrPhImageUrl={settings.qrPhImageUrl}
          onCancel={() => setCheckoutPreview(null)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
};
