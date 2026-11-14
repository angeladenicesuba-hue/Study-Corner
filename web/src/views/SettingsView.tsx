import React, { useState } from 'react';
import {
  QrCode,
  Upload,
  Save,
  Plus,
  HardDriveDownload,
  Smartphone,
  Utensils,
  DollarSign,
  CheckCircle2,
  MonitorSmartphone,
  Sun,
  Moon,
  Type,
  HelpCircle,
} from 'lucide-react';
import { AppSettings, Product } from '@shared/types';
import { api } from '../api';
import {
  loadUiPreferences,
  saveUiPreferences,
  ThemeMode,
  UI_SCALE_OPTIONS,
  UiPreferences,
  UiScale,
} from '../uiPrefs';

interface SettingsViewProps {
  settings: AppSettings;
  products: Product[];
  lanIps: string[];
  port: number;
  dataDir: string;
  onRefresh: () => void;
  onOpenDeviceStudio?: () => void;
  onOpenTutorial?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  iced_coffee: 'Coffee',
  non_coffee: 'Non-Coffee',
  lunch_dinner: 'Meals',
  other: 'Other',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  products,
  lanIps,
  port,
  dataDir,
  onRefresh,
  onOpenDeviceStudio,
  onOpenTutorial,
}) => {
  const [tab, setTab] = useState<'menu' | 'rates' | 'qr' | 'sync' | 'appearance'>('menu');
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>(() => loadUiPreferences());
  const [formSettings, setFormSettings] = useState<AppSettings>(settings);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'iced_coffee' | 'non_coffee' | 'lunch_dinner'>('iced_coffee');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [banner, setBanner] = useState('');

  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const updated = await api.uploadQrPh(reader.result);
        setFormSettings(updated);
        setBanner('QR Ph image updated across all checkouts.');
        onRefresh();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await api.saveSettings(formSettings);
    setFormSettings(updated);
    setBanner('Rates and membership pricing saved.');
    onRefresh();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    await api.saveProduct({
      name: newProdName.trim(),
      category: newProdCategory,
      price: Number(newProdPrice),
      active: 1,
    });
    setNewProdName('');
    setNewProdPrice('');
    setBanner('Menu item added.');
    onRefresh();
  };

  const handleToggleProduct = async (p: Product) => {
    await api.saveProduct({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      active: p.active ? 0 : 1,
    });
    onRefresh();
  };

  const handleUpdateProductPrice = async (p: Product, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    await api.saveProduct({
      id: p.id,
      name: p.name,
      category: p.category,
      price: newPrice,
      active: p.active,
    });
    onRefresh();
  };

  const handleCreateBackup = async () => {
    const res = await api.createBackup();
    setBanner(`Backup saved (${res.fileName}).`);
    onRefresh();
  };

  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result === 'string') {
          api.importLocalBackup(reader.result);
          setBanner('Backup restored.');
          onRefresh();
        }
      } catch (err: any) {
        setBanner(err?.message || 'Could not restore backup file.');
      }
    };
    reader.readAsText(file);
  };

  const offlineStats = api.getOfflineStats();

  const handleThemeChange = (theme: ThemeMode) => {
    const next = saveUiPreferences({ ...uiPrefs, theme });
    setUiPrefs(next);
    setBanner(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode.`);
  };

  const handleScaleChange = (scale: UiScale) => {
    const next = saveUiPreferences({ ...uiPrefs, scale });
    setUiPrefs(next);
    const label = UI_SCALE_OPTIONS.find((o) => o.id === scale)?.percent || '100%';
    setBanner(`UI & font size set to ${label}.`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setTab('menu');
              setBanner('');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'menu' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Utensils className="h-3.5 w-3.5" />
            <span>Menu ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('rates');
              setBanner('');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'rates' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Rates & Plans</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('qr');
              setBanner('');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'qr' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>QR Ph</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('sync');
              setBanner('');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'sync' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Sync & Backup</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('appearance');
              setBanner('');
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === 'appearance' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            <span>Appearance</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="mx-auto max-w-2xl flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-950">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{banner}</span>
        </div>
      )}

      {/* Tab 5: Appearance, Theme & UI Scale */}
      {tab === 'appearance' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Appearance & Readability</h2>
            <p className="text-xs text-slate-600">
              Choose Light or Dark Mode and adjust the UI & font size for your screen. Saved on this device.
            </p>
          </div>

          {/* Theme Mode */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Color Theme</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  uiPrefs.theme === 'light'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Light Mode</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  uiPrefs.theme === 'dark'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* UI & Font Scale */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">UI & Font Size</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {UI_SCALE_OPTIONS.map((opt) => {
                const active = uiPrefs.scale === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleScaleChange(opt.id)}
                    className={`rounded-xl border px-3 py-3 text-center transition ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className={`text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>{opt.percent}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tutorial Guide Replay */}
          {onOpenTutorial && (
            <div className="border-t border-slate-200 pt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">Opening Tutorial Guide</div>
                <p className="text-xs text-slate-600">
                  Review the quick step-by-step instructions for Time In, Food POS, Plans, and Ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenTutorial}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <span>Open Tutorial Guide</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Food & Drinks Menu Editor */}
      {tab === 'menu' && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Food & Drinks Menu</h2>
            <p className="text-xs text-slate-600">
              Add items, update prices inline, or hide unavailable items from the POS.
            </p>
          </div>

          <form onSubmit={handleAddProduct} className="flex flex-wrap items-end gap-2.5 border-b border-slate-100 pb-5">
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="new-prod-name" className="block text-xs font-semibold text-slate-700">
                Item Name
              </label>
              <input
                id="new-prod-name"
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. Pork Sisig w/ Egg"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="new-prod-cat" className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                id="new-prod-cat"
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value as any)}
                className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option value="iced_coffee">Coffee</option>
                <option value="non_coffee">Non-Coffee</option>
                <option value="lunch_dinner">Meals</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-prod-price" className="block text-xs font-semibold text-slate-700">
                Price (₱)
              </label>
              <input
                id="new-prod-price"
                type="number"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                placeholder="95"
                className="mt-1 w-24 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </form>

          <div className="divide-y divide-slate-100">
            {products.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between py-2.5 text-xs ${
                  p.active ? '' : 'opacity-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <label className="sr-only" htmlFor={`price-${p.id}`}>
                    Price for {p.name}
                  </label>
                  <input
                    id={`price-${p.id}`}
                    type="number"
                    defaultValue={p.price}
                    onBlur={(e) => handleUpdateProductPrice(p, Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-300 px-2.5 py-1 text-right font-bold text-slate-900"
                    title="Edit price (₱)"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleProduct(p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      p.active
                        ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {p.active ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Rates & Membership Pricing */}
      {tab === 'rates' && (
        <form
          onSubmit={handleSaveRates}
          className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rates & Membership Pricing</h2>
              <p className="text-xs text-slate-600">
                Adjust daily hourly tiers, multi-day study plans, and lifetime card fee.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 tabular-nums">
            {/* Hourly Tiers */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Daily Hourly Tiers (₱)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
                <span>Tier</span>
                <span>Walk-In</span>
                <span className="text-amber-900">Member</span>
              </div>
              {formSettings.tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-3 items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">{tier.label}</span>
                  <input
                    type="number"
                    aria-label={`${tier.label} Walk-In rate`}
                    value={tier.nonMember}
                    onChange={(e) => {
                      const next = [...formSettings.tiers];
                      next[idx] = { ...tier, nonMember: Number(e.target.value) || 0 };
                      setFormSettings({ ...formSettings, tiers: next });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900"
                  />
                  <input
                    type="number"
                    aria-label={`${tier.label} Member rate`}
                    value={tier.member}
                    onChange={(e) => {
                      const next = [...formSettings.tiers];
                      next[idx] = { ...tier, member: Number(e.target.value) || 0 };
                      setFormSettings({ ...formSettings, tiers: next });
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-2.5 py-1.5 font-bold text-amber-950"
                  />
                </div>
              ))}
            </div>

            {/* Study Plans & Lifetime Card */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Study Plans (₱)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
                <span>Package</span>
                <span>Walk-In</span>
                <span className="text-amber-900">Member</span>
              </div>
              {formSettings.plans.map((plan, idx) => (
                <div key={plan.type} className="grid grid-cols-3 items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">{plan.label}</span>
                  <input
                    type="number"
                    aria-label={`${plan.label} Walk-In rate`}
                    value={plan.nonMember}
                    onChange={(e) => {
                      const next = [...formSettings.plans];
                      next[idx] = { ...plan, nonMember: Number(e.target.value) || 0 };
                      setFormSettings({ ...formSettings, plans: next });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900"
                  />
                  <input
                    type="number"
                    aria-label={`${plan.label} Member rate`}
                    value={plan.member}
                    onChange={(e) => {
                      const next = [...formSettings.plans];
                      next[idx] = { ...plan, member: Number(e.target.value) || 0 };
                      setFormSettings({ ...formSettings, plans: next });
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-2.5 py-1.5 font-bold text-amber-950"
                  />
                </div>
              ))}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <label htmlFor="lifetime-card-fee" className="font-bold text-slate-800">
                  Lifetime Membership Card Fee (₱)
                </label>
                <input
                  id="lifetime-card-fee"
                  type="number"
                  value={formSettings.membershipCardPrice}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      membershipCardPrice: Number(e.target.value) || 0,
                    })
                  }
                  className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: QR Ph Image Uploader */}
      {tab === 'qr' && (
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Payment QR Ph Code</h2>
            <p className="text-xs text-slate-600">
              Displayed during checkout when customers pay via GCash, Maya, or banking apps.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 py-2">
            <img
              src={formSettings.qrPhImageUrl}
              alt="Current QR Ph"
              className="h-52 w-52 rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
            />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_2px_6px_rgba(37,99,235,0.2)] hover:bg-blue-700">
              <Upload className="h-4 w-4" />
              <span>Upload New QR Image (PNG / JPG)</span>
              <input type="file" accept="image/*" onChange={handleQrFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* Tab 4: Sync, LAN & Backups */}
      {tab === 'sync' && (
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Multi-Device Sync & Backups</h2>
            <p className="text-xs text-slate-600">
              Connect tablets or phones over local Wi-Fi and manage database backups.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-1.5 text-xs">
            <div className="font-bold text-slate-900">Tablet / Phone Wi-Fi Address</div>
            {lanIps.length > 0 ? (
              lanIps.map((ip) => (
                <div key={ip} className="font-mono text-sm font-bold text-blue-700">
                  http://{ip}:{port}
                </div>
              ))
            ) : (
              <div className="font-mono text-sm font-bold text-slate-800">http://localhost:{port}</div>
            )}
            <p className="text-slate-600">
              Open this URL in Chrome or Safari on your tablet/phone and choose "Add to Home Screen".
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3 text-xs tabular-nums">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
              <span>
                Cached Sales: <strong className="text-slate-900">{offlineStats.salesCount}</strong>
              </span>
              <span>
                Customers: <strong className="text-slate-900">{offlineStats.customersCount}</strong>
              </span>
              <span>
                Pending Sync: <strong className="text-blue-700">{offlineStats.pendingSyncCount}</strong>
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 break-all">
              Data Folder: {dataDir}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateBackup}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <HardDriveDownload className="h-4 w-4" />
                <span>Download Backup JSON</span>
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>Restore JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreBackupFile}
                  className="hidden"
                />
              </label>
              {onOpenDeviceStudio && (
                <button
                  type="button"
                  onClick={onOpenDeviceStudio}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  <MonitorSmartphone className="h-4 w-4 text-blue-600" />
                  <span>Preview Responsive Layouts</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
