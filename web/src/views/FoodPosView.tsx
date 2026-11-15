import React, { useState } from 'react';
import {
  Beef,
  CheckCircle2,
  Citrus,
  Coffee,
  CupSoda,
  Drumstick,
  Egg,
  Leaf,
  Milk,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
} from 'lucide-react';
import { AppSettings, PaymentInput, Product, SaleLine, SaleRecord, Visit } from '@shared/types';
import { formatPeso } from '@shared/billing';
import { api } from '../api';
import { PaymentModal } from '../components/PaymentModal';

function getProductIcon(product: Product): React.ReactNode {
  const n = product.name.toLowerCase();
  const cls = 'h-4 w-4 shrink-0';

  if (n.includes('lemon') || n.includes('sprite') || n.includes('citrus')) {
    return <Citrus className={cls} />;
  }
  if (n.includes('matcha') || n.includes('tea')) {
    return <Leaf className={cls} />;
  }
  if (n.includes('strawberry') || n.includes('milk')) {
    return <Milk className={cls} />;
  }
  if (n.includes('milo')) {
    return <CupSoda className={cls} />;
  }
  if (n.includes('egg') || n.includes('pastil')) {
    return <Egg className={cls} />;
  }
  if (n.includes('beef') || n.includes('steak') || n.includes('pork')) {
    return <Beef className={cls} />;
  }
  if (n.includes('chicken')) {
    return <Drumstick className={cls} />;
  }

  switch (product.category) {
    case 'iced_coffee':
      return <Coffee className={cls} />;
    case 'non_coffee':
      return <CupSoda className={cls} />;
    case 'lunch_dinner':
      return <Utensils className={cls} />;
    default:
      return <ShoppingBag className={cls} />;
  }
}

interface FoodPosViewProps {
  products: Product[];
  settings: AppSettings;
  staffName: string;
  activeVisits?: Visit[];
  onSaleCompleted: (sale: SaleRecord) => void;
  onTabUpdated?: () => void;
}

const CATEGORIES: Array<{ id: string; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All', icon: <ShoppingBag className="h-4 w-4" /> },
  { id: 'iced_coffee', label: 'Coffee', icon: <Coffee className="h-4 w-4" /> },
  { id: 'non_coffee', label: 'Non-Coffee', icon: <CupSoda className="h-4 w-4" /> },
  { id: 'lunch_dinner', label: 'Meals', icon: <Utensils className="h-4 w-4" /> },
];

