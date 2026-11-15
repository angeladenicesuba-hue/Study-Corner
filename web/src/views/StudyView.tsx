import React from 'react';
import { Users, CreditCard } from 'lucide-react';
import { AppSettings, Customer, PlanSub, Product, SaleRecord, Visit } from '@shared/types';
import { WhosInView } from './WhosInView';
import { PlansView } from './PlansView';

export type StudySubTab = 'whos_in' | 'plans';

interface StudyViewProps {
  subTab: StudySubTab;
  onSubTabChange: (tab: StudySubTab) => void;
  visits: Visit[];
  products: Product[];
  settings: AppSettings;
  customers: Customer[];
  planSubs: PlanSub[];
  staffName: string;
  onRefresh: () => void;
  onSaleCompleted: (sale: SaleRecord) => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  subTab,
  onSubTabChange,
  visits,
  products,
  settings,
  customers,
  planSubs,
  staffName,
  onRefresh,
  onSaleCompleted,
}) => {
  const tabs: Array<{
    id: StudySubTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'whos_in',
      label: "Who's In",
      icon: <Users className="h-4 w-4" />,
      badge: visits.length,
    },
    {
      id: 'plans',
      label: 'Plans & Members',
      icon: <CreditCard className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Centered 2-Tab Sub-Navigation Bar */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Study Desk Sections"
          className="inline-flex flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          {tabs.map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSubTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : tab.badge > 0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sub-View */}
      {subTab === 'whos_in' && (
        <WhosInView
          visits={visits}
          products={products}
          settings={settings}
          customers={customers}
          planSubs={planSubs}
          staffName={staffName}
          onRefresh={onRefresh}
          onSaleCompleted={onSaleCompleted}
          hideHeader
        />
      )}

      {subTab === 'plans' && (
        <PlansView
          settings={settings}
          customers={customers}
          planSubs={planSubs}
          staffName={staffName}
          onSaleCompleted={onSaleCompleted}
          onCheckedIn={() => {
            onRefresh();
            onSubTabChange('whos_in');
          }}
        />
      )}
    </div>
  );
};
