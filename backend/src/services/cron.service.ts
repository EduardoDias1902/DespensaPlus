import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import type {
  CronRunResult,
  CronStepLog,
  EnrichedPantryItem,
  RecipeCuratorOutput,
  WeeklySummaryReport,
} from '../types/pantry.js';
import { formatTimeNow, formatTimeWithSeconds } from '../utils/date.js';
import { botService } from './bot.service.js';
import { geminiService } from './gemini.service.js';
import { pantryRepository } from './pantry.repository.js';

function formatAlertMarkdown(
  expiringItems: EnrichedPantryItem[],
  aiData: RecipeCuratorOutput
): string {
  const headerItems = expiringItems
    .map((item) => `• *${item.produto}* — vence em ${item.diasRestantes} dia(s) (${item.data_validade})`)
    .join('\n');

  const recipesText = aiData.receitas
    .map((rec, idx) => {
      const steps = rec.passo_a_passo.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
      const link = `https://www.google.com/search?q=${encodeURIComponent(
        rec.termo_busca_link || rec.titulo
      )}`;
      return `🍲 *${idx + 1}. ${rec.titulo}* (${rec.tempo_preparo})\nIngredientes: ${rec.ingredientes_usados.join(
        ', '
      )}\n${steps}\n💡 _${rec.dica_nutricional}_\n🔗 Passo a passo: ${link}`;
    })
    .join('\n\n');

  return `⚠️ *Alerta Inteligente de Despensa*\n\n${aiData.resumo_alerta}\n\n📦 *Itens Prioritários:*\n${headerItems}\n\n${recipesText}`;
}

class CronService {
  private scheduledTask: ScheduledTask | null = null;
  private lastRun: CronRunResult | null = null;

  startScheduler(): void {
    if (!env.CRON_ENABLED) {
      console.log('[CronService] Agendador automático desativado via CRON_ENABLED=false.');
      return;
    }

    if (!cron.validate(env.CRON_SCHEDULE)) {
      console.warn(`[CronService] Expressão cron inválida: ${env.CRON_SCHEDULE}`);
      return;
    }

    this.scheduledTask = cron.schedule(
      env.CRON_SCHEDULE,
      async () => {
        console.log('[CronService] Iniciando varredura diária agendada (RF06)...');
        await this.runForAllUsers('node_cron_00h00', true);
      },
      { timezone: env.TZ }
    );

    console.log(
      `[CronService] Cron job ativo em "${env.CRON_SCHEDULE}" (Timezone: ${env.TZ}).`
    );
  }

  stopScheduler(): void {
    this.scheduledTask?.stop();
    this.scheduledTask = null;
  }

  getLastRun(): CronRunResult | null {
    return this.lastRun;
  }

  /**
   * RNF04 — Isolamento de falhas por usuário: o erro no disparo de um usuário
   * não interrompe o processamento da fila dos demais.
   */
  async runForAllUsers(
    source = 'manual_trigger',
    dispatchExternal = false
  ): Promise<CronRunResult[]> {
    const chatIds = await pantryRepository.listUsersChatIds();
    const results: CronRunResult[] = [];

    for (const chatId of chatIds) {
      try {
        const res = await this.runForUser(chatId, source, dispatchExternal);
        results.push(res);
      } catch (err) {
        console.error(`[CronService] Erro isolado para usuário ${chatId} (RNF04):`, err);
      }
    }

    return results;
  }

