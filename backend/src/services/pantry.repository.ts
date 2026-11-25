import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type {
  CreatePantryItemInput,
  CronStepLog,
  EnrichedPantryItem,
  PantryCategory,
  PantryItem,
  PantryStatus,
  RecipeSuggestion,
} from '../types/pantry.js';
import {
  addDaysToToday,
  brDateToIso,
  calculateDaysRemaining,
  isoDateToBr,
  normalizeBrazilianDate,
  shiftDateString,
} from '../utils/date.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DATA_FILE = path.resolve(__dirname, '../../data/pantry.json');

interface LocalDatabaseShape {
  nextId: number;
  items: PantryItem[];
  cronLogs: CronStepLog[];
}

function buildInitialSeed(): LocalDatabaseShape {
  const defaultUser = env.DEFAULT_USER_CHAT_ID;
  return {
    nextId: 107,
    items: [
      {
        id: 101,
        user_id: defaultUser,
        produto: 'Whey Protein Isolado Baunilha',
        categoria: 'Suplemento',
        data_cadastro: addDaysToToday(-20),
        data_validade: addDaysToToday(35),
        status: 'Em estoque',
        confianca_ocr: '99%',
        lote_ou_obs: 'Rótulo frontal nítido + validade próximo ao EAN',
      },
      {
        id: 102,
        user_id: defaultUser,
        produto: 'Banana Prata Madura (Penca)',
        categoria: 'Hortifruti',
        data_cadastro: addDaysToToday(-4),
        data_validade: addDaysToToday(2),
        status: 'Em estoque',
        confianca_ocr: '96%',
        lote_ou_obs: 'Estimativa de maturação via Visão Computacional',
      },
      {
        id: 103,
        user_id: defaultUser,
        produto: 'Pasta de Amendoim Zero Lactose',
        categoria: 'Suplemento',
        data_cadastro: addDaysToToday(-60),
        data_validade: addDaysToToday(4),
        status: 'Em estoque',
        confianca_ocr: '98%',
        lote_ou_obs: 'Carimbo pontilhado na tampa: VAL',
      },
      {
        id: 104,
        user_id: defaultUser,
        produto: 'Aveia em Flocos Finos',
        categoria: 'Grãos & Cereais',
        data_cadastro: addDaysToToday(-15),
        data_validade: addDaysToToday(60),
        status: 'Em estoque',
        confianca_ocr: '97%',
      },
      {
        id: 105,
        user_id: defaultUser,
        produto: 'Ovos Caipiras (Dúzia)',
        categoria: 'Mercearia',
        data_cadastro: addDaysToToday(-7),
        data_validade: addDaysToToday(14),
        status: 'Em estoque',
        confianca_ocr: '99%',
      },
      {
        id: 106,
        user_id: defaultUser,
        produto: 'Suco Verde em Pó Detox',
        categoria: 'Suplemento',
        data_cadastro: addDaysToToday(-85),
        data_validade: addDaysToToday(-2),
        status: 'Vencido',
        confianca_ocr: '95%',
      },
    ],
    cronLogs: [
      {
        time: '00:00:01',
        node: 'Schedule Trigger',
        status: 'OK',
        detail: `Disparo diário automático pronto (${env.CRON_SCHEDULE})`,
      },
      {
        time: '00:00:02',
        node: 'Repository Query',
        status: 'OK',
        detail: `Monitorando janela de segurança <= ${env.ALERT_WINDOW_DAYS} dias`,
      },
    ],
  };
}

export function enrichItem(item: PantryItem): EnrichedPantryItem {
  const diasRestantes = calculateDaysRemaining(item.data_validade);
  let computedStatus: PantryStatus = item.status;
  if (item.status === 'Em estoque' && diasRestantes < 0) {
    computedStatus = 'Vencido';
  }
  return {
    ...item,
    diasRestantes,
    computedStatus,
  };
}

class PantryRepository {
  private supabase: SupabaseClient | null = null;
  private localCache: LocalDatabaseShape | null = null;

  constructor() {
    if (env.hasSupabase) {
      this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
    }
  }

  get storageMode(): 'supabase' | 'local-json' {
    return this.supabase ? 'supabase' : 'local-json';
  }

  private async readLocalDb(): Promise<LocalDatabaseShape> {
    if (this.localCache) return this.localCache;

    try {
      const content = await fs.readFile(LOCAL_DATA_FILE, 'utf-8');
      this.localCache = JSON.parse(content) as LocalDatabaseShape;
      return this.localCache;
    } catch {
      const seed = buildInitialSeed();
      await this.writeLocalDb(seed);
      return seed;
    }
  }

