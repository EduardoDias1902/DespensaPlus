import { GoogleGenAI } from '@google/genai';

interface VercelReq {
  method?: string;
  body?: {
    base64Image?: string;
    mimeType?: string;
    fileName?: string;
  };
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (body: unknown) => void;
}

const VALID_CATEGORIES = [
  'Suplemento',
  'Grãos & Cereais',
  'Laticínios',
  'Hortifruti',
  'Mercearia',
  'Geral',
] as const;

function addDaysToToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeBrDate(raw: string | undefined): string {
  if (!raw) return addDaysToToday(7);
  const cleaned = raw.trim().replace(/[-.]/g, '/');
  const full = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (full) {
    const year = Number(full[3]) < 100 ? 2000 + Number(full[3]) : Number(full[3]);
    return `${String(Number(full[1])).padStart(2, '0')}/${String(Number(full[2])).padStart(2, '0')}/${year}`;
  }
  const my = /^(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (my) {
    const month = Number(my[1]);
    const year = Number(my[2]) < 100 ? 2000 + Number(my[2]) : Number(my[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  return addDaysToToday(7);
}

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    produto: { type: 'string' },
    categoria: { type: 'string', enum: [...VALID_CATEGORIES] },
    data_validade: { type: 'string' },
    confianca_ocr: { type: 'string' },
    contexto_imagem: { type: 'string' },
    estado_conservacao: { type: 'string' },
    dica_conservacao: { type: 'string' },
    sugestao_uso: { type: 'string' },
    lote_ou_obs: { type: 'string' },
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

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startedAt = Date.now();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const rawBase64 = req.body?.base64Image || '';
  const mimeType = req.body?.mimeType || 'image/jpeg';
  const fileName = req.body?.fileName || '';

  if (!rawBase64) {
    res.status(400).json({ error: 'Imagem base64 não enviada.' });
    return;
  }

  const base64Image = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;

  if (!apiKey || apiKey.startsWith('coloque_sua_') || apiKey.startsWith('your_')) {
    const cleanName = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    res.status(200).json({
      extracted: {
        produto: cleanName || 'Produto Alimentício Identificado',
        categoria: 'Mercearia',
        data_validade: addDaysToToday(5),
        confianca_ocr: 'Demo',
        contexto_imagem:
          'Modo demonstração ativo na Vercel — adicione GEMINI_API_KEY nas Environment Variables do projeto na Vercel e faça Redeploy para analisar o contexto real da foto.',
        lote_ou_obs: 'GEMINI_API_KEY não definida no ambiente Vercel.',
        aiMode: 'fallback',
        modelUsed: 'local-fallback',
        latencyMs: Date.now() - startedAt,
      },
      savedItem: null,
    });
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const todayBr = addDaysToToday(0);
    const thinkingLevel = model.includes('flash-lite') ? 'minimal' : 'low';

    const interaction = await client.interactions.create({
      model,
      system_instruction: `Você é um especialista em Visão Computacional de Alimentos, Nutrição e OCR de embalagens no Brasil. Data de hoje: ${todayBr}.
Analise detalhadamente o CONTEXTO VISUAL completo da foto:
1. Identifique exatamente o alimento, fruta, bebida ou suplemento (marca, sabor, quantidade aproximada). Se NÃO for alimento, descreva o que realmente aparece na imagem.
2. Em contexto_imagem, descreva de forma rica e natural o que você vê (cor, formato, frescor/maturação, se está embalado, lacrado, aberto ou in natura, cenário).
3. Em estado_conservacao, avalie o estado visual atual (ex: "Fresco e firme", "Maduro — consumir em 2-3 dias", "Embalagem lacrada").
4. Em dica_conservacao, dê uma dica prática de armazenamento.
5. Em sugestao_uso, sugira uma forma rápida de consumir ou preparar esse item.
6. Em data_validade, extraia a validade impressa (DD/MM/AAAA ou MM/AAAA -> último dia do mês) ou, se não houver data visível, estime realisticamente a partir de ${todayBr} conforme o tipo e aparência.
7. Categoria deve ser estritamente: "Suplemento", "Grãos & Cereais", "Laticínios", "Hortifruti", "Mercearia" ou "Geral".`,
      input: [
        {
          type: 'text',
          text: 'Analise o contexto visual completo desta foto, identifique o alimento/produto, estado de conservação, dicas e validade (DD/MM/AAAA):',
        },
        {
          type: 'image',
          data: base64Image,
          mime_type: mimeType,
          resolution: 'medium',
        },
      ],
      generation_config: {
        thinking_level: thinkingLevel,
        max_output_tokens: 2048,
      },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: OCR_SCHEMA,
      },
      store: false,
    });

    const rawText = interaction.output_text;
    if (!rawText) {
      throw new Error('Resposta vazia retornada pela Gemini API.');
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

    const validCategory =
      VALID_CATEGORIES.find(
        (c) => c.toLowerCase() === (parsed.categoria || '').trim().toLowerCase()
      ) ?? 'Mercearia';

    res.status(200).json({
      extracted: {
        produto: (parsed.produto || 'Alimento Identificado').trim(),
        categoria: validCategory,
        data_validade: normalizeBrDate(parsed.data_validade),
        confianca_ocr: (parsed.confianca_ocr || '96%').trim(),
        contexto_imagem: parsed.contexto_imagem?.trim(),
        estado_conservacao: parsed.estado_conservacao?.trim(),
        dica_conservacao: parsed.dica_conservacao?.trim(),
        sugestao_uso: parsed.sugestao_uso?.trim(),
        lote_ou_obs: (parsed.lote_ou_obs || 'Identificado via Gemini Vision.').trim(),
        aiMode: 'gemini',
        modelUsed: model,
        latencyMs: Date.now() - startedAt,
      },
      savedItem: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    res.status(200).json({
      extracted: {
        produto: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Alimento Identificado',
        categoria: 'Mercearia',
        data_validade: addDaysToToday(5),
        confianca_ocr: 'Fallback',
        lote_ou_obs: `Falha ao consultar Gemini Vision: ${message.slice(0, 150)}`,
        aiMode: 'fallback',
        modelUsed: 'local-fallback',
        latencyMs: Date.now() - startedAt,
      },
      savedItem: null,
    });
  }
}