  async runForUser(
    chatId = env.DEFAULT_USER_CHAT_ID,
    source = 'manual_trigger',
    dispatchExternal = false
  ): Promise<CronRunResult> {
    const startedAt = Date.now();
    const logs: CronStepLog[] = [];

    logs.push({
      time: formatTimeWithSeconds(),
      node: 'Schedule Trigger (RF06)',
      status: 'OK',
      detail: `Pipeline iniciado via ${source} para usuário ${chatId}`,
    });

    const allItems = await pantryRepository.listItems(chatId);
    const activeItems = allItems
      .filter((i) => i.computedStatus === 'Em estoque')
      .sort((a, b) => a.diasRestantes - b.diasRestantes);

    const expiringSoon = activeItems.filter(
      (i) => i.diasRestantes >= 0 && i.diasRestantes <= env.ALERT_WINDOW_DAYS
    );

    const targetExpiring =
      expiringSoon.length > 0 ? expiringSoon : activeItems.slice(0, 2);

    const otherValid = activeItems.filter(
      (item) => !targetExpiring.some((exp) => exp.id === item.id)
    );

    logs.push({
      time: formatTimeWithSeconds(),
      node: `Repository Filter (${pantryRepository.storageMode})`,
      status: 'OK',
      detail:
        expiringSoon.length > 0
          ? `${expiringSoon.length} item(ns) na janela crítica <= ${env.ALERT_WINDOW_DAYS}d: ${expiringSoon
              .map((i) => i.produto)
              .join(', ')}`
          : `Nenhum item <= ${env.ALERT_WINDOW_DAYS}d; usando os ${targetExpiring.length} mais próximos do vencimento para simulação`,
    });

    logs.push({
      time: formatTimeWithSeconds(),
      node: 'Cross-Check Despensa',
      status: 'OK',
      detail: `Cruzando com ${otherValid.length} ingrediente(s) válidos disponíveis na despensa`,
    });

    const aiData = await geminiService.curateAntiWasteRecipes(
      targetExpiring,
      otherValid
    );

    logs.push({
      time: formatTimeWithSeconds(),
      node: `Gemini Curator (${aiData.modelUsed})`,
      status: aiData.aiMode === 'gemini' ? 'OK' : 'WARN',
      detail: `${aiData.receitas.length} receita(s) geradas em ${(aiData.latencyMs / 1000).toFixed(
        2
      )}s (modo: ${aiData.aiMode})`,
    });

    const formattedMarkdown = formatAlertMarkdown(targetExpiring, aiData);
    const dispatchedChannels: string[] = ['web-dashboard'];

    if (dispatchExternal) {
      try {
        const sentTelegram = await botService.sendTelegramMessage(
          chatId,
          formattedMarkdown
        );
        if (sentTelegram) dispatchedChannels.push('telegram');
      } catch (err) {
        logs.push({
          time: formatTimeWithSeconds(),
          node: 'Telegram Dispatch (RNF04)',
          status: 'WARN',
          detail: `Falha isolada no Telegram: ${err instanceof Error ? err.message : 'Erro'}`,
        });
      }

      try {
        const sentWa = await botService.sendWhatsAppMessage(chatId, formattedMarkdown);
        if (sentWa) dispatchedChannels.push('whatsapp');
      } catch (err) {
        logs.push({
          time: formatTimeWithSeconds(),
          node: 'WhatsApp Dispatch (RNF04)',
          status: 'WARN',
          detail: `Falha isolada no WhatsApp: ${err instanceof Error ? err.message : 'Erro'}`,
        });
      }
    }

    const totalLatencyMs = Date.now() - startedAt;
    logs.push({
      time: formatTimeWithSeconds(),
      node: 'Disparo Ativo Bot (RF08)',
      status: 'OK',
      detail: `Canais: ${dispatchedChannels.join(', ')} • Latência total: ${(
        totalLatencyMs / 1000
      ).toFixed(2)}s (SLA < 10s RNF01)`,
    });

    await pantryRepository.saveNotificationAudit({
      chatId,
      canal: dispatchedChannels.join(','),
      expiringItems: targetExpiring,
      receitas: aiData.receitas,
      statusEnvio: aiData.aiMode === 'gemini' ? 'OK' : 'FALLBACK',
      latencyMs: totalLatencyMs,
      logs,
    });

    const result: CronRunResult = {
      timestamp: formatTimeNow(),
      source,
      chatId,
      expiringCount: targetExpiring.length,
      otherCount: otherValid.length,
      expiringItems: targetExpiring,
      aiData,
      formattedMarkdown,
      dispatchedChannels,
      logs,
      totalLatencyMs,
    };

    this.lastRun = result;
    return result;
  }

  /**
   * Prioridade 2 da Matriz Impacto x Esforço: Resumo Semanal para envio opcional por e-mail.
   */
  async buildWeeklySummary(
    chatId = env.DEFAULT_USER_CHAT_ID
  ): Promise<WeeklySummaryReport> {
    const items = await pantryRepository.listItems(chatId);
    const active = items.filter((i) => i.computedStatus === 'Em estoque');
    const expiringSoon = active
      .filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
    const consumed = items.filter((i) => i.computedStatus === 'Consumido');
    const expired = items.filter((i) => i.computedStatus === 'Vencido');

    const closedTotal = consumed.length + expired.length;
    const wastePreventionRate =
      closedTotal > 0 ? Math.round((consumed.length / closedTotal) * 100) : 100;

    const lines =
      expiringSoon.length > 0
        ? expiringSoon
            .map((i) => `- ${i.produto} (${i.categoria}): vence em ${i.diasRestantes} dia(s) [${i.data_validade}]`)
            .join('\n')
        : '- Nenhum item vence nos próximos 7 dias. Excelente gestão!';

    const emailSubject = `[Smart Pantry] Resumo Semanal: ${expiringSoon.length} item(ns) na janela de atenção`;
    const emailBodyMarkdown = `Olá!\n\nAqui está o resumo semanal da sua despensa inteligente:\n\n• Itens ativos em estoque: ${active.length}\n• Itens vencendo nos próximos 7 dias: ${expiringSoon.length}\n• Itens consumidos antes do vencimento: ${consumed.length}\n• Itens vencidos: ${expired.length}\n• Índice de aproveitamento: ${wastePreventionRate}%\n\nPrioridades da semana:\n${lines}\n\nEnvie /alerta no bot para receber receitas personalizadas com esses ingredientes.`;

    return {
      generatedAt: new Date().toISOString(),
      totalActive: active.length,
      expiringSoonCount: expiringSoon.length,
      consumedCount: consumed.length,
      expiredCount: expired.length,
      wastePreventionRate,
      expiringSoonItems: expiringSoon,
      emailSubject,
      emailBodyMarkdown,
    };
  }
}

export const cronService = new CronService();