  private async writeLocalDb(data: LocalDatabaseShape): Promise<void> {
    this.localCache = data;
    await fs.mkdir(path.dirname(LOCAL_DATA_FILE), { recursive: true });
    await fs.writeFile(LOCAL_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async ensureSupabaseUser(
    chatId = env.DEFAULT_USER_CHAT_ID,
    canal: 'telegram' | 'whatsapp' | 'web' = 'telegram'
  ): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase não configurado.');
    }

    const { data: existing, error: selectErr } = await this.supabase
      .from('usuarios')
      .select('id')
      .eq('chat_id', chatId)
      .maybeSingle();

    if (selectErr) throw selectErr;
    if (existing?.id) return existing.id as string;

    const { data: created, error: insertErr } = await this.supabase
      .from('usuarios')
      .insert({
        nome: env.DEFAULT_USER_NAME,
        chat_id: chatId,
        canal,
        janela_seguranca_dias: env.ALERT_WINDOW_DAYS,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    return created.id as string;
  }

  async listUsersChatIds(): Promise<string[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('chat_id')
        .eq('ativo', true);
      if (error) throw error;
      const ids = (data ?? []).map((u) => String(u.chat_id));
      return ids.length > 0 ? ids : [env.DEFAULT_USER_CHAT_ID];
    }

    const db = await this.readLocalDb();
    const unique = Array.from(new Set(db.items.map((i) => i.user_id)));
    return unique.length > 0 ? unique : [env.DEFAULT_USER_CHAT_ID];
  }

  async listItems(chatId = env.DEFAULT_USER_CHAT_ID): Promise<EnrichedPantryItem[]> {
    if (this.supabase) {
      const userId = await this.ensureSupabaseUser(chatId);
      const { data, error } = await this.supabase
        .from('despensa')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) =>
        enrichItem({
          id: Number(row.id),
          user_id: chatId,
          produto: String(row.produto),
          categoria: (row.categoria || 'Mercearia') as PantryCategory,
          data_cadastro: isoDateToBr(String(row.data_cadastro)),
          data_validade: isoDateToBr(String(row.data_validade)),
          status: row.status as PantryStatus,
          confianca_ocr: String(row.confianca_ocr || 'Manual'),
          lote_ou_obs: row.lote_ou_obs ? String(row.lote_ou_obs) : undefined,
        })
      );
    }

