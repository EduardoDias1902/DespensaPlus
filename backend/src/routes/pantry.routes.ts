import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pantryRepository } from '../services/pantry.repository.js';
import type { PantryCategory } from '../types/pantry.js';
import { addDaysToToday, normalizeBrazilianDate } from '../utils/date.js';

export const pantryRouter = Router();

const categoryEnum = z.enum([
  'Suplemento',
  'Grãos & Cereais',
  'Laticínios',
  'Hortifruti',
  'Mercearia',
  'Geral',
]);

const createItemSchema = z
  .object({
    chatId: z.string().optional(),
    produto: z.string().trim().min(1, 'Nome do produto é obrigatório').max(140),
    categoria: categoryEnum.default('Mercearia'),
    data_validade: z.string().optional(),
    diasRestantes: z.coerce.number().int().min(-365).max(3650).optional(),
    confianca_ocr: z.string().optional().default('Manual'),
    lote_ou_obs: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.data_validade) || typeof data.diasRestantes === 'number',
    { message: 'Informe data_validade (DD/MM/AAAA ou MM/AAAA) ou diasRestantes.' }
  );

const updateStatusSchema = z.object({
  status: z.enum(['Em estoque', 'Consumido', 'Vencido']),
});

const shiftDateSchema = z.object({
  deltaDays: z.coerce.number().int().min(-365).max(365),
});

pantryRouter.get('/pantry', async (req, res, next) => {
  try {
    const chatId =
      typeof req.query.chatId === 'string' && req.query.chatId.trim()
        ? req.query.chatId.trim()
        : env.DEFAULT_USER_CHAT_ID;
    const items = await pantryRepository.listItems(chatId);
    res.json({
      storageMode: pantryRepository.storageMode,
      count: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
});

pantryRouter.post('/pantry', async (req, res, next) => {
  try {
    const parsed = createItemSchema.parse(req.body);
    const resolvedDate = parsed.data_validade
      ? normalizeBrazilianDate(parsed.data_validade)
      : addDaysToToday(parsed.diasRestantes ?? 7);

    if (!resolvedDate) {
      res.status(400).json({
        error: 'Formato de data inválido. Utilize DD/MM/AAAA ou MM/AAAA.',
      });
      return;
    }

    const created = await pantryRepository.createItem({
      chatId: parsed.chatId,
      produto: parsed.produto,
      categoria: parsed.categoria as PantryCategory,
      data_validade: resolvedDate,
      confianca_ocr: parsed.confianca_ocr,
      lote_ou_obs: parsed.lote_ou_obs,
    });

    res.status(201).json({ item: created });
  } catch (err) {
    next(err);
  }
});

pantryRouter.patch('/pantry/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID de item inválido.' });
      return;
    }
    const { status } = updateStatusSchema.parse(req.body);
    const updated = await pantryRepository.updateItemStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: `Item #${id} não encontrado.` });
      return;
    }
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

pantryRouter.patch('/pantry/:id/shift-date', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID de item inválido.' });
      return;
    }
    const { deltaDays } = shiftDateSchema.parse(req.body);
    const updated = await pantryRepository.shiftItemDate(id, deltaDays);
    if (!updated) {
      res.status(404).json({ error: `Item #${id} não encontrado.` });
      return;
    }
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

pantryRouter.delete('/pantry/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID de item inválido.' });
      return;
    }
    const removed = await pantryRepository.deleteItem(id);
    if (!removed) {
      res.status(404).json({ error: `Item #${id} não encontrado.` });
      return;
    }
    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});
