import { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import {
  ANTIGRAVITY_MASTER_PROMPT,
  DOCKER_COMPOSE_CONFIG,
  FIVE_W_TWO_H_ROWS,
  SCHEDULE_ROWS,
  SUPABASE_SQL_SCHEMA,
} from '../data/planningContent';

export function PlanningHubTab() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* GUIA DE CHAVE GEMINI + CONTA GOOGLE AI PRO */}
      <div className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-slate-900 border border-sky-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              Integração Gemini API + Assinatura Google AI Pro (RNF05)
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Como vincular os benefícios da sua conta Google AI Pro à chave GEMINI_API_KEY
            </h2>
            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
              <li>
                Acesse o <strong>Google AI Studio</strong> com a mesma conta Google onde sua
                assinatura <strong>Google AI Pro</strong> está ativa.
              </li>
              <li>
                No menu lateral do AI Studio, resgate seus{' '}
                <strong>créditos mensais de desenvolvedor</strong> (inclusos no plano Pro) e
                gere sua chave em <strong>Get API Key</strong> (também funciona no Free Tier!).
              </li>
              <li>
                Cole a chave em <code className="text-emerald-300">GEMINI_API_KEY=...</code> no
                arquivo <code className="text-emerald-300">.env</code> do backend — ela nunca é
                exposta no navegador.
              </li>
            </ol>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 transition"
          >
            <span>Abrir Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* MASTER PROMPT ANTIGRAVITY */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Pronto para Copiar e Colar no Antigravity
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              Master Prompt Contextualizado (Full-Stack + Arquitetura Real)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Prompt refinado com contrato REST, segurança RNF05 no backend, SDK @google/genai,
              parser DD/MM/AAAA &amp; MM/AAAA, Supabase + fallback local, Docker, n8n e critérios de
              verificação.
            </p>
          </div>
          <button
            onClick={() => handleCopy(ANTIGRAVITY_MASTER_PROMPT, 'master-prompt')}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 transition cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            {copiedId === 'master-prompt' ? (
              <>
                <Check className="w-4 h-4" />
                <span>Prompt Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Prompt Antigravity</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-200/90 overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
          {ANTIGRAVITY_MASTER_PROMPT}
        </pre>
      </div>

      {/* ARTEFATOS DE INFRAESTRUTURA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Script SQL DDL — Supabase PostgreSQL
              </h3>
              <p className="text-[11px] text-slate-400">
                Tabelas usuarios, despensa, logs_notificacoes, índices, view e RLS
              </p>
            </div>
            <button
              onClick={() => handleCopy(SUPABASE_SQL_SCHEMA, 'sql-schema')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {copiedId === 'sql-schema' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === 'sql-schema' ? 'Copiado' : 'Copiar SQL'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 flex-1">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                docker-compose.yml — Backend + Frontend + n8n
              </h3>
              <p className="text-[11px] text-slate-400">
                Conteinerização completa e padronizada (RNF03 e RNF05)
              </p>
            </div>
            <button
              onClick={() => handleCopy(DOCKER_COMPOSE_CONFIG, 'docker-yml')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              {copiedId === 'docker-yml' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === 'docker-yml' ? 'Copiado' : 'Copiar Docker'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 flex-1">
            {DOCKER_COMPOSE_CONFIG}
          </pre>
        </div>
      </div>

      {/* MATRIZ IMPACTO X ESFORÇO, 5W2H E CRONOGRAMA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Governança e Planejamento Executivo
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Matriz Impacto x Esforço, Plano 5W2H e Cronograma de 6 Meses
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
              Prioridade 1 • Quick Wins
            </span>
            <h4 className="text-xs font-bold text-white mt-2">Alto Impacto x Baixo Esforço</h4>
            <ul className="text-[11px] text-slate-300 mt-1.5 space-y-1 list-disc list-inside">
              <li>Bot Telegram/WhatsApp para fotos</li>
              <li>OCR de Produto e Validade (Gemini)</li>
              <li>Persistência PostgreSQL (Supabase)</li>
              <li>Cron Job diário + Receitas IA</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-400 text-slate-950">
              Prioridade 2 • Incrementos
            </span>
            <h4 className="text-xs font-bold text-white mt-2">Baixo Impacto x Baixo Esforço</h4>
            <ul className="text-[11px] text-slate-300 mt-1.5 space-y-1 list-disc list-inside">
              <li>Comandos /estoque e /consumido</li>
              <li>Resumo semanal por e-mail</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
              Backlog v2.0 • Estratégicos
            </span>
            <h4 className="text-xs font-bold text-white mt-2">Alto Impacto x Alto Esforço</h4>
            <ul className="text-[11px] text-slate-300 mt-1.5 space-y-1 list-disc list-inside">
              <li>App nativo Flutter / React Native</li>
              <li>Importação via QR Code NFC-e</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-600 text-white">
              Fora de Escopo • Evitar
            </span>
            <h4 className="text-xs font-bold text-white mt-2">Baixo Impacto x Alto Esforço</h4>
            <ul className="text-[11px] text-slate-400 mt-1.5 space-y-1 list-disc list-inside">
              <li>Recompra automática em mercados</li>
              <li>Rede social própria de receitas</li>
            </ul>
          </div>
        </div>

        {/* MATRIZ 5W2H */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="py-2.5 px-3">What (O quê?)</th>
                <th className="py-2.5 px-3">Why (Por quê?)</th>
                <th className="py-2.5 px-3">Where (Onde?)</th>
                <th className="py-2.5 px-3">When</th>
                <th className="py-2.5 px-3">How (Como?)</th>
                <th className="py-2.5 px-3">How Much</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {FIVE_W_TWO_H_ROWS.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-3 font-semibold text-white">{row.what}</td>
                  <td className="py-2.5 px-3">{row.why}</td>
                  <td className="py-2.5 px-3">{row.where}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-emerald-300 font-medium">
                    {row.when}
                  </td>
                  <td className="py-2.5 px-3">{row.how}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-amber-300">
                    {row.howMuch}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CRONOGRAMA 6 MESES */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="py-2.5 px-3">Fase / Entrega do Semestre</th>
                {['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'].map((m) => (
                  <th key={m} className="py-2.5 px-3 text-center">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {SCHEDULE_ROWS.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-3 font-medium text-white">{row.fase}</td>
                  {row.m.map((active, mIdx) => (
                    <td key={mIdx} className="py-2.5 px-3 text-center">
                      {active ? (
                        <span className="inline-block w-5 h-5 leading-5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                          X
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
