import React, { useState } from 'react';
import { Banknote, CreditCard, QrCode, X, CheckCircle2, Maximize2 } from 'lucide-react';
import { PaymentInput, SaleLine } from '@shared/types';
import { formatPeso } from '@shared/billing';

interface PaymentModalProps {
  title: string;
  customerName: string;
  isMember: boolean;
  lines: SaleLine[];
  qrPhImageUrl: string;
  onCancel: () => void;
  onConfirm: (payments: PaymentInput[], discount: number) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  title,
  customerName,
  isMember,
  lines,
  qrPhImageUrl,
  onCancel,
  onConfirm,
}) => {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);
  const total = Math.max(0, subtotal - discount);

  const [method, setMethod] = useState<'cash' | 'qrph' | 'card' | 'split'>('cash');
  const [cashTendered, setCashTendered] = useState<string>(String(total));
  const [refNo, setRefNo] = useState<string>('');
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitQrRef, setSplitQrRef] = useState<string>('');
  const [zoomQr, setZoomQr] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const numericCash = Number(cashTendered) || 0;
  const changeDue = method === 'cash' ? Math.max(0, numericCash - total) : 0;

  const quickCashAmounts = Array.from(new Set([total, 100, 200, 300, 500, 1000])).filter((x) => x >= total);

  const handleComplete = async () => {
    setError('');
    let payments: PaymentInput[] = [];

    if (method === 'cash') {
      if (numericCash < total) {
        setError('Cash tendered is less than the total due.');
        return;
      }
      payments = [{ method: 'cash', amount: total, tendered: numericCash }];
    } else if (method === 'qrph') {
      payments = [{ method: 'qrph', amount: total, refNo: refNo.trim() || 'QRPH' }];
    } else if (method === 'card') {
      payments = [{ method: 'card', amount: total, refNo: refNo.trim() || 'CARD' }];
    } else if (method === 'split') {
      const cashPart = Math.min(total, Math.max(0, Number(splitCash) || 0));
      const qrPart = Math.max(0, total - cashPart);
      if (cashPart > 0) payments.push({ method: 'cash', amount: cashPart, tendered: cashPart });
      if (qrPart > 0) payments.push({ method: 'qrph', amount: qrPart, refNo: splitQrRef.trim() || 'QRPH-SPLIT' });
    }

    setSubmitting(true);
    try {
      await onConfirm(payments, discount);
    } catch (e: any) {
      setError(e?.message || 'Failed to save payment.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Clean Light Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-600">
              {customerName}
              {isMember && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                  Member
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 tabular-nums">
          {/* Itemized Lines & Total */}
          <div className="space-y-2">
            <div className="divide-y divide-slate-100 text-sm">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-slate-900">{line.item}</span>
                    {line.qty > 1 && <span className="ml-1.5 text-xs text-slate-600">×{line.qty}</span>}
                  </div>
                  <span className="font-bold text-slate-900">{formatPeso(line.amount)}</span>
                </div>
              ))}
            </div>

            {showDiscountInput || discount > 0 ? (
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                <label htmlFor="discount-input" className="font-semibold text-slate-700">
                  Discount (₱)
                </label>
                <input
                  id="discount-input"
                  type="number"
                  min={0}
                  max={subtotal}
                  value={discount || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const d = Math.max(0, Number(e.target.value) || 0);
                    setDiscount(d);
                    setCashTendered(String(Math.max(0, subtotal - d)));
                  }}
                  className="w-24 rounded-lg border border-slate-300 px-2.5 py-1 text-right font-bold text-slate-900"
                />
              </div>
            ) : (
              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(true)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                >
                  + Add discount
                </button>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-bold text-slate-800">Amount Due</span>
              <span className="text-2xl font-extrabold text-blue-700">{formatPeso(total)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('cash');
                setCashTendered(String(total));
              }}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 px-2 text-xs font-bold transition ${
                method === 'cash'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Banknote className="h-5 w-5" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('qrph')}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 px-2 text-xs font-bold transition ${
                method === 'qrph'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <QrCode className="h-5 w-5" />
              <span>QR Ph</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 px-2 text-xs font-bold transition ${
                method === 'card'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="h-5 w-5" />
              <span>Card</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('split')}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 px-2 text-xs font-bold transition ${
                method === 'split'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Split</span>
            </button>
          </div>

          {/* Cash Input */}
          {method === 'cash' && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-1.5">
                {quickCashAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashTendered(String(amt))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      numericCash === amt
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {formatPeso(amt)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 items-center pt-1">
                <div>
                  <label htmlFor="cash-tendered-input" className="block text-xs font-semibold text-slate-700">
                    Cash Tendered (₱)
                  </label>
                  <input
                    id="cash-tendered-input"
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base font-bold text-slate-900"
                  />
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-emerald-800">Change Due</div>
                  <div className="text-2xl font-extrabold text-emerald-700">{formatPeso(changeDue)}</div>
                </div>
              </div>
            </div>
          )}

          {/* QR Ph Display & Reference Input */}
          {method === 'qrph' && (
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 items-center">
              <div className="flex flex-col items-center">
                <img
                  src={qrPhImageUrl}
                  alt="Study Corner QR Ph"
                  className="h-44 w-44 rounded-xl border border-slate-200 bg-white object-contain p-2 cursor-pointer"
                  onClick={() => setZoomQr(true)}
                />
                <button
                  type="button"
                  onClick={() => setZoomQr(true)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Enlarge QR
                </button>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-slate-700">
                  Scan using GCash, Maya, or any QR Ph bank app.
                </div>
                <div>
                  <label htmlFor="qr-ref-input" className="block text-xs font-semibold text-slate-700">
                    Reference No. (Optional)
                  </label>
                  <input
                    id="qr-ref-input"
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="Last 4–6 digits"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Card Input */}
          {method === 'card' && (
            <div className="border-t border-slate-100 pt-4">
              <label htmlFor="card-ref-input" className="block text-xs font-semibold text-slate-700">
                Terminal Approval / Reference No.
              </label>
              <input
                id="card-ref-input"
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="Enter trace or approval number"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          {/* Split Payment */}
          {method === 'split' && (
            <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <div>
                <label htmlFor="split-cash-input" className="block text-xs font-semibold text-slate-700">
                  Cash (₱)
                </label>
                <input
                  id="split-cash-input"
                  type="number"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="split-qr-amount" className="block text-xs font-semibold text-slate-700">
                  QR Ph (₱)
                </label>
                <input
                  id="split-qr-amount"
                  type="text"
                  readOnly
                  value={formatPeso(Math.max(0, total - (Number(splitCash) || 0)))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-bold text-blue-700"
                />
              </div>
              <div>
                <label htmlFor="split-qr-ref" className="block text-xs font-semibold text-slate-700">
                  QR Ref No.
                </label>
                <input
                  id="split-qr-ref"
                  type="text"
                  value={splitQrRef}
                  onChange={(e) => setSplitQrRef(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleComplete}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.25)] hover:bg-blue-700 disabled:opacity-50 tabular-nums"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Saving...' : `Confirm Payment (${formatPeso(total)})`}
          </button>
        </div>
      </div>

      {/* Fullscreen QR Ph Lightbox */}
      {zoomQr && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 p-6"
          onClick={() => setZoomQr(false)}
        >
          <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Scan to Pay via QR Ph</h3>
            <p className="mt-1 mb-3 text-2xl font-extrabold text-blue-700 tabular-nums">{formatPeso(total)}</p>
            <img src={qrPhImageUrl} alt="QR Ph" className="mx-auto h-72 w-72 object-contain" />
            <button
              type="button"
              onClick={() => setZoomQr(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
