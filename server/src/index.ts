import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDatabase, DATA_DIR, UPLOADS_DIR, getSettings, saveSettings } from './db';
import { PosService } from './service';
import { listCsvFiles } from './csv';
import { createDatabaseBackup, listBackups } from './backup';

const PORT = Number(process.env.PORT || 8787);
const db = createDatabase();
const service = new PosService(db);

// SSE Connected Clients for live multi-device sync
const sseClients = new Set<http.ServerResponse>();

function broadcastUpdate(eventType: string = 'sync') {
  const payload = `data: ${JSON.stringify({ type: eventType, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getLocalLanIps(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isPathInside(baseDir: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

function serveStaticFile(res: http.ServerResponse, filePath: string, reqPathname?: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.csv': 'text/csv; charset=utf-8',
    '.sqlite': 'application/octet-stream',
  };
  const baseName = path.basename(filePath);
  let cacheControl = 'public, max-age=3600';
  if (baseName === 'index.html' || baseName === 'sw.js' || baseName === 'manifest.json') {
    cacheControl = 'no-cache';
  } else if (reqPathname?.startsWith('/assets/')) {
    cacheControl = 'public, max-age=31536000, immutable';
  }
  res.writeHead(200, {
    'Content-Type': mimeMap[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      return sendJson(res, 200, { ok: true });
    }

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // 1. Live SSE stream for multi-device sync
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // 2. Uploaded files (QR Ph images, etc.)
    if (pathname.startsWith('/uploads/')) {
      const fileName = path.basename(pathname);
      const target = path.join(UPLOADS_DIR, fileName);
      if (serveStaticFile(res, target)) return;
      return sendJson(res, 404, { error: 'File not found' });
    }

    // 3. Download CSV files directly
    if (pathname.startsWith('/api/csv/download/')) {
      const rel = pathname.replace('/api/csv/download/', '');
      const fullPath = path.resolve(DATA_DIR, rel);
      if (isPathInside(DATA_DIR, fullPath) && fs.existsSync(fullPath) && fullPath.endsWith('.csv')) {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"`,
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
      return sendJson(res, 404, { error: 'CSV file not found' });
    }

    // 4. Download SQLite Backup file directly
    if (pathname.startsWith('/api/backups/download/')) {
      const fileName = path.basename(pathname.replace('/api/backups/download/', ''));
      const settings = getSettings(db);
      const fullPath = path.join(settings.backupFolder, fileName);
      if (fs.existsSync(fullPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
      return sendJson(res, 404, { error: 'Backup file not found' });
    }

    // --- API ROUTES ---
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        service: 'study-corner-pos',
        timestamp: new Date().toISOString(),
      });
    }

    if (pathname === '/api/bootstrap' && req.method === 'GET') {
      const settings = getSettings(db);
      return sendJson(res, 200, {
        settings,
        products: service.listProducts(true),
        activeVisits: service.listActiveVisits(),
        customers: service.listCustomers(),
        planSubs: service.listPlanSubs(false),
        currentShift: service.getCurrentShift(),
        lanIps: getLocalLanIps(),
        port: PORT,
        dataDir: DATA_DIR,
      });
    }

    if (pathname === '/api/visits/time-in' && req.method === 'POST') {
      const body = await readBody(req);
      const visit = service.timeIn(body);
      broadcastUpdate('visit_time_in');
      return sendJson(res, 200, visit);
    }

    if (pathname.match(/^\/api\/visits\/\d+\/food$/) && req.method === 'POST') {
      const visitId = Number(pathname.split('/')[3]);
      const body = await readBody(req);
      const visit = service.addFoodToVisit(visitId, Number(body.productId), Number(body.qty));
      broadcastUpdate('visit_food_updated');
      return sendJson(res, 200, visit);
    }

    if (pathname.match(/^\/api\/visits\/\d+\/food\/\d+$/) && req.method === 'DELETE') {
      const parts = pathname.split('/');
      const visitId = Number(parts[3]);
      const itemId = Number(parts[5]);
      const visit = service.removeFoodItemFromVisit(visitId, itemId);
      broadcastUpdate('visit_food_updated');
      return sendJson(res, 200, visit);
    }

    if (pathname.match(/^\/api\/visits\/\d+\/preview$/) && req.method === 'GET') {
      const visitId = Number(pathname.split('/')[3]);
      const preview = service.previewVisitCheckout(visitId);
      return sendJson(res, 200, preview);
    }

    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await readBody(req);
      const sale = service.recordSale(body);
      broadcastUpdate('sale_recorded');
      return sendJson(res, 200, sale);
    }

    if (pathname === '/api/expenses' && req.method === 'POST') {
      const body = await readBody(req);
      const exp = service.addExpense(body);
      broadcastUpdate('expense_added');
      return sendJson(res, 200, exp);
    }

    if (pathname === '/api/ledger' && req.method === 'GET') {
      const datePrefix = urlObj.searchParams.get('period') || undefined;
      const summary = service.getLedgerSummary(datePrefix);
      return sendJson(res, 200, {
        ...summary,
        csvFiles: listCsvFiles(),
        backups: listBackups(db),
      });
    }

    if (pathname === '/api/shifts/open' && req.method === 'POST') {
      const body = await readBody(req);
      const shift = service.openShift(body.openedBy || 'Staff', Number(body.openingCash || 0));
      broadcastUpdate('shift_updated');
      return sendJson(res, 200, shift);
    }

    if (pathname === '/api/shifts/close' && req.method === 'POST') {
      const body = await readBody(req);
      const result = service.closeShift(body.closedBy || 'Staff', Number(body.countedCash || 0), body.notes);
      broadcastUpdate('shift_updated');
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await readBody(req);
      const prod = service.saveProduct(body);
      broadcastUpdate('products_updated');
      return sendJson(res, 200, prod);
    }

    if (pathname === '/api/customers' && req.method === 'POST') {
      const body = await readBody(req);
      const cust = service.createOrUpdateCustomer(body);
      broadcastUpdate('customers_updated');
      return sendJson(res, 200, cust);
    }

    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      const current = getSettings(db);
      const updated = saveSettings(db, { ...current, ...body });
      broadcastUpdate('settings_updated');
      return sendJson(res, 200, updated);
    }

    if (pathname === '/api/settings/qrph' && req.method === 'POST') {
      const body = await readBody(req);
      const dataUrl: string = body.dataUrl || '';
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,(.+)$/);
      if (!match) {
        return sendJson(res, 400, { error: 'Please upload a valid PNG, JPG, WEBP, or SVG image.' });
      }
      const ext = match[1] === 'svg+xml' ? 'svg' : match[1] === 'jpeg' ? 'jpg' : match[1];
      const buf = Buffer.from(match[2], 'base64');
      const fileName = `qrph_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buf);

      const current = getSettings(db);
      const updated = saveSettings(db, { ...current, qrPhImageUrl: `/uploads/${fileName}` });
      broadcastUpdate('settings_updated');
      return sendJson(res, 200, updated);
    }

    if (pathname === '/api/backups/create' && req.method === 'POST') {
      const bk = createDatabaseBackup(db, 'manual');
      return sendJson(res, 200, bk);
    }

    if (pathname === '/api/auth/verify-pin' && req.method === 'POST') {
      const body = await readBody(req);
      const row = db
        .prepare("SELECT id, name, role FROM staff WHERE pin = ? AND active = 1 LIMIT 1")
        .get(String(body.pin || '')) as { id: number; name: string; role: string } | undefined;
      if (!row) {
        return sendJson(res, 401, { valid: false, error: 'Invalid PIN' });
      }
      return sendJson(res, 200, { valid: true, staff: row });
    }

    // Serve built frontend in production
    const webDist = path.resolve(process.cwd(), 'dist', 'web');
    if (fs.existsSync(webDist)) {
      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const candidate = path.resolve(webDist, relPath);
      if (isPathInside(webDist, candidate) && serveStaticFile(res, candidate, pathname)) return;
      if (serveStaticFile(res, path.join(webDist, 'index.html'), '/index.html')) return;
    }

    return sendJson(res, 404, { error: `Route not found: ${pathname}` });
  } catch (err: any) {
    console.error('Server error:', err);
    return sendJson(res, 400, { error: err?.message || 'Unexpected error' });
  }
});

const webDistDir = path.resolve(process.cwd(), 'dist', 'web');

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalLanIps();
  console.log(`\n========================================================`);
  console.log(`  Study Corner POS + Ledger Hub Server is running!`);
  console.log(`  Local PC URL:   http://localhost:${PORT}`);
  for (const ip of ips) {
    console.log(`  Tablet/Phone:   http://${ip}:${PORT}`);
  }
  console.log(`  CSV & Backups:  ${DATA_DIR}`);
  if (!fs.existsSync(path.join(webDistDir, 'index.html'))) {
    console.warn(`  [WARN] dist/web not found. Run "npm run build" before serving in production.`);
  }
  console.log(`========================================================\n`);
});

function shutdown() {
  for (const client of sseClients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }
  sseClients.clear();
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
