import { Router } from 'express';
import { env } from '../config/env.js';
import { pantryRepository } from '../services/pantry.repository.js';
import type { HealthStatus } from '../types/pantry.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const payload: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageMode: pantryRepository.storageMode,
    geminiConfigured: env.hasGeminiKey,
    geminiModel: env.GEMINI_MODEL,
    telegramConfigured: env.hasTelegramBot,
    whatsappConfigured: env.hasWhatsAppBot,
    cronEnabled: env.CRON_ENABLED,
    cronSchedule: env.CRON_SCHEDULE,
    alertWindowDays: env.ALERT_WINDOW_DAYS,
  };
  res.json(payload);
});
