import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import type {
  EnrichedPantryItem,
  OcrExtractionResult,
  PantryCategory,
  RecipeCuratorOutput,
} from '../types/pantry.js';
import { addDaysToToday, normalizeBrazilianDate } from '../utils/date.js';

const VALID_CATEGORIES: PantryCategory[] = [
  'Suplemento',
  'Grãos & Cereais',
  'Laticínios',
  'Hortifruti',
  'Mercearia',
  'Geral',
];

function getFastThinkingLevel(model: string): 'minimal' | 'low' {
  // Gemini 3.5/3.1 Flash-Lite suportam 'minimal' (quase sem thinking = latência mínima).
  // Modelos Gemini 4 (hydrogen/argon/neon) têm 'low' como menor nível de latência.
  return model.includes('flash-lite') ? 'minimal' : 'low';
}

function sanitizeCategory(raw: string | undefined): PantryCategory {
  if (!raw) return 'Mercearia';
  const match = VALID_CATEGORIES.find(
    (cat) => cat.toLowerCase() === raw.trim().toLowerCase()
  );
  return match ?? 'Mercearia';
}

async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let delayMs = 600;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: number }).status)
          : undefined;

      if (status && status !== 429 && status < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
  }

  throw lastError;
}

const OCR_JSON_SCHEMA = {
  type: 'object',
  properties: {
    produto: {
      type: 'string',
      description:
        'Nome específico do alimento, fruta, bebida ou suplemento identificado visualmente na foto.',
    },
    categoria: {
      type: 'string',
      enum: VALID_CATEGORIES,
      description: 'Categoria do alimento ou suplemento.',
    },
    data_validade: {
      type: 'string',
      description: 'Data de validade no formato brasileiro DD/MM/AAAA.',
    },
    confianca_ocr: {
      type: 'string',
      description: 'Percentual estimado de confiança da identificação visual/OCR (ex: 97%).',
    },
    contexto_imagem: {
      type: 'string',
      description:
        'Descrição clara e detalhada do contexto visual da foto: o que aparece, quantidade aproximada, se está embalado/aberto/in natura, aparência, cor, maturação ou marca visível.',
    },
    estado_conservacao: {
      type: 'string',
      description:
        'Avaliação visual do estado atual (ex: "Fresco e firme", "Maduro — consumir em breve", "Embalagem lacrada", "Aberto/parcial").',
    },
    dica_conservacao: {
      type: 'string',
      description: 'Recomendação prática de armazenamento para durar mais tempo.',
    },
    sugestao_uso: {
      type: 'string',
      description: 'Ideia rápida de preparo ou consumo adequada a este alimento.',
    },
    lote_ou_obs: {
      type: 'string',
      description:
        'Informe se a data foi lida de carimbo/rótulo impresso ou estimada pela aparência visual.',
    },
  },
  required: [
    'produto',
    'categoria',
    'data_validade',
    'confianca_ocr',
    'contexto_imagem',
    'estado_conservacao',
    'dica_conservacao',
    'sugestao_uso',
    'lote_ou_obs',
  ],
};

const RECIPES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    resumo_alerta: {
      type: 'string',
      description: 'Mensagem amigável e direta de alerta para WhatsApp/Telegram.',
    },
    receitas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          tempo_preparo: { type: 'string' },
          dificuldade: { type: 'string' },
          ingredientes_usados: { type: 'array', items: { type: 'string' } },
          passo_a_passo: { type: 'array', items: { type: 'string' } },
          dica_nutricional: { type: 'string' },
          termo_busca_link: { type: 'string' },
        },
        required: [
          'titulo',
          'tempo_preparo',
          'dificuldade',
          'ingredientes_usados',
          'passo_a_passo',
          'dica_nutricional',
          'termo_busca_link',
        ],
      },
    },
  },
  required: ['resumo_alerta', 'receitas'],
};

class GeminiService {
  private client: GoogleGenAI | null = null;

  resetClient(): void {
    this.client = null;
  }

