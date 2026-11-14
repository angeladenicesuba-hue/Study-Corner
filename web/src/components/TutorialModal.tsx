import React, { useState } from 'react';
import {
  Clock,
  Utensils,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Sun,
  Moon,
  Plus,
  Minus,
  RotateCcw,
  Users,
  BookOpen,
  CreditCard,
  CheckCircle2,
  Play,
  Receipt,
  QrCode,
  Banknote,
} from 'lucide-react';
import { AppSettings } from '@shared/types';
import { computeTimeCharge, formatPeso } from '@shared/billing';
import {
  loadUiPreferences,
  saveUiPreferences,
  ThemeMode,
  UI_SCALE_OPTIONS,
  UiPreferences,
  UiScale,
} from '../uiPrefs';

const TUTORIAL_SEEN_KEY = 'sc_pos_tutorial_seen_v1';

export function hasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
}

export function markTutorialSeen(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
}

export type TutorialSection = 'whos_in' | 'time_in' | 'food' | 'plans' | 'ledger' | 'settings';

interface TutorialModalProps {
  settings?: AppSettings;
  onNavigate?: (section: TutorialSection) => void;
  onClose: () => void;
}

const SAMPLE_FOODS = [
  { name: 'Iced Latte', price: 80, category: 'Coffee' },
  { name: 'Spanish Latte', price: 95, category: 'Coffee' },
  { name: 'Chicken Pastil w/ Egg', price: 80, category: 'Meal' },
  { name: 'Beef Bulgogi', price: 169, category: 'Meal' },
];

