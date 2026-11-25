import { GoogleGenAI } from '@google/genai';

interface PantryItemPayload {
  id: number;
  produto: string;
  categoria: string;
  data_validade: string;
  diasRestantes: number;
  computedStatus: string;
}

interface VercelReq {
  method?: string;
  body?: {
    source?: string;
    items?: PantryItemPayload[];
  };
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (body: unknown) => void;
}

const RECIPES_SCHEMA = {
  type: 'object',
  properties: {
    resumo_alerta: { type: 'string' },
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

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startedAt = Date.now();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const activeItems = items
    .filter((i) => i.computedStatus === 'Em estoque')
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
  const expiringSoon = activeItems.filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 5);
  const targetExpiring = expiringSoon.length > 0 ? expiringSoon : activeItems.slice(0, 2);
  const otherValid = activeItems.filter(
    (i) => !targetExpiring.some((exp) => exp.id === i.id)
  );

  const fallback = {
    resumo_alerta: `Identificamos ${targetExpiring.length} item(ns) na janela crítica de 5 dias! Cruzamos com seu estoque ativo:`,
    aiMode: 'fallback' as const,
    modelUsed: 'local-fallback',
    latencyMs: Date.now() - startedAt,
    receitas: [
      {
        titulo: `Shake Proteico Funcional com ${targetExpiring[0]?.produto || 'itens da despensa'}`,
        tempo_preparo: '5 minutos',
        dificuldade: 'Muito Fácil',
        ingredientes_usados: [
          ...targetExpiring.map((i) => `${i.produto} (${i.diasRestantes}d)`),
          ...otherValid.slice(0, 2).map((i) => i.produto),
        ],
        passo_a_passo: [
          'Adicione no liquidificador os itens próximos do vencimento com 200 ml de água gelada.',
          'Acrescente acompanhamentos do estoque ativo e bata por 45 segundos.',
          'Consuma imediatamente.',
        ],
        dica_nutricional: 'Aproveitamento integral antes da perda de validade.',
        termo_busca_link: `receita pratica ${targetExpiring.map((i) => i.produto).join(' ')}`,
      },
    ],
  };

  if (!apiKey || apiKey.startsWith('coloque_sua_') || apiKey.startsWith('your_')) {
    res.status(200).json({
      timestamp: nowTime(),
      expiringCount: targetExpiring.length,
      otherCount: otherValid.length,
      expiringItems: targetExpiring,
      aiData: fallback,
      logs: [
        { time: `${nowTime()}:01`, node: 'Schedule Trigger (Vercel)', status: 'OK', detail: 'Varredura concluída' },
        { time: `${nowTime()}:02`, node: 'Gemini Curator', status: 'WARN', detail: 'Defina GEMINI_API_KEY na Vercel para receitas reais' },
      ],
    });
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const thinkingLevel = model.includes('flash-lite') ? 'minimal' : 'low';
    const prompt = `ITENS PRESTES A VENCER (<= 5 dias):
${targetExpiring.map((i) => `- ${i.produto} (vence em ${i.diasRestantes}d - ${i.data_validade})`).join('\n') || '- Nenhum'}

DEMAIS ITENS DISPONÍVEIS NO ESTOQUE:
${otherValid.map((i) => `- ${i.produto} (${i.categoria})`).join('\n') || '- Itens básicos'}

Gere 2 receitas práticas e rápidas em português do Brasil cruzando os itens prestes a vencer com o estoque disponível.`;

    const interaction = await client.interactions.create({
      model,
      system_instruction:
        'Você é um Nutricionista e Chef Inteligente focado em reduzir desperdício doméstico. Responda estritamente no JSON Schema solicitado.',
      input: prompt,
      generation_config: {
        thinking_level: thinkingLevel,
        max_output_tokens: 3000,
      },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: RECIPES_SCHEMA,
      },
      store: false,
    });

    const parsed = JSON.parse(interaction.output_text || '{}') as {
      resumo_alerta: string;
      receitas: typeof fallback.receitas;
    };

    const latencyMs = Date.now() - startedAt;
    res.status(200).json({
      timestamp: nowTime(),
      expiringCount: targetExpiring.length,
      otherCount: otherValid.length,
      expiringItems: targetExpiring,
      aiData: {
        resumo_alerta: parsed.resumo_alerta,
        receitas: parsed.receitas,
        aiMode: 'gemini',
        modelUsed: model,
        latencyMs,
      },
      logs: [
        { time: `${nowTime()}:01`, node: 'Schedule Trigger (00:00)', status: 'OK', detail: 'Pipeline iniciado' },
        { time: `${nowTime()}:02`, node: 'Filtro <= 5 dias', status: 'OK', detail: `${targetExpiring.length} item(ns) críticos encontrados` },
        { time: `${nowTime()}:03`, node: `Gemini Curator (${model})`, status: 'OK', detail: `${parsed.receitas.length} receitas geradas em ${(latencyMs / 1000).toFixed(2)}s` },
        { time: `${nowTime()}:04`, node: 'Disparo Ativo (RF08)', status: 'OK', detail: 'Alerta entregue no chat' },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    res.status(200).json({
      timestamp: nowTime(),
      expiringCount: targetExpiring.length,
      otherCount: otherValid.length,
      expiringItems: targetExpiring,
      aiData: fallback,
      logs: [
        { time: `${nowTime()}:01`, node: 'Gemini Curator', status: 'WARN', detail: `Fallback: ${msg.slice(0, 120)}` },
      ],
    });
  }
}
