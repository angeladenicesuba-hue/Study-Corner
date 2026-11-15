import React, { useEffect, useState } from 'react';
import {
  Users,
  Utensils,
  BookOpen,
  Settings,
  AlertTriangle,
  HelpCircle,
  Download,
  X,
} from 'lucide-react';
import { SaleRecord } from '@shared/types';
import { isClosingSoon } from '@shared/billing';
import { api, BootstrapData, isServerOnline } from './api';
import { AppVersionInfo, checkForAppUpdate } from './updater';
import { StudySubTab, StudyView } from './views/StudyView';
import { FoodPosView } from './views/FoodPosView';
import { LedgerView } from './views/LedgerView';
import { SettingsView } from './views/SettingsView';
import { ReceiptModal } from './components/ReceiptModal';
import { TutorialModal, hasSeenTutorial } from './components/TutorialModal';

type SectionId = 'study' | 'food' | 'ledger' | 'settings';

function getInitialLocation(): { section: SectionId; subTab: StudySubTab } {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('section');
  if (s === 'plans') {
    return { section: 'study', subTab: 'plans' };
  }
  if (s === 'time_in' || s === 'whos_in') {
    return { section: 'study', subTab: 'whos_in' };
  }
  if (s === 'food' || s === 'ledger' || s === 'settings' || s === 'study') {
    return { section: s, subTab: 'whos_in' };
  }
  return { section: 'study', subTab: 'whos_in' };
}

