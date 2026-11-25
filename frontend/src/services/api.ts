import type {
  CronRunResult,
  CronStepLog,
  EnrichedPantryItem,
  HealthStatus,
  OcrExtractionResult,
  PantryCategory,
  PantryStatus,
  WeeklySummaryReport,
} from '../types/pantry';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorBody}`);
  }
  return (await response.json()) as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Falha ao converter imagem para base64.'));
    reader.readAsDataURL(file);
  });
}

export const apiClient = {
  getHealth(): Promise<HealthStatus> {
    return requestJson<HealthStatus>('/api/health');
  },

  async listPantry(): Promise<{ storageMode: 'supabase' | 'local-json'; items: EnrichedPantryItem[] }> {
    return requestJson<{ storageMode: 'supabase' | 'local-json'; items: EnrichedPantryItem[] }>(
      '/api/pantry'
    );
  },

  async createPantryItem(payload: {
    produto: string;
    categoria: PantryCategory;
    data_validade?: string;
    diasRestantes?: number;
    confianca_ocr?: string;
    lote_ou_obs?: string;
  }): Promise<{ item: EnrichedPantryItem }> {
    return requestJson<{ item: EnrichedPantryItem }>('/api/pantry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateItemStatus(id: number, status: PantryStatus): Promise<{ item: EnrichedPantryItem }> {
    return requestJson<{ item: EnrichedPantryItem }>(`/api/pantry/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async shiftItemDate(id: number, deltaDays: number): Promise<{ item: EnrichedPantryItem }> {
    return requestJson<{ item: EnrichedPantryItem }>(`/api/pantry/${id}/shift-date`, {
      method: 'PATCH',
      body: JSON.stringify({ deltaDays }),
    });
  },

  async deleteItem(id: number): Promise<{ deleted: boolean; id: number }> {
    return requestJson<{ deleted: boolean; id: number }>(`/api/pantry/${id}`, {
      method: 'DELETE',
    });
  },

  async analyzeImage(file: File): Promise<{ extracted: OcrExtractionResult }> {
    const base64Image = await fileToBase64(file);
    return requestJson<{ extracted: OcrExtractionResult }>('/api/ocr/analyze', {
      method: 'POST',
      body: JSON.stringify({
        base64Image,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
        autoSave: false,
      }),
    });
  },

  async sendChatCommand(text: string): Promise<{
    handled: boolean;
    action: string;
    replyText: string;
    updatedItem?: EnrichedPantryItem;
    triggerCron?: boolean;
    cronResult?: CronRunResult | null;
  }> {
    return requestJson('/api/chat/command', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async runCron(
    source = 'web_dashboard',
    items?: EnrichedPantryItem[]
  ): Promise<CronRunResult> {
    return requestJson<CronRunResult>('/api/cron/run', {
      method: 'POST',
      body: JSON.stringify({ source, dispatchExternal: false, items }),
    });
  },

  async getCronLogs(): Promise<{ logs: CronStepLog[]; lastRun: CronRunResult | null }> {
    return requestJson<{ logs: CronStepLog[]; lastRun: CronRunResult | null }>('/api/cron/logs');
  },

  async getWeeklySummary(): Promise<WeeklySummaryReport> {
    return requestJson<WeeklySummaryReport>('/api/cron/summary');
  },
};
