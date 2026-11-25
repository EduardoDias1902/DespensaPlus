import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { cronService } from '../services/cron.service.js';
import { pantryRepository } from '../services/pantry.repository.js';

export const cronRouter = Router();

const runCronSchema = z.object({
  chatId: z.string().optional(),
  source: z.string().optional().default('web_dashboard'),
  dispatchExternal: z.boolean().optional().default(false),
});

cronRouter.post('/cron/run', async (req, res, next) => {
  try {
    const parsed = runCronSchema.parse(req.body ?? {});
    const result = await cronService.runForUser(
      parsed.chatId || env.DEFAULT_USER_CHAT_ID,
      parsed.source,
      parsed.dispatchExternal
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

cronRouter.get('/cron/logs', async (_req, res, next) => {
  try {
    const logs = await pantryRepository.getRecentCronLogs();
    res.json({
      logs,
      lastRun: cronService.getLastRun(),
    });
  } catch (err) {
    next(err);
  }
});

cronRouter.get('/cron/summary', async (req, res, next) => {
  try {
    const chatId =
      typeof req.query.chatId === 'string' && req.query.chatId.trim()
        ? req.query.chatId.trim()
        : env.DEFAULT_USER_CHAT_ID;
    const summary = await cronService.buildWeeklySummary(chatId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