  private getClient(): GoogleGenAI | null {
    if (!env.hasGeminiKey) return null;
    if (!this.client) {
      // Multimodal input (type: 'image') na Interactions API requer apiVersion: 'v1beta'
      this.client = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY,
        apiVersion: 'v1beta',
      });
    }
    return this.client;
  }

  /**
   * Valida uma chave Gemini em tempo real via Interactions API antes de salvá-la no .env.
   */
  async verifyApiKey(
    apiKey: string,
    model = env.GEMINI_MODEL
  ): Promise<{ ok: boolean; model: string; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const testClient = new GoogleGenAI({
        apiKey: apiKey.trim(),
        apiVersion: 'v1beta',
      });
      const interaction = await testClient.interactions.create({
        model,
        input: 'Responda apenas: OK',
        generation_config: {
          thinking_level: getFastThinkingLevel(model),
          max_output_tokens: 256,
        },
        store: false,
      });
      if (!interaction.output_text) {
        return {
          ok: false,
          model,
          latencyMs: Date.now() - startedAt,
          error: 'A API respondeu sem texto de retorno.',
        };
      }
      return { ok: true, model, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao autenticar com a Gemini API.';
      return {
        ok: false,
        model,
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    }
  }

  /**
   * RF02 & RNF02 — Visão Computacional & OCR via Gemini Interactions API (@google/genai >= 3.5.0)
   * Identifica TANTO embalagens com rótulo/carimbo QUANTO alimentos in natura (frutas, legumes, pratos, etc.).
   */
  async analyzeProductImage(
    base64Image: string,
    mimeType = 'image/jpeg',
    fileName?: string
  ): Promise<OcrExtractionResult> {
    const startedAt = Date.now();
    const client = this.getClient();

    if (!client) {
      return this.buildOcrFallback(
        fileName,
        Date.now() - startedAt,
        'Chave GEMINI_API_KEY não configurada ainda. Cole sua chave no topo da tela para identificar o alimento real pela foto!',
        true
      );
    }

    const todayBr = addDaysToToday(0);
    const systemInstruction = `Você é um especialista em Visão Computacional de Alimentos, Nutrição e OCR de embalagens no Brasil.
Analise detalhadamente o CONTEXTO VISUAL completo da foto enviada pelo usuário.
Data de hoje: ${todayBr}.

Regras obrigatórias:
1. PRODUTO / ALIMENTO:
   - Se for produto embalado: identifique marca, nome comercial, sabor e peso quando visíveis.
   - Se for alimento in natura (fruta, legume, pão, queijo, carne, ovos, etc.): identifique o alimento exato e variedade aparente (ex: "Maçã Vermelha Gala", "Banana Prata Madura").
   - Se NÃO for alimento/suplemento, informe claramente o que realmente aparece na foto.
2. CONTEXTO DA IMAGEM (contexto_imagem): descreva de forma clara e rica o que aparece na foto (aparência, cor, quantidade, se está embalado/aberto/in natura, maturação e cenário).
3. ESTADO VISUAL (estado_conservacao): avalie frescor/maturação ou condição da embalagem (ex: "Fresco e firme", "Maduro — consumir em breve", "Embalagem lacrada").
4. CONSERVAÇÃO (dica_conservacao) e USO (sugestao_uso): dê 1 dica prática de armazenamento e 1 ideia rápida de preparo/consumo.
5. DATA DE VALIDADE (RNF02):
   - Se houver data impressa/carimbada (DD/MM/AAAA ou MM/AAAA), extraia em DD/MM/AAAA (MM/AAAA vira último dia do mês).
   - Se NÃO houver data impressa visível, estime uma data realista a partir de ${todayBr} conforme o tipo e aparência do alimento e explique em lote_ou_obs.
6. CATEGORIA: escolha estritamente entre "Suplemento", "Grãos & Cereais", "Laticínios", "Hortifruti", "Mercearia", "Geral".
Retorne ESTRITAMENTE JSON válido conforme o schema.`;

    try {
      const interaction = await withExponentialBackoff(() =>
        client.interactions.create({
          model: env.GEMINI_MODEL,
          system_instruction: systemInstruction,
          input: [
            {
              type: 'text',
              text: 'Identifique o alimento/produto nesta imagem, categoria e validade (DD/MM/AAAA):',
            },
            {
              type: 'image',
              data: base64Image,
              mime_type: mimeType,
              resolution: 'medium',
            },
          ],
          generation_config: {
            thinking_level: getFastThinkingLevel(env.GEMINI_MODEL),
            max_output_tokens: 2048,
          },
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: OCR_JSON_SCHEMA,
          },
          store: false,
        })
      );

      const rawText = interaction.output_text;
      if (!rawText) {
        throw new Error('Resposta vazia retornada pela Gemini Interactions API.');
      }

      const parsed = JSON.parse(rawText) as {
        produto?: string;
        categoria?: string;
        data_validade?: string;
        confianca_ocr?: string;
        contexto_imagem?: string;
        estado_conservacao?: string;
        dica_conservacao?: string;
        sugestao_uso?: string;
        lote_ou_obs?: string;
      };

      const normalizedDate =
        (parsed.data_validade && normalizeBrazilianDate(parsed.data_validade)) ||
        addDaysToToday(7);

      return {
        produto: (parsed.produto || 'Alimento Identificado').trim(),
        categoria: sanitizeCategory(parsed.categoria),
        data_validade: normalizedDate,
        confianca_ocr: (parsed.confianca_ocr || '95%').trim(),
        contexto_imagem: parsed.contexto_imagem?.trim(),
        estado_conservacao: parsed.estado_conservacao?.trim(),
        dica_conservacao: parsed.dica_conservacao?.trim(),
        sugestao_uso: parsed.sugestao_uso?.trim(),
        lote_ou_obs: (
          parsed.lote_ou_obs || 'Identificação visual concluída via Gemini Vision.'
        ).trim(),
        aiMode: 'gemini',
        modelUsed: env.GEMINI_MODEL,
        latencyMs: Date.now() - startedAt,
        requiresApiKey: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido na API Gemini';
      console.warn('[GeminiService] Fallback OCR acionado:', reason);
      return this.buildOcrFallback(
        fileName,
        Date.now() - startedAt,
        `Erro ao consultar Gemini Vision: ${reason.slice(0, 160)}`,
        false
      );
    }
  }

  /**
   * RF07 — Curadoria Inteligente de Receitas via Gemini Interactions API
   */
  async curateAntiWasteRecipes(
    expiringItems: EnrichedPantryItem[],
    otherStockItems: EnrichedPantryItem[]
  ): Promise<RecipeCuratorOutput> {
    const startedAt = Date.now();
    const client = this.getClient();

    if (!client) {
      return this.buildRecipesFallback(
        expiringItems,
        otherStockItems,
        Date.now() - startedAt
      );
    }

    const systemInstruction = `Você é um Nutricionista e Chef Inteligente integrado ao Assistente Inteligente de Despensa.
Sua missão é reduzir o desperdício doméstico criando exatamente 2 receitas práticas, rápidas e saborosas que utilizem OBRIGATORIAMENTE os itens prestes a vencer combinados com ingredientes válidos já presentes no estoque do usuário.
Escreva em português do Brasil claro, direto e pronto para envio em mensagens de WhatsApp ou Telegram.`;

    const expiringList =
      expiringItems.length > 0
        ? expiringItems
            .map(
              (item) =>
                `- ${item.produto} (${item.categoria}) — Vence em ${item.diasRestantes} dia(s) (${item.data_validade})`
            )
            .join('\n')
        : '- Nenhum item crítico listado';

    const stockList =
      otherStockItems.length > 0
        ? otherStockItems
            .map((item) => `- ${item.produto} (${item.categoria}, validade ${item.data_validade})`)
            .join('\n')
        : '- Itens básicos de cozinha (água, sal, azeite)';

    const userPrompt = `ITENS PRESTES A VENCER (Prioridade Máxima — Janela <= ${env.ALERT_WINDOW_DAYS} dias):
${expiringList}

DEMAIS ITENS DISPONÍVEIS NA DESPENSA DO USUÁRIO:
${stockList}

Gere 2 sugestões práticas de preparo cruzando os itens prestes a vencer com o estoque disponível, além de um resumo curto para o alerta no chat e um termo de busca para passo a passo na web.`;

    try {
      const interaction = await withExponentialBackoff(() =>
        client.interactions.create({
          model: env.GEMINI_MODEL,
          system_instruction: systemInstruction,
          input: userPrompt,
          generation_config: {
            thinking_level: getFastThinkingLevel(env.GEMINI_MODEL),
            max_output_tokens: 3000,
          },
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: RECIPES_JSON_SCHEMA,
          },
          store: false,
        })
      );

      const rawText = interaction.output_text;
      if (!rawText) {
        throw new Error('Resposta vazia da curadoria de receitas Gemini.');
      }

      const parsed = JSON.parse(rawText) as {
        resumo_alerta: string;
        receitas: RecipeCuratorOutput['receitas'];
      };

      return {
        resumo_alerta: parsed.resumo_alerta,
        receitas: parsed.receitas,
        aiMode: 'gemini',
        modelUsed: env.GEMINI_MODEL,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido na API Gemini';
      console.warn('[GeminiService] Fallback de receitas acionado:', reason);
      return this.buildRecipesFallback(
        expiringItems,
        otherStockItems,
        Date.now() - startedAt
      );
    }
  }

  private buildOcrFallback(
    fileName: string | undefined,
    latencyMs: number,
    note: string,
    requiresApiKey: boolean
  ): OcrExtractionResult {
    const cleanName = fileName
      ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
      : '';
    return {
      produto: requiresApiKey
        ? 'IA Gemini não ativada (configure sua chave)'
        : cleanName || 'Alimento não identificado',
      categoria: 'Mercearia',
      data_validade: addDaysToToday(4),
      confianca_ocr: requiresApiKey ? 'Aguardando Chave' : 'Fallback',
      lote_ou_obs: note,
      aiMode: 'fallback',
      modelUsed: 'local-fallback',
      latencyMs,
      requiresApiKey,
    };
  }

  private buildRecipesFallback(
    expiringItems: EnrichedPantryItem[],
    otherStockItems: EnrichedPantryItem[],
    latencyMs: number
  ): RecipeCuratorOutput {
    const expiringNames = expiringItems.map((i) => i.produto);
    const companionNames = otherStockItems.slice(0, 3).map((i) => i.produto);
    const primaryItem = expiringNames[0] ?? 'item próximo do vencimento';

    return {
      resumo_alerta: `Identificamos ${expiringItems.length} item(ns) entrando na janela crítica de ${env.ALERT_WINDOW_DAYS} dias! Cruzamos com seu estoque ativo para sugerir preparos imediatos anti-desperdício:`,
      receitas: [
        {
          titulo: `Shake Proteico Funcional com ${primaryItem}`,
          tempo_preparo: '5 minutos',
          dificuldade: 'Muito Fácil',
          ingredientes_usados: [
            ...expiringItems.map((i) => `${i.produto} (Vence em ${i.diasRestantes}d)`),
            ...companionNames.slice(0, 2),
          ],
          passo_a_passo: [
            'Separe no liquidificador os itens prioritários próximos do vencimento com 200 ml de água gelada ou leite de sua preferência.',
            `Adicione os acompanhamentos disponíveis na despensa (${companionNames.slice(0, 2).join(', ') || 'aveia ou proteína em pó'}).`,
            'Bata por 45 segundos até atingir textura cremosa e consuma imediatamente.',
          ],
          dica_nutricional:
            'Aproveita integralmente os nutrientes dos itens perecíveis e suplementos antes da perda de validade.',
          termo_busca_link: `receita rapida ${expiringNames.join(' ')} ${companionNames[0] ?? ''}`.trim(),
        },
        {
          titulo: 'Bowl / Panqueca Express Anti-Desperdício',
          tempo_preparo: '10 minutos',
          dificuldade: 'Fácil',
          ingredientes_usados: [
            ...expiringNames,
            ...(companionNames.length > 0 ? companionNames : ['Ovos', 'Aveia em Flocos']),
          ],
          passo_a_passo: [
            'Misture os ingredientes secos ou proteicos do estoque com os itens prioritários em um bowl até formar massa homogênea.',
            'Prepare em frigideira antiaderente em fogo baixo por 2 a 3 minutos de cada lado (ou sirva em bowl gelado se forem ingredientes prontos).',
            'Finalize com cobertura usando a pasta ou topping próximo do vencimento.',
          ],
          dica_nutricional:
            'Refeição equilibrada de preparo rápido que zera desperdício no dia a dia.',
          termo_busca_link: `receita pratica panqueca bowl ${expiringNames.join(' ')}`.trim(),
        },
      ],
      aiMode: 'fallback',
      modelUsed: 'local-fallback',
      latencyMs,
    };
  }
}

export const geminiService = new GeminiService();
