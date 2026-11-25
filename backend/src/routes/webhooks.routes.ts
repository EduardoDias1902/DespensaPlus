import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { botService } from '../services/bot.service.js';
import { cronService } from '../services/cron.service.js';
import { geminiService } from '../services/gemini.service.js';
import { pantryRepository } from '../services/pantry.repository.js';

export const webhooksRouter = Router();

const chatCommandSchema = z.object({
  chatId: z.string().optional(),
  text: z.string().min(1),
});

/**
 * POST /api/chat/command
 * Usado pelo Simulador Web e pelo fluxo n8n para processar /estoque, /consumido, /alerta e /resumo (RF05).
 */
webhooksRouter.post('/chat/command', async (req, res, next) => {
  try {
    const { chatId, text } = chatCommandSchema.parse(req.body);
    const resolvedChatId = chatId || env.DEFAULT_USER_CHAT_ID;
    const cmdResult = await botService.handleTextCommand(text, resolvedChatId);

    let cronResult = null;
    if (cmdResult.triggerCron) {
      cronResult = await cronService.runForUser(resolvedChatId, 'chat_command', false);
    }

    res.json({
      ...cmdResult,
      cronResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/webhooks/telegram
 * Webhook direto opcional para Telegram Bot API (alternativa direta ao nó Trigger do n8n).
 */
webhooksRouter.post('/webhooks/telegram', async (req, res, next) => {
  try {
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const tokenHeader = req.header('x-telegram-bot-api-secret-token');
      if (tokenHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
        res.status(401).json({ error: 'Secret token inválido.' });
        return;
      }
    }

    const message = req.body?.message as
      | {
          chat?: { id?: number | string };
          text?: string;
          photo?: Array<{ file_id: string }>;
        }
      | undefined;

    if (!message?.chat?.id) {
      res.json({ ok: true, ignored: true });
      return;
    }

    const chatId = String(message.chat.id);

    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const highestRes = message.photo[message.photo.length - 1];
      const { base64, mimeType } = await botService.downloadTelegramFileAsBase64(
        highestRes.file_id
      );
      const extracted = await geminiService.analyzeProductImage(base64, mimeType);
      const saved = await pantryRepository.createItem({
        chatId,
        produto: extracted.produto,
        categoria: extracted.categoria,
        data_validade: extracted.data_validade,
        confianca_ocr: extracted.confianca_ocr,
        lote_ou_obs: extracted.lote_ou_obs,
      });

      const confirmText = `✅ *Item cadastrado via Gemini OCR!*\n\n📦 *Produto:* ${saved.produto} (#${saved.id})\n🏷️ *Categoria:* ${saved.categoria}\n📅 *Validade:* ${saved.data_validade}\n🎯 *Confiança:* ${saved.confianca_ocr}\n\nEnvie \`/consumido ${saved.id}\` quando consumir este item.`;
      await botService.sendTelegramMessage(chatId, confirmText).catch(() => false);
      res.json({ ok: true, saved });
      return;
    }

    if (message.text) {
      const cmdResult = await botService.handleTextCommand(message.text, chatId);
      if (cmdResult.triggerCron) {
        const cronResult = await cronService.runForUser(chatId, 'telegram_command', true);
        res.json({ ok: true, cronResult });
        return;
      }
      await botService.sendTelegramMessage(chatId, cmdResult.replyText).catch(() => false);
      res.json({ ok: true, cmdResult });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/webhooks/whatsapp — Handshake de verificação da Meta Cloud API
 */
webhooksRouter.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
});

/**
 * POST /api/webhooks/whatsapp — Recebimento de mensagens de texto da WhatsApp Cloud API
 */
webhooksRouter.post('/webhooks/whatsapp', async (req, res, next) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msg = change?.messages?.[0];

    if (!msg?.from) {
      res.sendStatus(200);
      return;
    }

    const from = String(msg.from);
    if (msg.type === 'text' && msg.text?.body) {
      const cmdResult = await botService.handleTextCommand(String(msg.text.body), from);
      if (cmdResult.triggerCron) {
        await cronService.runForUser(from, 'whatsapp_command', true);
      } else {
        await botService.sendWhatsAppMessage(from, cmdResult.replyText).catch(() => false);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});
