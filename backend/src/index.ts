import { createApp } from './app.js';
import { env } from './config/env.js';
import { cronService } from './services/cron.service.js';
import { pantryRepository } from './services/pantry.repository.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log('==============================================================');
  console.log(` Smart Pantry Assistant MVP — Backend API rodando na porta ${env.PORT}`);
  console.log(` Storage : ${pantryRepository.storageMode}`);
  console.log(
    ` Gemini  : ${env.hasGeminiKey ? `ATIVO (${env.GEMINI_MODEL})` : 'MODO DEMO (defina GEMINI_API_KEY no .env)'}`
  );
  console.log(` Telegram: ${env.hasTelegramBot ? 'ATIVO' : 'Opcional (não configurado)'}`);
  console.log(` WhatsApp: ${env.hasWhatsAppBot ? 'ATIVO' : 'Opcional (não configurado)'}`);
  console.log('==============================================================');

  cronService.startScheduler();
});

process.on('SIGTERM', () => {
  cronService.stopScheduler();
  server.close(() => process.exit(0));
});
