import React, { useState } from 'react';
import { UserCheck, Award, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { AppSettings, Customer, PlanSub } from '@shared/types';
import { formatPeso, isPlanActiveOnDate, isWithinOperatingHours } from '@shared/billing';
import { api } from '../api';

interface TimeInViewProps {
  settings: AppSettings;
  customers: Customer[];
  planSubs: PlanSub[];
  onCompleted: () => void;
}

export const TimeInView: React.FC<TimeInViewProps> = ({
  settings,
  customers,
  planSubs,
  onCompleted,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [memberCardNo, setMemberCardNo] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allowOutsideHours, setAllowOutsideHours] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Enter the customer name to start a session.');
      return;
    }
    setError('');
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
      onCompleted();
    } catch (err: any) {
      setError(err?.message || 'Could not start study session.');
      setSubmitting(false);
    }
  };

  const baseNonMember = settings.tiers[0]?.nonMember ?? 80;
  const baseMember = settings.tiers[0]?.member ?? 70;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {!withinHours && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              Outside regular hours ({settings.openHour}:00 AM – {settings.closeHour - 12}:00 PM)
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={allowOutsideHours}
              onChange={(e) => setAllowOutsideHours(e.target.checked)}
              className="h-4 w-4 rounded border-amber-400"
            />
            Allow Override
          </label>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Time In</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Type a student name or card number to auto-fill members and active plans.
          </p>
        </div>

        {/* Unified Customer Name & Member Lookup */}
        <div className="relative">
          <label htmlFor="customer-name-input" className="block text-sm font-bold text-slate-800">
            Student / Customer Name
          </label>
          <input
            id="customer-name-input"
            type="text"
            required
            autoComplete="off"
            value={customerName}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setSelectedCustomerId(null);
              setSelectedPlanId(null);
              setShowSuggestions(true);
            }}
            placeholder="e.g. Juan Dela Cruz or SC-0012"
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-blue-50"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.memberCardNo && (
                        <div className="text-xs text-slate-600">Card: {c.memberCardNo}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Boolean(c.isMember) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                          Member
                        </span>
                      )}
                      {activePlan && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">
                          Plan Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Study Plan Banner */}
        {selectedPlanId && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-950">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>Covered by Active Study Plan (₱0 time charge)</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlanId(null)}
              className="font-semibold underline text-emerald-800"
            >
              Remove
            </button>
          </div>
        )}

        {/* Rate Tier Toggle */}
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-1.5">Rate Tier</label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setIsMember(false)}
              className={`flex items-center justify-between rounded-xl border-2 py-3 px-3.5 text-left transition ${
                !isMember
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <UserCheck className="h-4 w-4 shrink-0" />
                <span>Walk-In</span>
              </span>
              <span className="text-xs font-semibold tabular-nums">from {formatPeso(baseNonMember)}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMember(true)}
              className={`flex items-center justify-between rounded-xl border-2 py-3 px-3.5 text-left transition ${
                isMember
                  ? 'border-amber-500 bg-amber-50/80 text-amber-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Award className="h-4 w-4 shrink-0 text-amber-700" />
                <span>Member</span>
              </span>
              <span className="text-xs font-semibold tabular-nums">from {formatPeso(baseMember)}</span>
            </button>
          </div>
        </div>

        {/* Optional Fields Row */}
        <div className={`grid gap-3 ${isMember ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {isMember && (
            <div>
              <label htmlFor="member-card-input" className="block text-xs font-semibold text-slate-700">
                Card No. (Optional)
              </label>
              <input
                id="member-card-input"
                type="text"
                value={memberCardNo}
                onChange={(e) => setMemberCardNo(e.target.value)}
                placeholder="e.g. SC-0012"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          )}

          <div>
            <label htmlFor="seat-note-input" className="block text-xs font-semibold text-slate-700">
              Seat / Table Note (Optional)
            </label>
            <input
              id="seat-note-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2nd floor, near outlet"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Starting Session...' : 'Start Study Timer'}
        </button>
      </form>

      {/* Progressive Disclosure: Rate Table Reference */}
      <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs text-slate-700">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-800">
          <span>View Daily Rate Tiers (8:00 AM – 9:00 PM · No Grace Period)</span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-1.5 font-semibold">Duration</th>
                <th className="py-1.5 text-right font-semibold">Walk-In</th>
                <th className="py-1.5 text-right font-semibold text-amber-900">Member</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.tiers.map((t, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-medium text-slate-800">{t.label}</td>
                  <td className="py-1.5 text-right font-bold text-slate-900">{formatPeso(t.nonMember)}</td>
                  <td className="py-1.5 text-right font-bold text-amber-900">{formatPeso(t.member)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
