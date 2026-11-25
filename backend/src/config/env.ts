import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_ENV_PATH = path.resolve(__dirname, '../../../.env');

// Carrega .env da raiz do monorepo e permite sobrescrita local em backend/.env
dotenv.config({ path: ROOT_ENV_PATH });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  TZ: z.string().default('America/Sao_Paulo'),

  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),

  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),

  DEFAULT_USER_CHAT_ID: z.string().default('usr_telegram_99412'),
  DEFAULT_USER_NAME: z.string().default('Usuário MVP'),
  ALERT_WINDOW_DAYS: z.coerce.number().int().min(1).max(60).default(5),

  CRON_SCHEDULE: z.string().default('0 0 * * *'),
  CRON_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(''),

  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default('smart_pantry_verify_2026'),
});

const parsed = envSchema.parse(process.env);

export const isPlaceholderSecret = (value: string): boolean => {
  const trimmed = value.trim();
  return !trimmed || trimmed.startsWith('coloque_sua_') || trimmed.startsWith('your_');
};

export const env = {
  ...parsed,
  hasGeminiKey: !isPlaceholderSecret(parsed.GEMINI_API_KEY),
  hasSupabase:
    !isPlaceholderSecret(parsed.SUPABASE_URL) &&
    !isPlaceholderSecret(parsed.SUPABASE_SERVICE_ROLE_KEY),
  hasTelegramBot: !isPlaceholderSecret(parsed.TELEGRAM_BOT_TOKEN),
  hasWhatsAppBot:
    !isPlaceholderSecret(parsed.WHATSAPP_ACCESS_TOKEN) &&
    !isPlaceholderSecret(parsed.WHATSAPP_PHONE_NUMBER_ID),
};

function upsertEnvLine(content: string, key: string, value: string): string {
  const escaped = value.replace(/\r?\n/g, '').trim();
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${escaped}`);
  }
  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}${key}=${escaped}\n`;
}

/**
 * Persiste GEMINI_API_KEY e GEMINI_MODEL no .env local (servidor) e atualiza a memória
 * sem precisar reiniciar o backend (RNF05: chave permanece isolada no servidor).
 */
export async function updateGeminiConfig(
  apiKey: string,
  model?: string
): Promise<void> {
  const trimmedKey = apiKey.trim();
  const resolvedModel = model?.trim() || env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  env.GEMINI_API_KEY = trimmedKey;
  env.GEMINI_MODEL = resolvedModel;
  env.hasGeminiKey = !isPlaceholderSecret(trimmedKey);
  process.env.GEMINI_API_KEY = trimmedKey;
  process.env.GEMINI_MODEL = resolvedModel;

  let currentContent = '';
  try {
    currentContent = await fs.readFile(ROOT_ENV_PATH, 'utf-8');
  } catch {
    currentContent = '';
  }

  let updated = upsertEnvLine(currentContent, 'GEMINI_API_KEY', trimmedKey);
  updated = upsertEnvLine(updated, 'GEMINI_MODEL', resolvedModel);
  await fs.writeFile(ROOT_ENV_PATH, updated, 'utf-8');
}