export const TutorialModal: React.FC<TutorialModalProps> = ({
  settings,
  onNavigate,
  onClose,
}) => {
  const [step, setStep] = useState(0);

  // Mission completion tracking
  const [completedMissions, setCompletedMissions] = useState<Record<number, boolean>>({});

  // Step 1: Interactive Check-In & Billing Simulator
  const [studentName, setStudentName] = useState<string>('Juan Dela Cruz');
  const [demoPassType, setDemoPassType] = useState<'non_member' | 'member' | 'plan'>('non_member');
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const [demoHours, setDemoHours] = useState<number>(3);
  const [pastClosingCap, setPastClosingCap] = useState<boolean>(false);

  // Step 2: Interactive Food Tab Sandbox
  const [demoFoodCounts, setDemoFoodCounts] = useState<Record<string, number>>({
    'Iced Latte': 1,
  });

  // Step 3: Interactive Checkout, Tendered Cash & Mini Receipt
  const [payMethod, setPayMethod] = useState<'cash' | 'qrph' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState<number>(500);
  const [paidReceipt, setPaidReceipt] = useState<boolean>(false);

  // Step 4: Live Display & Theme Customization
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>(() => loadUiPreferences());

  const totalSteps = 4;
  const isLast = step === totalSteps - 1;

  const effectiveHours = pastClosingCap ? Math.min(demoHours, 5) : demoHours;
  const billingPreview = computeTimeCharge(
    effectiveHours * 60,
    demoPassType === 'member',
    demoPassType === 'plan',
    settings?.tiers
  );

  const foodTotal = SAMPLE_FOODS.reduce(
    (sum, item) => sum + (demoFoodCounts[item.name] || 0) * item.price,
    0
  );
  const combinedTotal = billingPreview.amount + foodTotal;
  const cashChange = Math.max(0, cashTendered - combinedTotal);

  const markDone = (idx: number) => {
    setCompletedMissions((prev) => ({ ...prev, [idx]: true }));
  };

  const goStep = (nextStep: number) => {
    setStep(nextStep);
    if (onNavigate) {
      const targetMap: TutorialSection[] = ['time_in', 'whos_in', 'whos_in', 'settings'];
      onNavigate(targetMap[nextStep] || 'whos_in');
    }
  };

  const adjustFood = (name: string, delta: number) => {
    setDemoFoodCounts((prev) => ({
      ...prev,
      [name]: Math.max(0, (prev[name] || 0) + delta),
    }));
    markDone(1);
    setPaidReceipt(false);
  };

  const handleTheme = (theme: ThemeMode) => {
    setUiPrefs(saveUiPreferences({ ...uiPrefs, theme }));
    markDone(3);
  };

  const handleScale = (scale: UiScale) => {
    setUiPrefs(saveUiPreferences({ ...uiPrefs, scale }));
    markDone(3);
  };

  const handleFinish = (targetSection?: TutorialSection) => {
    markTutorialSeen();
    if (targetSection && onNavigate) {
      onNavigate(targetSection);
    }
    onClose();
  };

  const completedCount = Object.values(completedMissions).filter(Boolean).length;

  const stepMeta = [
    {
      badge: 'Mission 1 of 4 • Check-In & Hourly Tiers',
      title: 'Check In a Student & Test the Timer',
      subtitle: 'Try checking in a student and sliding the timer to see how rates work',
      icon: <Clock className="h-6 w-6 text-blue-600" />,
    },
    {
      badge: 'Mission 2 of 4 • Running Food & Drink Tab',
      title: 'Add Drinks & Meals to Their Tab',
      subtitle: "Tap menu items below just like you do in Who's In or Food POS",
      icon: <Utensils className="h-6 w-6 text-blue-600" />,
    },
    {
      badge: 'Mission 3 of 4 • Time Out, Pay & Receipt',
      title: 'Practice Checkout & Payment',
      subtitle: 'Pick Cash, QR Ph, or Card and generate a sample receipt',
      icon: <Receipt className="h-6 w-6 text-blue-600" />,
    },
    {
      badge: 'Mission 4 of 4 • Customize & Launch',
      title: 'Set Your Theme, Text Size & Start',
      subtitle: 'Pick Dark/Light mode and UI size, then jump to any screen',
      icon: <Sparkles className="h-6 w-6 text-blue-600" />,
    },
  ][step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Study Corner POS Simulator"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Top Progress Bar & Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-200">
              {stepMeta.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {stepMeta.badge}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  {completedCount}/4 tried
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{stepMeta.title}</h2>
              <p className="text-xs text-slate-600">{stepMeta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFinish()}
            aria-label="Close tutorial"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Step Tabs */}
        <div className="grid grid-cols-4 gap-1.5">
          {['1. Time In', '2. Add Food', '3. Checkout', '4. Display'].map((label, idx) => {
            const active = step === idx;
            const done = completedMissions[idx];
            return (
              <button
                key={label}
                type="button"
                onClick={() => goStep(idx)}
                className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* MISSION 1: Interactive Check-In & Rate Simulator */}
        {step === 0 && (
          <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="demo-student-input" className="block text-xs font-bold text-slate-700">
                  1. Student Name (try typing or picking):
                </label>
                <input
                  id="demo-student-input"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    markDone(0);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setCheckedIn(true);
                  markDone(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  checkedIn
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {checkedIn ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Checked In!
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Tap to Time In
                  </>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">2. Select Pass / Membership:</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'non_member', label: 'Non-Member', sub: 'Standard Tiers' },
                  { id: 'member', label: 'Member Card', sub: '₱10–₱20 Off' },
                  { id: 'plan', label: 'Study Plan', sub: '₱0 Time Charge' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDemoPassType(opt.id as typeof demoPassType);
                      markDone(0);
                    }}
                    className={`rounded-xl border p-2 text-center transition ${
                      demoPassType === opt.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div
                      className={`text-[11px] ${
                        demoPassType === opt.id ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {opt.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>3. Fast-forward study timer:</span>
                <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-white tabular-nums">
                  {effectiveHours} {effectiveHours === 1 ? 'hr' : 'hrs'} billed
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={13}
                value={demoHours}
                onChange={(e) => {
                  setDemoHours(Number(e.target.value));
                  markDone(0);
                }}
                aria-label="Fast-forward study hours"
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pastClosingCap}
                    onChange={(e) => {
                      setPastClosingCap(e.target.checked);
                      if (e.target.checked && demoHours < 8) setDemoHours(9);
                      markDone(0);
                    }}
                    className="h-4 w-4 rounded accent-blue-600"
                  />
                  <span>Simulate 9:00 PM Closing Cap (prevents overcharging)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-white p-3.5">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  {studentName || 'Student'} • {billingPreview.tierLabel}
                </div>
                <div className="text-xs text-slate-600">
                  {pastClosingCap
                    ? 'Capped at 9:00 PM closing (5h max instead of ' + demoHours + 'h)'
                    : 'Any started hour = 1 full billable hour'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">Time Charge</div>
                <div className="text-xl font-extrabold text-blue-600 tabular-nums">
                  {formatPeso(billingPreview.amount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MISSION 2: Interactive Food Tab Sandbox */}
        {step === 1 && (
          <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Tap items to add to <span className="text-blue-600">{studentName || 'Student'}</span>&apos;s running tab:
              </span>
              <button
                type="button"
                onClick={() => {
                  setDemoFoodCounts({});
                  markDone(1);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3 w-3" />
                Clear Tab
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_FOODS.map((item) => {
                const qty = demoFoodCounts[item.name] || 0;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {item.category} • {formatPeso(item.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustFood(item.name, -1)}
                        aria-label={`Remove ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-slate-900 tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustFood(item.name, 1)}
                        aria-label={`Add ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Study Time ({effectiveHours}h)</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatPeso(billingPreview.amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Food & Drinks Added</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatPeso(foodTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-slate-900">
                <span>Running Tab Total</span>
                <span className="text-blue-600 tabular-nums">{formatPeso(combinedTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* MISSION 3: Interactive Checkout, Tendered Cash & Receipt */}
        {step === 2 && (
          <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">1. Choose Payment Method:</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
                  { id: 'qrph', label: 'QR Ph', icon: <QrCode className="h-4 w-4" /> },
                  { id: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPayMethod(m.id as typeof payMethod);
                      markDone(2);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                      payMethod === m.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'cash' && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-700">2. Tap Cash Tendered by Student:</div>
                <div className="grid grid-cols-4 gap-2">
                  {[combinedTotal, 200, 500, 1000].map((amt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCashTendered(amt);
                        markDone(2);
                      }}
                      className={`rounded-xl border py-2 text-xs font-bold tabular-nums transition ${
                        cashTendered === amt
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {i === 0 ? `Exact (${formatPeso(amt)})` : formatPeso(amt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
              <div>
                <div className="text-slate-500">Total Due</div>
                <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                  {formatPeso(combinedTotal)}
                </div>
              </div>
              {payMethod === 'cash' ? (
                <div className="text-right">
                  <div className="text-slate-500">Change to Return</div>
                  <div className="text-lg font-extrabold text-emerald-600 tabular-nums">
                    {formatPeso(cashChange)}
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-slate-500">Payment Mode</div>
                  <div className="text-sm font-bold text-blue-600 uppercase">{payMethod}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPaidReceipt(true);
                markDone(2);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Receipt className="h-4 w-4" />
              <span>{paidReceipt ? 'Practice Receipt Generated!' : 'Tap to Complete Practice Checkout'}</span>
            </button>

            {paidReceipt && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>✓ Receipt #SC-DEMO-001 ({studentName || 'Student'})</span>
                  <span className="tabular-nums">{formatPeso(combinedTotal)} PAID</span>
                </div>
                <div className="text-[11px] text-emerald-800">
                  In the real app, this automatically saves to your SQLite Hub + Monthly CSV and opens the printable receipt modal.
                </div>
              </div>
            )}
          </div>
        )}

        {/* MISSION 4: Interactive Display Setup & Quick Launch */}
        {step === 3 && (
          <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">1. Try Light or Dark Mode right now:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTheme('light')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                    uiPrefs.theme === 'light'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  Light Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleTheme('dark')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                    uiPrefs.theme === 'dark'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700">2. Resize UI & Font Size (scales live!):</div>
              <div className="grid grid-cols-4 gap-2">
                {UI_SCALE_OPTIONS.map((opt) => {
                  const active = uiPrefs.scale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleScale(opt.id)}
                      className={`rounded-xl border p-2 text-center transition ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className={`text-[11px] ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                        {opt.percent}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-slate-700">3. Jump straight into any screen:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFinish('time_in')}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-blue-600"
                >
                  <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Open Time In</div>
                    <div className="text-[11px] text-slate-500">Check a student in</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinish('whos_in')}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-blue-600"
                >
                  <Users className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Open Who&apos;s In</div>
                    <div className="text-[11px] text-slate-500">Active tabs & checkout</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinish('food')}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-blue-600"
                >
                  <Utensils className="h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Open Food POS</div>
                    <div className="text-[11px] text-slate-500">Walk-in food orders</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinish('ledger')}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-blue-600"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-purple-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Open Ledger</div>
                    <div className="text-[11px] text-slate-500">Shifts & CSV exports</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleFinish()}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Skip Guide
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => goStep(step - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? handleFinish() : goStep(step + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <span>{isLast ? 'Finish & Start POS' : 'Next Mission'}</span>
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
