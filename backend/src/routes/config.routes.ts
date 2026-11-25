import { Router } from 'express';
import { z } from 'zod';
import { env, updateGeminiConfig } from '../config/env.js';
import { geminiService } from '../services/gemini.service.js';

export const configRouter = Router();

const ALLOWED_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-4-argon',
] as const;

const configureGeminiSchema = z.object({
  apiKey: z.string().trim().min(10, 'Informe uma chave Gemini válida (ex: AIza...).'),
  model: z.enum(ALLOWED_MODELS).optional().default('gemini-3.5-flash-lite'),
});

function isLocalAddress(ip: string | undefined): boolean {
  if (!ip) return true;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

/**
 * POST /api/config/gemini
 * Permite configurar e testar a GEMINI_API_KEY localmente sem editar .env manualmente.
 * A chave fica gravada somente no .env do servidor (nunca no navegador - RNF05).
 */
configRouter.post('/config/gemini', async (req, res, next) => {
  try {
    if (env.NODE_ENV === 'production' || !isLocalAddress(req.ip)) {
      res.status(403).json({
        error: 'Configuração via API disponível apenas em ambiente local de desenvolvimento.',
      });
      return;
    }

    const { apiKey, model } = configureGeminiSchema.parse(req.body);
    const verification = await geminiService.verifyApiKey(apiKey, model);

    if (!verification.ok) {
      res.status(400).json({
        ok: false,
        error: `A chave não pôde ser validada na Gemini API (${model}): ${verification.error}`,
      });
      return;
    }

    await updateGeminiConfig(apiKey, model);
    geminiService.resetClient();

    res.json({
      ok: true,
      geminiConfigured: true,
      geminiModel: env.GEMINI_MODEL,
      latencyMs: verification.latencyMs,
      message: `Gemini Vision ativado com sucesso (${env.GEMINI_MODEL}) e salvo com segurança no .env!`,
    });
  } catch (err) {
    next(err);
  }
});
