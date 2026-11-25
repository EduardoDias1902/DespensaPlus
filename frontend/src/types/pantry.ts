export type PantryCategory =
  | 'Suplemento'
  | 'Grãos & Cereais'
  | 'Laticínios'
  | 'Hortifruti'
  | 'Mercearia'
  | 'Geral';

export type PantryStatus = 'Em estoque' | 'Consumido' | 'Vencido';

export type ActiveTab = 'bot' | 'supabase' | 'n8n' | 'antigravity';

export interface PantryItem {
  id: number;
  user_id: string;
  produto: string;
  categoria: PantryCategory;
  data_cadastro: string;
  data_validade: string;
  status: PantryStatus;
  confianca_ocr: string;
  lote_ou_obs?: string;
}

export interface EnrichedPantryItem extends PantryItem {
  diasRestantes: number;
  computedStatus: PantryStatus;
}

export interface OcrExtractionResult {
  produto: string;
  categoria: PantryCategory;
  data_validade: string;
  confianca_ocr: string;
  lote_ou_obs: string;
  aiMode?: 'gemini' | 'fallback';
  modelUsed?: string;
  latencyMs?: number;
  requiresApiKey?: boolean;
}

export interface PendingConfirmationState {
  messageId: string;
  extracted: OcrExtractionResult;
}

export interface PresetSample {
  id: string;
  produto: string;
  categoria: PantryCategory;
  diasOffset: number;
  confianca_ocr: string;
  lote_ou_obs: string;
  emoji: string;
  cor: string;
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
  aiMode?: 'gemini' | 'fallback';
  modelUsed?: string;
  latencyMs?: number;
}

export interface CronStepLog {
  time: string;
  node: string;
  status: 'OK' | 'WARN' | 'ERR';
  detail: string;
}

export interface CronRunResult {
  timestamp: string;
  source?: string;
  expiringCount: number;
  otherCount: number;
  expiringItems?: EnrichedPantryItem[];
  aiData: RecipeCuratorOutput;
  formattedMarkdown?: string;
  dispatchedChannels?: string[];
  logs?: CronStepLog[];
  totalLatencyMs?: number;
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
  serverless?: boolean;
  geminiConfigured: boolean;
  geminiModel: string;
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  cronEnabled: boolean;
  cronSchedule: string;
  alertWindowDays: number;
}

export type ChatMessage =
  | {
      id: string;
      sender: 'user' | 'bot';
      timestamp: string;
      type: 'text';
      text: string;
    }
  | {
      id: string;
      sender: 'user';
      timestamp: string;
      type: 'photo_sample';
      sample: PresetSample;
      expDate: string;
    }
  | {
      id: string;
      sender: 'user';
      timestamp: string;
      type: 'photo_real';
      imageUrl: string;
      fileName: string;
    }
  | {
      id: string;
      sender: 'bot';
      timestamp: string;
      type: 'ocr_confirmation';
      extracted: OcrExtractionResult;
    }
  | {
      id: string;
      sender: 'bot';
      timestamp: string;
      type: 'recipe_alert';
      expiringItems: EnrichedPantryItem[];
      aiData: RecipeCuratorOutput;
    };
