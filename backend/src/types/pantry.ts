export type PantryCategory =
  | 'Suplemento'
  | 'Grãos & Cereais'
  | 'Laticínios'
  | 'Hortifruti'
  | 'Mercearia'
  | 'Geral';

export type PantryStatus = 'Em estoque' | 'Consumido' | 'Vencido';

export interface PantryItem {
  id: number;
  user_id: string;
  produto: string;
  categoria: PantryCategory;
  data_cadastro: string; // DD/MM/YYYY
  data_validade: string; // DD/MM/YYYY
  status: PantryStatus;
  confianca_ocr: string;
  lote_ou_obs?: string;
}

export interface EnrichedPantryItem extends PantryItem {
  diasRestantes: number;
  computedStatus: PantryStatus;
}

export interface CreatePantryItemInput {
  chatId?: string;
  produto: string;
  categoria: PantryCategory;
  data_validade: string; // DD/MM/YYYY ou MM/YYYY
  confianca_ocr?: string;
  lote_ou_obs?: string;
}

export interface OcrExtractionResult {
  produto: string;
  categoria: PantryCategory;
  data_validade: string; // Normalizada em DD/MM/YYYY
  confianca_ocr: string;
  lote_ou_obs: string;
  aiMode: 'gemini' | 'fallback';
  modelUsed: string;
  latencyMs: number;
  requiresApiKey?: boolean;
}

export interface RecipeSuggestion {
  titulo: string;
  tempo_preparo: string;
  dificuldade: string;
  ingredientes_usados: string[];
  passo_a_passo: string[];
  dica_nutricional: string;
  termo_busca_link: string;
}

export interface RecipeCuratorOutput {
  resumo_alerta: string;
  receitas: RecipeSuggestion[];
  aiMode: 'gemini' | 'fallback';
  modelUsed: string;
  latencyMs: number;
}

export interface CronStepLog {
  time: string;
  node: string;
  status: 'OK' | 'WARN' | 'ERR';
  detail: string;
}

export interface CronRunResult {
  timestamp: string;
  source: string;
  chatId: string;
  expiringCount: number;
  otherCount: number;
  expiringItems: EnrichedPantryItem[];
  aiData: RecipeCuratorOutput;
  formattedMarkdown: string;
  dispatchedChannels: string[];
  logs: CronStepLog[];
  totalLatencyMs: number;
}

export interface WeeklySummaryReport {
  generatedAt: string;
  totalActive: number;
  expiringSoonCount: number;
  consumedCount: number;
  expiredCount: number;
  wastePreventionRate: number;
  expiringSoonItems: EnrichedPantryItem[];
  emailSubject: string;
  emailBodyMarkdown: string;
}

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
  storageMode: 'supabase' | 'local-json';
  geminiConfigured: boolean;
  geminiModel: string;
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  cronEnabled: boolean;
  cronSchedule: string;
  alertWindowDays: number;
}
