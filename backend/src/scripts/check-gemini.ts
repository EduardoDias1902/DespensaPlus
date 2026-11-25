import { env } from '../config/env.js';
import { geminiService } from '../services/gemini.service.js';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  if (!env.hasGeminiKey) {
    console.log(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY não configurada no .env' }));
    process.exit(1);
  }

  for (const model of ['gemini-4-hydrogen', 'gemini-3.5-flash-lite']) {
    env.GEMINI_MODEL = model;
    const res = await geminiService.analyzeProductImage(
      TINY_PNG_BASE64,
      'image/png',
      'teste-multimodal.png'
    );
    console.log(
      JSON.stringify({
        model,
        aiMode: res.aiMode,
        latencyMs: res.latencyMs,
        produto: res.produto.slice(0, 60),
      })
    );
  }
}

void main();
