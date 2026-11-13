import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';
import { SaleRecord, ExpenseRecord } from '../../shared/types';

const UTF8_BOM = '\uFEFF';

function escapeCsvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function appendCsvRow(filePath: string, headers: string[], row: unknown[]) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const exists = fs.existsSync(filePath);
  const line = row.map(escapeCsvCell).join(',') + '\r\n';
  if (!exists) {
    const headerLine = UTF8_BOM + headers.map(escapeCsvCell).join(',') + '\r\n';
    fs.writeFileSync(filePath, headerLine + line, 'utf-8');
  } else {
    fs.appendFileSync(filePath, line, 'utf-8');
  }
}

export function getMonthFolder(isoDate: string, baseDir: string = DATA_DIR): { dir: string; ym: string } {
  const ym = isoDate.slice(0, 7); // YYYY-MM
  const dir = path.join(baseDir, ym);
  return { dir, ym };
}

/**
 * Automatically writes every sale line and payment immediately to the monthly CSV files.
 */
export function appendSaleToCsv(sale: SaleRecord, baseDir: string = DATA_DIR) {
  const { dir, ym } = getMonthFolder(sale.createdAt, baseDir);
  const datePart = sale.createdAt.slice(0, 10);
  const timePart = new Date(sale.createdAt).toTimeString().slice(0, 8);

  const salesFile = path.join(dir, `sales_${ym}.csv`);
  const salesHeaders = [
    'Date',
    'Time',
    'Receipt_No',
    'Staff',
    'Customer',
    'Member',
    'Minutes_Stayed',
    'Category',
    'Item',
    'Qty',
    'Unit_Price_PHP',
    'Line_Amount_PHP',
    'Sale_Discount_PHP',
    'Sale_Total_PHP',
    'Payment_Methods',
  ];

  const paymentSummary = sale.payments
    .map((p) => `${p.method.toUpperCase()}:${p.amount}${p.refNo ? `(${p.refNo})` : ''}`)
    .join(' | ');

  for (const line of sale.lines) {
    appendCsvRow(salesFile, salesHeaders, [
      datePart,
      timePart,
      sale.receiptNo,
      sale.staffName,
      sale.customerName,
      sale.isMember ? 'YES' : 'NO',
      sale.minutesStayed,
      line.type.toUpperCase(),
      line.item,
      line.qty,
      line.unitPrice,
      line.amount,
      sale.discount,
      sale.total,
      paymentSummary,
    ]);
  }

  const paymentsFile = path.join(dir, `payments_${ym}.csv`);
  const paymentHeaders = [
    'Date',
    'Time',
    'Receipt_No',
    'Customer',
    'Method',
    'Amount_PHP',
    'Tendered_PHP',
    'Reference_No',
    'Staff',
  ];

  for (const p of sale.payments) {
    appendCsvRow(paymentsFile, paymentHeaders, [
      datePart,
      timePart,
      sale.receiptNo,
      sale.customerName,
      p.method.toUpperCase(),
      p.amount,
      p.tendered ?? p.amount,
      p.refNo ?? '',
      sale.staffName,
    ]);
  }
}

export function appendExpenseToCsv(expense: ExpenseRecord, baseDir: string = DATA_DIR) {
  const { dir, ym } = getMonthFolder(expense.createdAt, baseDir);
  const datePart = expense.createdAt.slice(0, 10);
  const timePart = new Date(expense.createdAt).toTimeString().slice(0, 8);

  const expensesFile = path.join(dir, `expenses_${ym}.csv`);
  const headers = ['Date', 'Time', 'Category', 'Amount_PHP', 'Payment_Method', 'Note', 'Staff'];

  appendCsvRow(expensesFile, headers, [
    datePart,
    timePart,
    expense.category,
    expense.amount,
    expense.method.toUpperCase(),
    expense.note,
    expense.staffName,
  ]);
}

export function listCsvFiles(baseDir: string = DATA_DIR): Array<{ name: string; month: string; relativePath: string; sizeBytes: number; updatedAt: string }> {
  if (!fs.existsSync(baseDir)) return [];
  const results: Array<{ name: string; month: string; relativePath: string; sizeBytes: number; updatedAt: string }> = [];

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name)) {
      const monthDir = path.join(baseDir, entry.name);
      for (const f of fs.readdirSync(monthDir)) {
        if (f.endsWith('.csv')) {
          const full = path.join(monthDir, f);
          const stat = fs.statSync(full);
          results.push({
            name: f,
            month: entry.name,
            relativePath: `${entry.name}/${f}`,
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    }
  }
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
