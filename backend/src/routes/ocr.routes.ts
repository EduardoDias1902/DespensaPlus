import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { geminiService } from '../services/gemini.service.js';
import { pantryRepository } from '../services/pantry.repository.js';

export const ocrRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

const jsonOcrSchema = z.object({
  base64Image: z.string().min(16, 'Imagem base64 inválida'),
  mimeType: z.string().default('image/jpeg'),
  fileName: z.string().optional(),
  autoSave: z.boolean().optional().default(false),
  chatId: z.string().optional(),
});

/**
 * POST /api/ocr/analyze
 * Aceita tanto multipart/form-data (campo "image") quanto JSON { base64Image, mimeType }.
 * Atende RF02 (Visão Computacional + OCR) e RNF01 (< 10s).
 */
ocrRouter.post('/ocr/analyze', upload.single('image'), async (req, res, next) => {
  try {
    let base64Image: string;
    let mimeType: string;
    let fileName: string | undefined;
    let autoSave = false;
    let chatId: string | undefined;

    if (req.file) {
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype || 'image/jpeg';
      fileName = req.file.originalname;
      autoSave = String(req.body?.autoSave).toLowerCase() === 'true';
      chatId = typeof req.body?.chatId === 'string' ? req.body.chatId : undefined;
    } else {
      const parsed = jsonOcrSchema.parse(req.body);
      base64Image = parsed.base64Image.includes(',')
        ? parsed.base64Image.split(',')[1]
        : parsed.base64Image;
      mimeType = parsed.mimeType;
      fileName = parsed.fileName;
      autoSave = parsed.autoSave;
      chatId = parsed.chatId;
    }

    const extracted = await geminiService.analyzeProductImage(
      base64Image,
      mimeType,
      fileName
    );

    let savedItem = null;
    if (autoSave) {
      savedItem = await pantryRepository.createItem({
        chatId,
        produto: extracted.produto,
        categoria: extracted.categoria,
        data_validade: extracted.data_validade,
        confianca_ocr: extracted.confianca_ocr,
        lote_ou_obs: extracted.lote_ou_obs,
      });
    }

    res.json({
      extracted,
      savedItem,
    });
  } catch (err) {
    next(err);
  }
});
