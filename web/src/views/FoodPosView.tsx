import React, { useState } from 'react';
import { Coffee, CupSoda, Utensils, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { AppSettings, PaymentInput, Product, SaleLine, SaleRecord } from '@shared/types';
import { formatPeso } from '@shared/billing';
import { api } from '../api';
import { PaymentModal } from '../components/PaymentModal';

interface FoodPosViewProps {
  products: Product[];
  settings: AppSettings;
  staffName: string;
  onSaleCompleted: (sale: SaleRecord) => void;
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
  onSaleCompleted,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [showPayModal, setShowPayModal] = useState<boolean>(false);

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
                <div className="text-sm font-bold text-slate-900">{p.name}</div>
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

        <div className="mt-3">
          <label htmlFor="food-customer-input" className="block text-xs font-semibold text-slate-700">
            Customer Name
          </label>
          <input
            id="food-customer-input"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
          />
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {cartLines.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-600">
              Select items from the menu to build an order.
            </div>
          ) : (
            cartLines.map((line) => {
              const prod = products.find((p) => p.name === line.item)!;
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
            disabled={cartLines.length === 0}
            onClick={() => setShowPayModal(true)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700 disabled:opacity-40"
          >
            Charge {formatPeso(cartTotal)}
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
