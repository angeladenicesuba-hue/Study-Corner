import React from 'react';
import { Printer, CheckCircle, X } from 'lucide-react';
import { AppSettings, SaleRecord } from '@shared/types';
import { formatPeso } from '@shared/billing';

interface ReceiptModalProps {
  sale: SaleRecord;
  settings: AppSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const cashTendered = sale.payments.reduce((s, p) => s + (p.tendered ?? p.amount), 0);
  const change = Math.max(0, cashTendered - sale.total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-bold">Payment Recorded</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Receipt"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex justify-center">
          {/* Printable 80mm / 58mm Thermal Receipt Card */}
          <div
            id="printable-receipt"
            className="w-full max-w-[290px] rounded-xl border border-slate-200 bg-white p-5 font-mono text-xs text-slate-900 tabular-nums"
          >
            <div className="text-center">
              <div className="text-sm font-extrabold uppercase">{settings.shopName}</div>
              <div className="text-[11px] text-slate-700">{settings.branchName}</div>
              <div className="text-[10px] text-slate-600">{settings.address}</div>
              <div className="my-2.5 border-b border-dashed border-slate-300" />
            </div>

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Receipt</span>
                <span className="font-bold text-slate-900">{sale.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date</span>
                <span className="text-slate-800">{new Date(sale.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Customer</span>
                <span className="font-semibold text-slate-900">
                  {sale.customerName} {sale.isMember ? '(Member)' : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Staff</span>
                <span className="text-slate-800">{sale.staffName}</span>
              </div>
            </div>

            <div className="my-2.5 border-b border-dashed border-slate-300" />

            <div className="space-y-1.5">
              {sale.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <div>
                    <div className="text-slate-900">{line.item}</div>
                    {line.qty > 1 && (
                      <div className="text-[10px] text-slate-600">
                        {line.qty} × {formatPeso(line.unitPrice)}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-slate-900">{formatPeso(line.amount)}</div>
                </div>
              ))}
            </div>

            <div className="my-2.5 border-b border-dashed border-slate-300" />

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-900">{formatPeso(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount</span>
                  <span className="text-slate-900">-{formatPeso(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold pt-1 text-slate-900">
                <span>TOTAL</span>
                <span>{formatPeso(sale.total)}</span>
              </div>
            </div>

            <div className="my-2.5 border-b border-dashed border-slate-300" />

            <div className="space-y-0.5 text-[11px]">
              {sale.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-600">
                    Paid ({p.method.toUpperCase()}
                    {p.refNo ? ` #${p.refNo}` : ''})
                  </span>
                  <span className="text-slate-900">{formatPeso(p.tendered ?? p.amount)}</span>
                </div>
              ))}
              {change > 0 && (
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Change</span>
                  <span>{formatPeso(change)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-[10px] text-slate-600">
              <div>Thank you for studying with us!</div>
              <div>Acknowledgment Receipt</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-slate-200 bg-white px-5 py-3.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