    const db = await this.readLocalDb();
    return db.items
      .filter((item) => !chatId || item.user_id === chatId)
      .map(enrichItem);
  }

  async createItem(input: CreatePantryItemInput): Promise<EnrichedPantryItem> {
    const chatId = input.chatId || env.DEFAULT_USER_CHAT_ID;
    const normalizedDate = normalizeBrazilianDate(input.data_validade);
    if (!normalizedDate) {
      throw new Error(
        `Data de validade inválida: "${input.data_validade}". Use DD/MM/AAAA ou MM/AAAA.`
      );
    }

    const daysLeft = calculateDaysRemaining(normalizedDate);
    const initialStatus: PantryStatus = daysLeft < 0 ? 'Vencido' : 'Em estoque';

    if (this.supabase) {
      const userId = await this.ensureSupabaseUser(chatId);
      const { data, error } = await this.supabase
        .from('despensa')
        .insert({
          user_id: userId,
          produto: input.produto.trim(),
          categoria: input.categoria,
          data_validade: brDateToIso(normalizedDate),
          status: initialStatus,
          confianca_ocr: input.confianca_ocr || 'Manual',
          lote_ou_obs: input.lote_ou_obs,
        })
        .select('*')
        .single();

      if (error) throw error;

      return enrichItem({
        id: Number(data.id),
        user_id: chatId,
        produto: String(data.produto),
        categoria: data.categoria as PantryCategory,
        data_cadastro: isoDateToBr(String(data.data_cadastro)),
        data_validade: isoDateToBr(String(data.data_validade)),
        status: data.status as PantryStatus,
        confianca_ocr: String(data.confianca_ocr || 'Manual'),
        lote_ou_obs: data.lote_ou_obs ? String(data.lote_ou_obs) : undefined,
      });
    }

    const db = await this.readLocalDb();
    const newItem: PantryItem = {
      id: db.nextId++,
      user_id: chatId,
      produto: input.produto.trim(),
      categoria: input.categoria,
      data_cadastro: addDaysToToday(0),
      data_validade: normalizedDate,
      status: initialStatus,
      confianca_ocr: input.confianca_ocr || 'Manual',
      lote_ou_obs: input.lote_ou_obs,
    };

    db.items = [newItem, ...db.items];
    await this.writeLocalDb(db);
    return enrichItem(newItem);
  }

  async updateItemStatus(
    id: number,
    status: PantryStatus
  ): Promise<EnrichedPantryItem | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('despensa')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return enrichItem({
        id: Number(data.id),
        user_id: env.DEFAULT_USER_CHAT_ID,
        produto: String(data.produto),
        categoria: data.categoria as PantryCategory,
        data_cadastro: isoDateToBr(String(data.data_cadastro)),
        data_validade: isoDateToBr(String(data.data_validade)),
        status: data.status as PantryStatus,
        confianca_ocr: String(data.confianca_ocr || 'Manual'),
        lote_ou_obs: data.lote_ou_obs ? String(data.lote_ou_obs) : undefined,
      });
    }

    const db = await this.readLocalDb();
    const index = db.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    db.items[index] = { ...db.items[index], status };
    await this.writeLocalDb(db);
    return enrichItem(db.items[index]);
  }

  async shiftItemDate(
    id: number,
    deltaDays: number
  ): Promise<EnrichedPantryItem | null> {
    if (this.supabase) {
      const { data: current, error: fetchErr } = await this.supabase
        .from('despensa')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!current) return null;

      const currentBr = isoDateToBr(String(current.data_validade));
      const updatedBr = shiftDateString(currentBr, deltaDays);
      const daysLeft = calculateDaysRemaining(updatedBr);
      const nextStatus: PantryStatus =
        current.status === 'Consumido'
          ? 'Consumido'
          : daysLeft < 0
          ? 'Vencido'
          : 'Em estoque';

      const { data, error } = await this.supabase
        .from('despensa')
        .update({
          data_validade: brDateToIso(updatedBr),
          status: nextStatus,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;

      return enrichItem({
        id: Number(data.id),
        user_id: env.DEFAULT_USER_CHAT_ID,
        produto: String(data.produto),
        categoria: data.categoria as PantryCategory,
        data_cadastro: isoDateToBr(String(data.data_cadastro)),
        data_validade: isoDateToBr(String(data.data_validade)),
        status: data.status as PantryStatus,
        confianca_ocr: String(data.confianca_ocr || 'Manual'),
        lote_ou_obs: data.lote_ou_obs ? String(data.lote_ou_obs) : undefined,
      });
    }

    const db = await this.readLocalDb();
    const index = db.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const current = db.items[index];
    const updatedBr = shiftDateString(current.data_validade, deltaDays);
    const daysLeft = calculateDaysRemaining(updatedBr);
    const nextStatus: PantryStatus =
      current.status === 'Consumido'
        ? 'Consumido'
        : daysLeft < 0
        ? 'Vencido'
        : 'Em estoque';

    db.items[index] = {
      ...current,
      data_validade: updatedBr,
      status: nextStatus,
    };
    await this.writeLocalDb(db);
    return enrichItem(db.items[index]);
  }

  async deleteItem(id: number): Promise<boolean> {
    if (this.supabase) {
      const { error, count } = await this.supabase
        .from('despensa')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      return (count ?? 0) > 0;
    }

    const db = await this.readLocalDb();
    const before = db.items.length;
    db.items = db.items.filter((item) => item.id !== id);
    if (db.items.length === before) return false;
    await this.writeLocalDb(db);
    return true;
  }

  async saveNotificationAudit(params: {
    chatId: string;
    canal: string;
    expiringItems: EnrichedPantryItem[];
    receitas: RecipeSuggestion[];
    statusEnvio: 'OK' | 'FALLBACK' | 'ERRO';
    latencyMs: number;
    logs: CronStepLog[];
    detalheErro?: string;
  }): Promise<void> {
    if (this.supabase) {
      try {
        const userId = await this.ensureSupabaseUser(params.chatId);
        await this.supabase.from('logs_notificacoes').insert({
          user_id: userId,
          canal: params.canal,
          tipo: 'alerta_vencimento',
          itens_criticos: params.expiringItems.map((i) => ({
            id: i.id,
            produto: i.produto,
            data_validade: i.data_validade,
            diasRestantes: i.diasRestantes,
          })),
          receitas_geradas: params.receitas,
          status_envio: params.statusEnvio,
          detalhe_erro: params.detalheErro ?? null,
          latencia_ms: params.latencyMs,
        });
      } catch (err) {
        console.warn('[PantryRepository] Falha ao persistir log no Supabase:', err);
      }
    }

    const db = await this.readLocalDb();
    db.cronLogs = params.logs;
    await this.writeLocalDb(db);
  }

  async getRecentCronLogs(): Promise<CronStepLog[]> {
    const db = await this.readLocalDb();
    return db.cronLogs;
  }
}

export const pantryRepository = new PantryRepository();
