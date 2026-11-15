import React, { useEffect, useState } from 'react';
import {
  Users,
  LogOut,
  Trash2,
  Award,
  CheckCircle2,
  Clock,
  Utensils,
  UserCheck,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import {
  AppSettings,
  Customer,
  PaymentInput,
  PlanSub,
  Product,
  SaleLine,
  SaleRecord,
  Visit,
} from '@shared/types';
import {
  computeElapsedMinutes,
  computeTimeCharge,
  formatPeso,
  isPlanActiveOnDate,
  isWithinOperatingHours,
} from '@shared/billing';
import { api } from '../api';
import { PaymentModal } from '../components/PaymentModal';

interface WhosInViewProps {
  visits: Visit[];
  products: Product[];
  settings: AppSettings;
  customers: Customer[];
  planSubs: PlanSub[];
  staffName: string;
  onRefresh: () => void;
  onSaleCompleted: (sale: SaleRecord) => void;
  onGoTimeIn?: () => void;
  hideHeader?: boolean;
}

export const WhosInView: React.FC<WhosInViewProps> = ({
  visits,
  products,
  settings,
  customers,
  planSubs,
  staffName,
  onRefresh,
  onSaleCompleted,
}) => {
  const [nowIso, setNowIso] = useState<string>(() => new Date().toISOString());
  const [foodDrawerVisitId, setFoodDrawerVisitId] = useState<number | null>(null);
  const [checkoutPreview, setCheckoutPreview] = useState<{
    visit: Visit;
    timeOutIso: string;
    minutesStayed: number;
    lines: SaleLine[];
  } | null>(null);

  // Inline Quick Time-In state
  const [customerName, setCustomerName] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [memberCardNo, setMemberCardNo] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allowOutsideHours, setAllowOutsideHours] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeInError, setTimeInError] = useState('');

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

  const now = new Date();
  const todayYmd = now.toISOString().slice(0, 10);
  const withinHours = isWithinOperatingHours(now, settings.openHour, settings.closeHour);
  const query = customerName.trim().toLowerCase();
  const matchingCustomers =
    showSuggestions && query.length > 0 && selectedCustomerId === null
      ? customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              (c.memberCardNo && c.memberCardNo.toLowerCase().includes(query))
          )
          .slice(0, 6)
      : [];

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setIsMember(Boolean(c.isMember));
    setMemberCardNo(c.memberCardNo || '');
    setShowSuggestions(false);

    const activePlan = planSubs.find(
      (p) => p.customerId === c.id && isPlanActiveOnDate(p, todayYmd)
    );
    setSelectedPlanId(activePlan ? activePlan.id : null);
  };

  const handleQuickTimeIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setTimeInError('Enter the customer name to start a session.');
      return;
    }
    setTimeInError('');
    setSubmitting(true);
    try {
      await api.timeIn({
        customerId: selectedCustomerId,
        customerName: customerName.trim(),
        isMember,
        memberCardNo: memberCardNo.trim() || null,
        planSubId: selectedPlanId,
        notes: notes.trim() || null,
        allowOutsideHours: !withinHours ? allowOutsideHours : true,
      });
      setCustomerName('');
      setIsMember(false);
      setMemberCardNo('');
      setSelectedCustomerId(null);
      setSelectedPlanId(null);
      setNotes('');
      setShowDetails(false);
      onRefresh();
    } catch (err: any) {
      setTimeInError(err?.message || 'Could not start study session.');
    } finally {
      setSubmitting(false);
    }
  };

  const baseNonMember = settings.tiers[0]?.nonMember ?? 80;
  const baseMember = settings.tiers[0]?.member ?? 70;
  const activeProducts = products.filter((p) => p.active);

  const quickTimeInBar = (
    <form
      onSubmit={handleQuickTimeIn}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-3"
    >
      {!withinHours && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            Outside hours ({settings.openHour}:00 AM – {settings.closeHour - 12}:00 PM)
          </span>
          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={allowOutsideHours}
              onChange={(e) => setAllowOutsideHours(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-amber-400"
            />
            Allow Override
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Name / Card Autocomplete Input */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            id="quick-timein-name"
            type="text"
            autoComplete="off"
            value={customerName}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setSelectedCustomerId(null);
              setSelectedPlanId(null);
              setShowSuggestions(true);
            }}
            placeholder="Quick Time In: student name or card # (e.g. Juan)"
            aria-label="Student or Customer Name"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />

          {matchingCustomers.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
              {matchingCustomers.map((c) => {
                const activePlan = planSubs.find(
                  (p) => p.customerId === c.id && isPlanActiveOnDate(p, todayYmd)
                );
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-blue-50"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.memberCardNo && (
                        <div className="text-[11px] text-slate-600">Card: {c.memberCardNo}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Boolean(c.isMember) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                          Member
                        </span>
                      )}
                      {activePlan && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                          Plan
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Walk-In / Member 1-Tap Switch */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setIsMember(false)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition tabular-nums ${
              !isMember ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Walk-In ({formatPeso(baseNonMember)})</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMember(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition tabular-nums ${
              isMember ? 'bg-amber-100 text-amber-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Member ({formatPeso(baseMember)})</span>
          </button>
        </div>

        {/* Optional Details Toggle */}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          aria-expanded={showDetails}
        >
          <span>Details</span>
          <ChevronDown className={`h-3.5 w-3.5 transition ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        {/* Submit Time In */}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.2)] hover:bg-blue-700 disabled:opacity-50"
        >
          <Clock className="h-4 w-4" />
          <span>{submitting ? 'Starting...' : 'Time In'}</span>
        </button>
      </div>

      {selectedPlanId && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            Covered by Active Study Plan (₱0 time charge)
          </span>
          <button
            type="button"
            onClick={() => setSelectedPlanId(null)}
            className="font-semibold underline"
          >
            Remove
          </button>
        </div>
      )}

      {showDetails && (
        <div className="grid gap-2.5 border-t border-slate-100 pt-2.5 sm:grid-cols-2">
          <input
            type="text"
            value={memberCardNo}
            onChange={(e) => setMemberCardNo(e.target.value)}
            placeholder="Member Card No. (optional)"
            aria-label="Member Card Number"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / Seat / Request (optional)"
            aria-label="Notes"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
          />
        </div>
      )}

      {timeInError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
          {timeInError}
        </div>
      )}
    </form>
  );

  if (visits.length === 0) {
    return (
      <div className="space-y-5">
        {quickTimeInBar}
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">No Active Sessions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Type a student name above and tap Time In to start their post-pay timer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {quickTimeInBar}

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
