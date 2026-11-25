import {
  AlertTriangle,
  Clock,
  Database,
  FileCode,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Wifi,
  WifiOff,
  Workflow,
} from 'lucide-react';
import type { ActiveTab, HealthStatus } from '../types/pantry';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  inventoryCount: number;
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  isRunningCron: boolean;
  onRunCron: () => void;
  backendOnline: boolean;
  health: HealthStatus | null;
}

export function Header({
  activeTab,
  onSelectTab,
  inventoryCount,
  activeCount,
  expiringSoonCount,
  expiredCount,
  isRunningCron,
  onRunCron,
  backendOnline,
  health,
}: HeaderProps) {
  const tabs: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof MessageSquare;
    badge: string;
  }> = [
    { id: 'bot', label: '1. Bot & Gemini OCR (Chat)', icon: MessageSquare, badge: 'RF01-RF05' },
    {
      id: 'supabase',
      label: '2. Despensa Supabase (PostgreSQL)',
      icon: Database,
      badge: `${inventoryCount} itens`,
    },
    { id: 'n8n', label: '3. Motor n8n & Receitas IA (00:00)', icon: Workflow, badge: 'RF06-RF08' },
    {
      id: 'antigravity',
      label: '4. Planejamento & Prompt Antigravity',
      icon: FileCode,
      badge: 'Master Prompt',
    },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/75 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <ShoppingBag className="w-6 h-6 text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Smart Pantry Assistant
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                MVP Full-Stack
              </span>
              {backendOnline ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <Wifi className="w-3 h-3" />
                  API Live • {health?.geminiConfigured ? `Gemini (${health.geminiModel})` : 'IA Demo'} •{' '}
                  {health?.storageMode === 'supabase' ? 'Supabase' : 'JSON Local'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <WifiOff className="w-3 h-3" />
                  Modo Demonstração Offline
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Bot Telegram/WhatsApp + Gemini Vision OCR (Backend Seguro) + n8n Cron + Supabase PostgreSQL
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/70 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Em Estoque:</span>
            <span className="font-bold text-white">{activeCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-200/80">Vencendo &le; 5d:</span>
            <span className="font-bold text-amber-400">{expiringSoonCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-200/80">Vencidos:</span>
            <span className="font-bold text-rose-400">{expiredCount}</span>
          </div>
          <button
            onClick={onRunCron}
            disabled={isRunningCron}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isRunningCron ? 'Cruzando Estoque...' : 'Simular Cron 00:00'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto no-scrollbar border-t border-slate-800/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
