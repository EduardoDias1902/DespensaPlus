import { env } from '../config/env.js';
import type { EnrichedPantryItem } from '../types/pantry.js';
import { pantryRepository } from './pantry.repository.js';

export interface CommandExecutionResult {
  handled: boolean;
  action: 'estoque' | 'consumido' | 'alerta' | 'resumo' | 'ajuda';
  replyText: string;
  updatedItem?: EnrichedPantryItem;
  triggerCron?: boolean;
}

class BotService {
  /**
   * RF05 — Processa comandos rápidos de chat (/estoque, /consumido <id|nome>, /alerta, /resumo)
   */
  async handleTextCommand(
    rawText: string,
    chatId = env.DEFAULT_USER_CHAT_ID
  ): Promise<CommandExecutionResult> {
    const text = rawText.trim();
    const lower = text.toLowerCase();

    if (lower === '/estoque' || lower.startsWith('/estoque ')) {
      const items = await pantryRepository.listItems(chatId);
      const active = items
        .filter((item) => item.computedStatus === 'Em estoque')
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      if (active.length === 0) {
        return {
          handled: true,
          action: 'estoque',
          replyText:
            '📋 Sua despensa ativa está vazia no momento. Envie uma foto de embalagem para cadastrar um item via Gemini OCR!',
        };
      }

      const lines = active.map((i) => {
        const icon = i.diasRestantes <= env.ALERT_WINDOW_DAYS ? '⚠️' : '🟢';
        return `${icon} **#${i.id} ${i.produto}** — Vence: ${i.data_validade} (${i.diasRestantes}d)`;
      });

      return {
        handled: true,
        action: 'estoque',
        replyText: `📋 **Itens em Estoque (${active.length}):**\n\n${lines.join(
          '\n'
        )}\n\n💡 _Para dar baixa em um item específico, envie_ \`/consumido <id>\` _(ex:_ \`/consumido ${active[0].id}\`_) ou apenas_ \`/consumido\` _para baixar o mais próximo do vencimento._`,
      };
    }

    if (lower === '/consumido' || lower.startsWith('/consumido ')) {
      const argument = text.slice('/consumido'.length).trim();
      const items = await pantryRepository.listItems(chatId);
      const active = items
        .filter((item) => item.computedStatus === 'Em estoque')
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      if (active.length === 0) {
        return {
          handled: true,
          action: 'consumido',
          replyText: 'Não há itens ativos em estoque para dar baixa no momento.',
        };
      }

      let target: EnrichedPantryItem | undefined;
      if (!argument) {
        target = active[0];
      } else if (/^#?\d+$/.test(argument)) {
        const parsedId = Number(argument.replace('#', ''));
        target = active.find((i) => i.id === parsedId);
      } else {
        const query = argument.toLowerCase();
        target = active.find((i) => i.produto.toLowerCase().includes(query));
      }

      if (!target) {
        return {
          handled: true,
          action: 'consumido',
          replyText: `❌ Não encontrei nenhum item ativo correspondente a "${argument}". Envie \`/estoque\` para ver os IDs disponíveis.`,
        };
      }

      const updated = await pantryRepository.updateItemStatus(target.id, 'Consumido');
      return {
        handled: true,
        action: 'consumido',
        updatedItem: updated ?? target,
        replyText: `🍽️ **Baixa registrada com sucesso (RF05)!**\nO item **#${target.id} ${target.produto}** foi marcado como **Consumido** e não entrará mais nos alertas de vencimento.`,
      };
    }

    if (lower === '/alerta' || lower.includes('receita')) {
      return {
        handled: true,
        action: 'alerta',
        triggerCron: true,
        replyText:
          '⏳ Acionando pipeline de curadoria de receitas (RF06/RF07) para cruzar seus itens críticos com o estoque...',
      };
    }

    if (lower === '/resumo') {
      const items = await pantryRepository.listItems(chatId);
      const active = items.filter((i) => i.computedStatus === 'Em estoque');
      const critical = active.filter(
        (i) => i.diasRestantes >= 0 && i.diasRestantes <= env.ALERT_WINDOW_DAYS
      );
      const consumed = items.filter((i) => i.computedStatus === 'Consumido');
      const expired = items.filter((i) => i.computedStatus === 'Vencido');

      return {
        handled: true,
        action: 'resumo',
        replyText: `📊 **Resumo da sua Despensa:**\n• 🟢 Em estoque: **${active.length}**\n• ⚠️ Vencendo em ≤ ${env.ALERT_WINDOW_DAYS} dias: **${critical.length}**\n• 🍽️ Consumidos (evitados): **${consumed.length}**\n• 🔴 Vencidos: **${expired.length}**`,
      };
    }

    return {
      handled: false,
      action: 'ajuda',
      replyText:
        '🤖 **Comandos disponíveis no Assistente de Despensa:**\n• Envie uma **foto** da embalagem para leitura automática via Gemini OCR\n• `/estoque` — Lista seus itens ativos por ordem de validade\n• `/consumido <id ou nome>` — Dá baixa no item consumido\n• `/alerta` — Dispara o cruzamento inteligente de receitas\n• `/resumo` — Exibe indicadores da sua despensa',
    };
  }

  /**
   * RF08 — Disparo ativo real para Telegram Bot API quando TELEGRAM_BOT_TOKEN estiver configurado.
   */
  async sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
    if (!env.hasTelegramBot || !/^-?\d+$/.test(chatId)) {
      return false;
    }

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Telegram API HTTP ${response.status}: ${errBody}`);
    }
    return true;
  }

  /**
   * RF08 — Disparo ativo real para WhatsApp Cloud API quando credenciais estiverem configuradas.
   */
  async sendWhatsAppMessage(toPhone: string, text: string): Promise<boolean> {
    if (!env.hasWhatsAppBot || !/^\d{10,15}$/.test(toPhone)) {
      return false;
    }

    const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`WhatsApp Cloud API HTTP ${response.status}: ${errBody}`);
    }
    return true;
  }

  /**
   * Baixa arquivo de imagem do Telegram para submeter ao Gemini Vision (RF01 -> RF02)
   */
  async downloadTelegramFileAsBase64(
    fileId: string
  ): Promise<{ base64: string; mimeType: string }> {
    if (!env.hasTelegramBot) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado.');
    }

    const fileMetaRes = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    if (!fileMetaRes.ok) {
      throw new Error(`Falha ao consultar arquivo Telegram: HTTP ${fileMetaRes.status}`);
    }
    const metaJson = (await fileMetaRes.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };
    const filePath = metaJson.result?.file_path;
    if (!filePath) {
      throw new Error('file_path ausente na resposta do Telegram.');
    }

    const downloadRes = await fetch(
      `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`
    );
    if (!downloadRes.ok) {
      throw new Error(`Falha ao baixar foto do Telegram: HTTP ${downloadRes.status}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return {
      base64: Buffer.from(arrayBuffer).toString('base64'),
      mimeType,
    };
  }
}

export const botService = new BotService();
