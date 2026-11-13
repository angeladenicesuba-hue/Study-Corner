import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDatabase } from './db';
import { PosService } from './service';

describe('PosService & Live CSV Mirror Integration', () => {
  let tmpDir: string;
  let service: PosService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-corner-test-'));
    const db = createDatabase(path.join(tmpDir, 'test.sqlite'));
    service = new PosService(db, tmpDir);
  });

  afterEach(() => {
    try {
      service.db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error on Windows file lock
    }
  });

  it('seeds all 15 official Study Corner menu items', () => {
    const items = service.listProducts();
    expect(items.length).toBe(15);
    expect(items.some((i) => i.name === 'Beef Bulgogi' && i.price === 169)).toBe(true);
    expect(items.some((i) => i.name === 'Spanish Latte' && i.price === 95)).toBe(true);
    expect(items.some((i) => i.name === 'Chicken Pastil w/ Egg' && i.price === 80)).toBe(true);
  });

  it('processes Time In -> Add Food -> Time Out -> Checkout and writes directly to CSV', () => {
    const timeInIso = '2026-11-11T10:00:00.000+08:00';
    const visit = service.timeIn({
      customerName: 'Juan Dela Cruz',
      isMember: false,
      timeInIso,
      allowOutsideHours: true,
    });

    const latte = service.listProducts().find((p) => p.name === 'Iced Latte')!;
    service.addFoodToVisit(visit.id, latte.id, 2); // 2 x 80 = 160

    // Stayed 2h 15m -> 3 hours billed -> 3-5 hours tier (130 non-member)
    const timeOutIso = '2026-11-11T12:15:00.000+08:00';
    const preview = service.previewVisitCheckout(visit.id, timeOutIso);
    expect(preview.hoursBilled).toBe(3);
    expect(preview.timeCharge).toBe(130);
    expect(preview.subtotal).toBe(130 + 160);

    const sale = service.recordSale({
      visitId: visit.id,
      timeOutIso,
      staffName: 'Front Desk Staff',
      customerName: visit.customerName,
      isMember: false,
      minutesStayed: preview.minutesStayed,
      lines: preview.lines,
      payments: [{ method: 'qrph', amount: 290, refNo: 'QR-998877' }],
    });

    expect(sale.total).toBe(290);
    expect(service.listActiveVisits().length).toBe(0);

    // Check CSV file exists and has the rows
    const csvFile = path.join(tmpDir, '2026-11', 'sales_2026-11.csv');
    expect(fs.existsSync(csvFile)).toBe(true);
    const content = fs.readFileSync(csvFile, 'utf-8');
    expect(content).toContain('Juan Dela Cruz');
    expect(content).toContain('Iced Latte');
    expect(content).toContain('QRPH:290(QR-998877)');
  });

  it('sells lifetime Membership Card and applies member rates on subsequent visits', () => {
    service.recordSale({
      staffName: 'Owner',
      customerName: 'Maria Santos',
      isMember: true,
      lines: [{ type: 'membership', item: 'Lifetime Membership Card', qty: 1, unitPrice: 100, amount: 100 }],
      payments: [{ method: 'cash', amount: 100, tendered: 100 }],
      newMembership: {
        customerName: 'Maria Santos',
        memberCardNo: 'SC-MEM-001',
      },
    });

    const customers = service.listCustomers('Maria');
    expect(customers.length).toBe(1);
    expect(customers[0].isMember).toBe(1);

    const v = service.timeIn({
      customerId: customers[0].id,
      customerName: customers[0].name,
      timeInIso: '2026-11-11T09:00:00.000+08:00',
      allowOutsideHours: true,
    });
    const preview = service.previewVisitCheckout(v.id, '2026-11-11T10:30:00.000+08:00');
    expect(preview.timeCharge).toBe(70); // Member 1-2h rate = 70 (vs 80 non-member)
  });
});
