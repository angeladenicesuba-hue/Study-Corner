import React, { useState } from 'react';
import { Award, Calendar, CheckCircle2, CreditCard, Search } from 'lucide-react';
import {
  AppSettings,
  Customer,
  PaymentInput,
  PlanRate,
  PlanSub,
  SaleLine,
  SaleRecord,
} from '@shared/types';
import { computePlanEndDate, formatPeso, isPlanActiveOnDate } from '@shared/billing';
import { api } from '../api';
import { PaymentModal } from '../components/PaymentModal';

interface PlansViewProps {
  settings: AppSettings;
  customers: Customer[];
  planSubs: PlanSub[];
  staffName: string;
  onSaleCompleted: (sale: SaleRecord) => void;
}

export const PlansView: React.FC<PlansViewProps> = ({
  settings,
  customers,
  planSubs,
  staffName,
  onSaleCompleted,
}) => {
  const [tab, setTab] = useState<'sell_plan' | 'sell_member' | 'directory'>('sell_plan');
  const [customerName, setCustomerName] = useState('');
  const [memberCardNo, setMemberCardNo] = useState('');
  const [phone, setPhone] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState<'weekly' | 'semi_month' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<{
    title: string;
    lines: SaleLine[];
    isMember: boolean;
    newMembership?: { customerName: string; memberCardNo: string; phone?: string };
    newPlan?: {
      customerName: string;
      isMember: boolean;
      planType: 'weekly' | 'semi_month' | 'monthly';
      startDate: string;
      days: number;
      price: number;
    };
  } | null>(null);

  const selectedPlan: PlanRate =
    settings.plans.find((p) => p.type === selectedPlanType) || settings.plans[0];
  const planPrice = isMember ? selectedPlan.member : selectedPlan.nonMember;
  const computedEnd = computePlanEndDate(startDate, selectedPlan.days);
  const todayYmd = new Date().toISOString().slice(0, 10);

  const handleStartPlanSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    setPendingCheckout({
      title: `Sell ${selectedPlan.label} Plan`,
      isMember,
      lines: [
        {
          type: 'plan',
          item: `${selectedPlan.label} (${isMember ? 'Member' : 'Non-Member'}) [${startDate} to ${computedEnd}]`,
          qty: 1,
          unitPrice: planPrice,
          amount: planPrice,
        },
      ],
      newPlan: {
        customerName: customerName.trim(),
        isMember,
        planType: selectedPlan.type,
        startDate,
        days: selectedPlan.days,
        price: planPrice,
      },
    });
  };

  const handleStartMembershipSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !memberCardNo.trim()) return;
    setPendingCheckout({
      title: 'Sell Lifetime Membership Card',
      isMember: true,
      lines: [
        {
          type: 'membership',
          item: `Lifetime Membership Card (${memberCardNo.trim()})`,
          qty: 1,
          unitPrice: settings.membershipCardPrice,
          amount: settings.membershipCardPrice,
        },
      ],
      newMembership: {
        customerName: customerName.trim(),
        memberCardNo: memberCardNo.trim(),
        phone: phone.trim() || undefined,
      },
    });
  };

  const handleConfirmPayment = async (payments: PaymentInput[], discount: number) => {
    if (!pendingCheckout) return;
    const sale = await api.recordSale({
      staffName,
      customerName: customerName.trim(),
      isMember: pendingCheckout.isMember,
      lines: pendingCheckout.lines,
      discount,
      payments,
      newMembership: pendingCheckout.newMembership,
      newPlan: pendingCheckout.newPlan,
    });
    setPendingCheckout(null);
    setCustomerName('');
    setMemberCardNo('');
    setPhone('');
    onSaleCompleted(sale);
  };

  const lifetimeMembers = customers.filter((c) => Boolean(c.isMember));

  return (
    <div className="space-y-6">
      {/* Clean Segmented Sub-navigation */}
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('sell_plan')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'sell_plan'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Study Plans</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('sell_member')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'sell_member'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Membership Card</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('directory')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'directory'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Directory ({planSubs.length + lifetimeMembers.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Sell Study Plan */}
      {tab === 'sell_plan' && (
        <form
          onSubmit={handleStartPlanSale}
          className="mx-auto max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Enroll in Study Plan</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Consecutive days with ₱0 daily time charge during valid dates.
            </p>
          </div>

          <div>
            <label htmlFor="plan-customer-name" className="block text-sm font-bold text-slate-800">
              Student / Customer Name
            </label>
            <input
              id="plan-customer-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Maria Clara"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">Rate Tier</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsMember(false)}
                className={`rounded-xl border-2 py-2.5 text-xs font-bold transition ${
                  !isMember
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Walk-In Rate
              </button>
              <button
                type="button"
                onClick={() => setIsMember(true)}
                className={`rounded-xl border-2 py-2.5 text-xs font-bold transition ${
                  isMember
                    ? 'border-amber-500 bg-amber-50/80 text-amber-950'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                With Membership Card
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">Plan Package</label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {settings.plans.map((p) => {
                const price = isMember ? p.member : p.nonMember;
                const active = selectedPlanType === p.type;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => setSelectedPlanType(p.type)}
                    className={`flex flex-col items-start rounded-xl border-2 p-3.5 text-left transition tabular-nums ${
                      active
                        ? 'border-blue-600 bg-blue-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800">{p.label}</span>
                    <span className="mt-1 text-lg font-extrabold text-blue-700">{formatPeso(price)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div>
              <label htmlFor="plan-start-date" className="block text-xs font-semibold text-slate-700">
                Start Date
              </label>
              <input
                id="plan-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="plan-end-date" className="block text-xs font-semibold text-slate-700">
                Valid Until
              </label>
              <input
                id="plan-end-date"
                type="text"
                readOnly
                value={computedEnd}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700 tabular-nums"
          >
            Charge {formatPeso(planPrice)}
          </button>
        </form>
      )}

      {/* Tab 2: Sell Lifetime Membership Card */}
      {tab === 'sell_member' && (
        <form
          onSubmit={handleStartMembershipSale}
          className="mx-auto max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
        >
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Issue Membership Card</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              One-time {formatPeso(settings.membershipCardPrice)} lifetime card unlocking member rates.
            </p>
          </div>

          <div>
            <label htmlFor="member-full-name" className="block text-sm font-bold text-slate-800">
              Student / Customer Name
            </label>
            <input
              id="member-full-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Jose Rizal"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-card-code" className="block text-xs font-semibold text-slate-700">
                Card Number / Code
              </label>
              <input
                id="new-card-code"
                type="text"
                required
                value={memberCardNo}
                onChange={(e) => setMemberCardNo(e.target.value)}
                placeholder="e.g. SC-2026-001"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="member-phone" className="block text-xs font-semibold text-slate-700">
                Phone (Optional)
              </label>
              <input
                id="member-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxxx"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-[0_2px_6px_rgba(217,119,6,0.25)] hover:bg-amber-700 tabular-nums"
          >
            Activate Card ({formatPeso(settings.membershipCardPrice)})
          </button>
        </form>
      )}

      {/* Tab 3: Directory of Plans & Members */}
      {tab === 'directory' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or card number..."
              aria-label="Search directory"
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Study Plan Subscriptions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Study Plans ({planSubs.length})
              </h2>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {planSubs
                  .filter((p) => p.customerName.toLowerCase().includes(search.toLowerCase()))
                  .map((p) => {
                    const active = isPlanActiveOnDate(p, todayYmd);
                    return (
                      <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <div className="font-bold text-slate-900">{p.customerName}</div>
                          <div className="text-xs text-slate-600 tabular-nums">
                            {p.planType.replace('_', '-')} · {p.startDate} to {p.endDate}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            active
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {active ? 'Active' : 'Expired'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Lifetime Members List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Lifetime Members ({lifetimeMembers.length})
              </h2>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {lifetimeMembers
                  .filter(
                    (c) =>
                      c.name.toLowerCase().includes(search.toLowerCase()) ||
                      (c.memberCardNo || '').toLowerCase().includes(search.toLowerCase())
                  )
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-600 tabular-nums">
                          {c.memberCardNo || 'No Card ID'} {c.phone ? `· ${c.phone}` : ''}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                        <CheckCircle2 className="h-3 w-3" /> Member
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingCheckout && (
        <PaymentModal
          title={pendingCheckout.title}
          customerName={customerName}
          isMember={pendingCheckout.isMember}
          lines={pendingCheckout.lines}
          qrPhImageUrl={settings.qrPhImageUrl}
          onCancel={() => setPendingCheckout(null)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
};
