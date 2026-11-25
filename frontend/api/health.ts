interface VercelReq {
  method?: string;
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (body: unknown) => void;
}

const isPlaceholder = (value: string | undefined): boolean => {
  const trimmed = (value ?? '').trim();
  return !trimmed || trimmed.startsWith('coloque_sua_') || trimmed.startsWith('your_');
};

export default function handler(_req: VercelReq, res: VercelRes) {
  const geminiConfigured = !isPlaceholder(process.env.GEMINI_API_KEY);
  const geminiModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const hasSupabase =
    !isPlaceholder(process.env.SUPABASE_URL) &&
    !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY);

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageMode: hasSupabase ? 'supabase' : 'local-json',
    serverless: true,
    geminiConfigured,
    geminiModel,
    telegramConfigured: !isPlaceholder(process.env.TELEGRAM_BOT_TOKEN),
    whatsappConfigured:
      !isPlaceholder(process.env.WHATSAPP_ACCESS_TOKEN) &&
      !isPlaceholder(process.env.WHATSAPP_PHONE_NUMBER_ID),
    cronEnabled: true,
    cronSchedule: '0 0 * * *',
    alertWindowDays: Number(process.env.ALERT_WINDOW_DAYS || 5),
  });
}