export const FoodPosView: React.FC<FoodPosViewProps> = ({
  products,
  settings,
  staffName,
  activeVisits = [],
  onSaleCompleted,
  onTabUpdated,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [targetVisitId, setTargetVisitId] = useState<number | 'walk_in'>('walk_in');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [addingToTab, setAddingToTab] = useState<boolean>(false);
  const [tabBanner, setTabBanner] = useState<string>('');

  const visibleProducts = products.filter(
    (p) => p.active && (activeCategory === 'all' || p.category === activeCategory)
  );

  const addToCart = (id: number, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[id] || 0) + delta;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const cartLines: SaleLine[] = Object.entries(cart)
    .map(([idStr, qty]): SaleLine | null => {
      const prod = products.find((p) => p.id === Number(idStr));
      if (!prod) return null;
      return {
        type: 'food',
        item: prod.name,
        qty,
        unitPrice: prod.price,
        amount: prod.price * qty,
      };
    })
    .filter((x): x is SaleLine => x !== null);

  const cartTotal = cartLines.reduce((s, l) => s + l.amount, 0);

  const handleConfirmPayment = async (payments: PaymentInput[], discount: number) => {
    const sale = await api.recordSale({
      staffName,
      customerName: customerName.trim() || 'Walk-in Customer',
      isMember: false,
      lines: cartLines,
      discount,
      payments,
    });
    setCart({});
    setCustomerName('Walk-in Customer');
    setShowPayModal(false);
    onSaleCompleted(sale);
  };

  const selectedVisit =
    targetVisitId === 'walk_in'
      ? null
      : activeVisits.find((v) => v.id === targetVisitId) || null;

  const handlePrimaryOrderAction = async () => {
    if (cartLines.length === 0) return;
    if (selectedVisit) {
      setAddingToTab(true);
      try {
        for (const [idStr, qty] of Object.entries(cart)) {
          if (qty > 0) {
            await api.addFoodToVisit(selectedVisit.id, Number(idStr), qty);
          }
        }
        setTabBanner(`Added ${formatPeso(cartTotal)} to ${selectedVisit.customerName}'s tab.`);
        setCart({});
        setTargetVisitId('walk_in');
        onTabUpdated?.();
      } finally {
        setAddingToTab(false);
      }
      return;
    }
    setShowPayModal(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 items-start">
      {/* Menu Grid */}
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleProducts.map((p) => {
            const qtyInCart = cart[p.id] || 0;
            const selectedVisit =
    targetVisitId === 'walk_in'
      ? null
      : activeVisits.find((v) => v.id === targetVisitId) || null;

  const handlePrimaryOrderAction = async () => {
    if (cartLines.length === 0) return;
    if (selectedVisit) {
      setAddingToTab(true);
      try {
        for (const [idStr, qty] of Object.entries(cart)) {
          if (qty > 0) {
            await api.addFoodToVisit(selectedVisit.id, Number(idStr), qty);
          }
        }
        setTabBanner(`Added ${formatPeso(cartTotal)} to ${selectedVisit.customerName}'s tab.`);
        setCart({});
        setTargetVisitId('walk_in');
        onTabUpdated?.();
      } finally {
        setAddingToTab(false);
      }
      return;
    }
    setShowPayModal(true);
  };

  return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p.id, 1)}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                  qtyInCart > 0
                    ? 'border-blue-600 bg-blue-50/50 shadow-[0_2px_6px_rgba(37,99,235,0.12)]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                      qtyInCart > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                    aria-hidden="true"
                  >
                    {getProductIcon(p)}
                  </span>
                  <div className="text-sm font-bold text-slate-900 leading-snug">{p.name}</div>
                </div>
                <div className="mt-3 flex items-center justify-between tabular-nums">
                  <span className="text-base font-extrabold text-blue-700">{formatPeso(p.price)}</span>
                  {qtyInCart > 0 && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                      ×{qtyInCart}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Order Cart Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Current Order</h2>
          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={() => setCart({})}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {tabBanner && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{tabBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setTabBanner('')}
              className="font-bold underline"
            >
              OK
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          <label htmlFor="food-order-target" className="block text-xs font-semibold text-slate-700">
            Order For
          </label>
          {activeVisits.length > 0 ? (
            <select
              id="food-order-target"
              value={selectedVisit ? String(selectedVisit.id) : 'walk_in'}
              onChange={(e) => {
                const val = e.target.value;
                setTargetVisitId(val === 'walk_in' ? 'walk_in' : Number(val));
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            >
              <option value="walk_in">Walk-in Customer (Pay Now)</option>
              {activeVisits.map((v) => (
                <option key={v.id} value={v.id}>
                  Add to Tab: {v.customerName}
                </option>
              ))}
            </select>
          ) : null}

          {!selectedVisit && (
            <input
              id="food-customer-input"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              aria-label="Walk-in Customer Name"
              placeholder="Walk-in Customer"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
            />
          )}
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {cartLines.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              Select items from the menu to build an order.
            </div>
          ) : (
            cartLines.map((line) => {
              const prod = products.find((p) => p.name === line.item)!;
              const selectedVisit =
    targetVisitId === 'walk_in'
      ? null
      : activeVisits.find((v) => v.id === targetVisitId) || null;

  const handlePrimaryOrderAction = async () => {
    if (cartLines.length === 0) return;
    if (selectedVisit) {
      setAddingToTab(true);
      try {
        for (const [idStr, qty] of Object.entries(cart)) {
          if (qty > 0) {
            await api.addFoodToVisit(selectedVisit.id, Number(idStr), qty);
          }
        }
        setTabBanner(`Added ${formatPeso(cartTotal)} to ${selectedVisit.customerName}'s tab.`);
        setCart({});
        setTargetVisitId('walk_in');
        onTabUpdated?.();
      } finally {
        setAddingToTab(false);
      }
      return;
    }
    setShowPayModal(true);
  };

  return (
                <div key={prod.id} className="flex items-center justify-between py-2.5">
                  <div className="pr-2">
                    <div className="text-sm font-bold text-slate-900">{line.item}</div>
                    <div className="text-xs text-slate-600 tabular-nums">{formatPeso(line.unitPrice)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <button
                      type="button"
                      onClick={() => addToCart(prod.id, -1)}
                      aria-label={`Decrease ${line.item}`}
                      className="rounded-lg border border-slate-300 p-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-slate-900">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(prod.id, 1)}
                      aria-label={`Increase ${line.item}`}
                      className="rounded-lg border border-slate-300 p-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-16 text-right text-sm font-bold text-slate-900">
                      {formatPeso(line.amount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 space-y-3">
          <div className="flex items-center justify-between tabular-nums">
            <span className="text-sm font-bold text-slate-700">Total</span>
            <span className="text-xl font-extrabold text-blue-700">{formatPeso(cartTotal)}</span>
          </div>
          <button
            type="button"
            disabled={cartLines.length === 0 || addingToTab}
            onClick={handlePrimaryOrderAction}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700 disabled:opacity-40"
          >
            {selectedVisit
              ? addingToTab
                ? 'Adding to Tab...'
                : `Add to ${selectedVisit.customerName}'s Tab (${formatPeso(cartTotal)})`
              : `Charge ${formatPeso(cartTotal)}`}
          </button>
        </div>
      </div>

      {showPayModal && (
        <PaymentModal
          title="Food & Drinks Checkout"
          customerName={customerName}
          isMember={false}
          lines={cartLines}
          qrPhImageUrl={settings.qrPhImageUrl}
          onCancel={() => setShowPayModal(false)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
};