export const App: React.FC = () => {
  const [initialLoc] = useState(getInitialLocation);
  const [section, setSection] = useState<SectionId>(initialLoc.section);
  const [studySubTab, setStudySubTab] = useState<StudySubTab>(initialLoc.subTab);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [staffName, setStaffName] = useState<string>('Front Desk');
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);
  const [connected, setConnected] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => !hasSeenTutorial());
  const [availableUpdate, setAvailableUpdate] = useState<AppVersionInfo | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState<boolean>(false);
  const [deviceStudio, setDeviceStudio] = useState<boolean>(() => {
    return new URLSearchParams(window.location.search).get('preview') === 'devices';
  });

  const loadBootstrap = async () => {
    const res = await api.getBootstrap();
    setData(res);
    setConnected(isServerOnline());
    setPendingSyncCount(api.getOfflineStats().pendingSyncCount);
  };

  useEffect(() => {
    loadBootstrap();
    checkForAppUpdate().then((res) => {
      if (res.hasUpdate && res.remote) {
        setAvailableUpdate(res.remote);
      }
    });

    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.onmessage = () => {
        loadBootstrap();
      };
      evtSource.onerror = () => {
        setConnected(false);
        setPendingSyncCount(api.getOfflineStats().pendingSyncCount);
      };
    } catch {
      setConnected(false);
    }

    const handleOnline = () => {
      api.syncNow().then(() => loadBootstrap());
    };
    const handleOffline = () => {
      setConnected(false);
      setPendingSyncCount(api.getOfflineStats().pendingSyncCount);
    };
    const handleStorage = () => {
      loadBootstrap();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorage);

    return () => {
      evtSource?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="text-base font-bold text-slate-900">Loading Study Corner POS...</div>
          <p className="mt-1 text-xs text-slate-600">Preparing local database</p>
        </div>
      </div>
    );
  }

  if (deviceStudio) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 space-y-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-lg font-bold">Study Corner — Responsive Device Preview</h1>
            <p className="text-xs text-slate-300">
              Desktop uses top navigation • Tablet & Phone use fixed bottom navigation
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['study', 'food', 'ledger', 'settings'] as SectionId[]).map((sec) => (
              <button
                key={sec}
                onClick={() => setSection(sec)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  section === sec ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {sec === 'food' ? 'Food POS' : sec}
              </button>
            ))}
            <button
              onClick={() => setDeviceStudio(false)}
              className="ml-2 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <X className="h-4 w-4" /> Exit Preview
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl space-y-10">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="mb-2 text-xs font-bold text-blue-300">Phone (375 × 740)</div>
              <div className="overflow-hidden rounded-[32px] border-[8px] border-slate-800 bg-slate-900 shadow-xl">
                <iframe title="Phone Preview" src={`/?section=${section}`} className="h-[740px] w-[375px] bg-white" />
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="mb-2 text-xs font-bold text-emerald-300">Tablet (768 × 740)</div>
              <div className="overflow-hidden rounded-[24px] border-[8px] border-slate-800 bg-slate-900 shadow-xl w-full max-w-[768px]">
                <iframe title="Tablet Preview" src={`/?section=${section}`} className="h-[740px] w-full bg-white" />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-2 text-xs font-bold text-amber-300">Desktop (1280 × 720)</div>
            <div className="w-full overflow-hidden rounded-2xl border-[8px] border-slate-800 bg-slate-900 shadow-xl">
              <iframe title="Desktop Preview" src={`/?section=${section}`} className="h-[720px] w-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{
    id: SectionId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'study',
      label: 'Study',
      icon: <Users className="h-4 w-4" />,
      badge: data.activeVisits.length,
    },
    {
      id: 'food',
      label: 'Food POS',
      icon: <Utensils className="h-4 w-4" />,
    },
    {
      id: 'ledger',
      label: 'Ledger',
      icon: <BookOpen className="h-4 w-4" />,
    },
  ];

  const closingSoon = isClosingSoon(new Date(), data.settings.closeHour);

  return (
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-12">
      {/* Clean, Calm Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-3">
          {/* Brand & Sync Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="Study Corner Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-0.5"
            />
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-base sm:text-xl font-bold tracking-tight text-slate-900">
                {data.settings.shopName}
              </span>
              <span
                title={
                  connected
                    ? 'Connected to local hub & backed up in browser storage'
                    : 'Running in offline browser storage'
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium text-slate-700"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    connected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="hidden sm:inline">{connected ? 'Synced' : 'Offline'}</span>
                {pendingSyncCount > 0 && (
                  <span className="font-bold text-amber-800 tabular-nums">
                    ({pendingSyncCount})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                        active ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Staff Indicator + Quick Guide + Top-Right Settings */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="staff-name-input" className="hidden md:inline text-sm font-medium text-slate-600">
              Staff:
            </label>
            <input
              id="staff-name-input"
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              aria-label="Staff Name"
              className="w-20 sm:w-28 rounded-xl border border-slate-300 bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              title="Open Quick Guide"
              aria-label="Open Quick Guide"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSection(section === 'settings' ? 'study' : 'settings')}
              title="Settings"
              aria-label="Settings"
              aria-pressed={section === 'settings'}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                section === 'settings'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* In-App APK Update Banner (shown only when a newer build is on GitHub Releases) */}
      {availableUpdate && !dismissedUpdate && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-950">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              New Study Corner POS update available (Build #{availableUpdate.buildNumber}).
            </span>
            <div className="flex items-center gap-2">
              <a
                href={availableUpdate.apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Update APK</span>
              </a>
              <button
                type="button"
                onClick={() => setDismissedUpdate(true)}
                aria-label="Dismiss update banner"
                className="rounded-lg p-1 text-emerald-800 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8:45 PM Closing Reminder Banner */}
      {closingSoon && data.activeVisits.length > 0 && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-950">
          <AlertTriangle className="mr-1.5 inline h-4 w-4 text-amber-700" />
          Shop closes at 9:00 PM — {data.activeVisits.length} active session(s) still checked in.
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-4 pt-6">
        {section === 'study' && (
          <StudyView
            subTab={studySubTab}
            onSubTabChange={setStudySubTab}
            visits={data.activeVisits}
            products={data.products}
            settings={data.settings}
            customers={data.customers}
            planSubs={data.planSubs}
            staffName={staffName}
            onRefresh={loadBootstrap}
            onSaleCompleted={(sale) => {
              setLastSale(sale);
              loadBootstrap();
            }}
          />
        )}

        {section === 'food' && (
          <FoodPosView
            products={data.products}
            settings={data.settings}
            staffName={staffName}
            activeVisits={data.activeVisits}
            onSaleCompleted={(sale) => {
              setLastSale(sale);
              loadBootstrap();
            }}
            onTabUpdated={loadBootstrap}
          />
        )}

        {section === 'ledger' && <LedgerView staffName={staffName} />}

        {section === 'settings' && (
          <SettingsView
            settings={data.settings}
            products={data.products}
            lanIps={data.lanIps}
            port={data.port}
            dataDir={data.dataDir}
            onRefresh={loadBootstrap}
            onOpenDeviceStudio={() => setDeviceStudio(true)}
            onOpenTutorial={() => setShowTutorial(true)}
          />
        )}
      </main>

      {/* Tablet & Phone Fixed Bottom Navigation Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-3 py-2 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] lg:hidden"
        aria-label="Mobile Navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1.5 transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`absolute right-1.5 top-1 rounded-full px-1.5 py-0.2 text-[11px] font-bold tabular-nums ${
                      active ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
                <span className="mt-1.5 text-xs font-semibold leading-none tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {lastSale && (
        <ReceiptModal
          sale={lastSale}
          settings={data.settings}
          onClose={() => setLastSale(null)}
        />
      )}

      {showTutorial && (
        <TutorialModal
          settings={data.settings}
          onNavigate={(sec) => {
            if (sec === 'plans') {
              setSection('study');
              setStudySubTab('plans');
            } else if (sec === 'whos_in' || sec === 'time_in') {
              setSection('study');
              setStudySubTab('whos_in');
            } else {
              setSection(sec);
            }
          }}
          onClose={() => setShowTutorial(false)}
        />
      )}
    </div>
  );
};
