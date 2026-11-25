import {
  ArrowUpRight,
  Mail,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  Utensils,
  Workflow,
} from 'lucide-react';
import type {
  CronRunResult,
  CronStepLog,
  EnrichedPantryItem,
  WeeklySummaryReport,
} from '../types/pantry';

interface AutomationTabProps {
  activeItems: EnrichedPantryItem[];
  expiringSoonItems: EnrichedPantryItem[];
  isRunningCron: boolean;
  activeCronStep: number;
  lastCronResult: CronRunResult | null;
  cronLogs: CronStepLog[];
  weeklySummary: WeeklySummaryReport | null;
  onRunCron: () => void;
  onLoadWeeklySummary: () => void;
}

export function AutomationTab({
  activeItems,
  expiringSoonItems,
  isRunningCron,
  activeCronStep,
  lastCronResult,
  cronLogs,
  weeklySummary,
  onRunCron,
  onLoadWeeklySummary,
}: AutomationTabProps) {
  const nodes = [
    {
      step: 1,
      title: '1. Schedule Trigger',
      subtitle: 'Diariamente às 00:00',
      desc: 'Inicia a verificação sem intervenção humana (RNF04).',
      color: 'border-emerald-500/40 bg-emerald-500/5',
    },
    {
      step: 2,
      title: '2. Supabase Query',
      subtitle: `Janela <= 5 dias (${expiringSoonItems.length} itens)`,
      desc: 'Filtra produtos ativos prestes a vencer na tabela despensa.',
      color: 'border-amber-500/40 bg-amber-500/5',
    },
    {
      step: 3,
      title: '3. Cross-Check Estoque',
      subtitle: `+${Math.max(0, activeItems.length - expiringSoonItems.length)} itens válidos`,
      desc: 'Busca os demais ingredientes do usuário para combinar.',
      color: 'border-sky-500/40 bg-sky-500/5',
    },
    {
      step: 4,
      title: '4. Gemini AI Curator',
      subtitle: 'JSON Schema Estruturado',
      desc: 'Cruza ingredientes e gera receitas rápidas anti-desperdício.',
      color: 'border-purple-500/40 bg-purple-500/5',
    },
    {
      step: 5,
      title: '5. Disparo Ativo Bot',
      subtitle: 'Telegram / WhatsApp',
      desc: 'Envia alerta com passo a passo e links para o usuário.',
      color: 'border-teal-500/40 bg-teal-500/5',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Workflow className="w-4 h-4" />
              Orquestração Conteinerizada em Docker (RF06, RF07, RF08 & RNF03)
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              Fluxo Agendado no n8n / Backend: Varredura Diária & Curadoria Multimodal
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onLoadWeeklySummary}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Mail className="w-4 h-4 text-sky-400" />
              Resumo Semanal (P2)
            </button>
            <button
              onClick={onRunCron}
              disabled={isRunningCron}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              {isRunningCron ? 'Executando Pipeline...' : 'Executar Cron Job Agora (00:00)'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {nodes.map((node) => {
            const isCurrent = activeCronStep === node.step;
            return (
              <div
                key={node.step}
                className={`p-4 rounded-xl border ${node.color} transition-all ${
                  isCurrent ? 'ring-2 ring-emerald-400 scale-[1.02]' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">{node.title}</span>
                  {isCurrent && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
                </div>
                <p className="text-[11px] font-mono text-emerald-300 mb-1.5">{node.subtitle}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{node.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Resultado da Curadoria de Receitas (Cruzamento Real)
            </h3>
            <span className="text-[11px] text-slate-400">
              Críticos atuais:{' '}
              {expiringSoonItems.map((i) => i.produto).join(', ') || 'Nenhum'}
            </span>
          </div>

          {lastCronResult ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span>{lastCronResult.aiData.resumo_alerta}</span>
                {lastCronResult.aiData.modelUsed && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300">
                    {lastCronResult.aiData.modelUsed}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {lastCronResult.aiData.receitas.map((r, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-emerald-400">{r.titulo}</h4>
                      <span className="text-xs text-slate-400 shrink-0">⏱️ {r.tempo_preparo}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.ingredientes_usados.map((ing, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                    <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside pt-1">
                      {r.passo_a_passo.map((st, sIdx) => (
                        <li key={sIdx}>{st}</li>
                      ))}
                    </ol>
                    <div className="pt-1">
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          r.termo_busca_link || r.titulo
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Ver referência de preparo</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-3">
              <Utensils className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Clique em <strong>&quot;Executar Cron Job Agora&quot;</strong> acima para varrer
                os itens que vencem em até 5 dias e cruzá-los via IA com o restante da despensa.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Logs de Execução do Pipeline
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  docker: smart_pantry_n8n
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-2.5 max-h-72 overflow-y-auto">
                {cronLogs.map((log, index) => (
                  <div
                    key={index}
                    className="border-b border-slate-900 pb-2 last:border-none last:pb-0"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span>
                        [{log.time}] <strong className="text-emerald-400">{log.node}</strong>
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          log.status === 'OK'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.status === 'WARN'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5">{log.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Isolamento de falhas por fila (RNF04)</span>
              <span className="text-emerald-400 font-semibold">SLA &lt; 10s (RNF01)</span>
            </div>
          </div>

          {weeklySummary && (
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-400" />
                  Prévia: Resumo Semanal por E-mail (Prioridade 2)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  Aproveitamento: {weeklySummary.wastePreventionRate}%
                </span>
              </div>
              <p className="text-xs font-semibold text-sky-300">{weeklySummary.emailSubject}</p>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                {weeklySummary.emailBodyMarkdown}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
