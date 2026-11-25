export const ANTIGRAVITY_MASTER_PROMPT = `# MASTER PROMPT — ASSISTENTE INTELIGENTE DE DESPENSA (SMART PANTRY ASSISTANT MVP)

Atue como um **Engenheiro de Software Full-Stack Sênior** e **Arquiteto de Automação com IA**.
Construa e valide a aplicação full-stack **"Smart Pantry Assistant MVP"** seguindo fielmente a arquitetura API-First, regras de negócio, requisitos funcionais (RF01–RF08), requisitos não-funcionais (RNF01–RNF06) e estrutura de pastas abaixo.

---

## 1. CONTEXTO E DECLARAÇÃO DO PROBLEMA
Alimentos básicos (feijão, farinha, frutas, laticínios) e suplementos nutricionais (whey protein, pasta de amendoim zero lactose, suco verde em pó) frequentemente vencem no fundo da despensa por dois gargalos:
1. **Alto atrito de entrada**: digitar nome, categoria e data de validade manualmente gera abandono; leitores de código de barras (EAN-13) identificam apenas o produto genérico, nunca o lote/validade física.
2. **Alertas passivos e isolados**: avisar que um item vence amanhã não diz o que cozinhar com ele usando o restante do estoque.

**Objetivo do MVP**: Eliminar a fricção de cadastro via **foto no Chatbot (Telegram/WhatsApp) + OCR Multimodal com Google Gemini** e transformar alertas de vencimento em **sugestões práticas de receitas cruzando todo o estoque ativo do usuário**.

---

## 2. ARQUITETURA FULL-STACK (API-FIRST & CONTEINERIZADA)
Organize o repositório como monorepo desacoplado (\`frontend/\`, \`backend/\`, \`infra/\`, \`docs/\`):

### A) Backend (\`backend/\` — Node.js 22 + Express + TypeScript Strict)
- **Segurança (RNF05)**: TODAS as chamadas à API do Gemini (\`GEMINI_API_KEY\`), Supabase (\`SUPABASE_SERVICE_ROLE_KEY\`) e bots (\`TELEGRAM_BOT_TOKEN\`, \`WHATSAPP_ACCESS_TOKEN\`) ocorrem **exclusivamente no backend**, lidas via \`.env\` validado com \`zod\`. Jamais exponha chaves no frontend.
- **Inteligência Artificial (\`@google/genai\` >= 3.5.0 — Interactions API)**:
  - Use a API moderna \`client.interactions.create(...)\` com \`new GoogleGenAI({ apiKey, apiVersion: "v1beta" })\` (obrigatório para \`type: "image"\`) e \`model: process.env.GEMINI_MODEL || "gemini-4-hydrogen"\` (alternativas atuais: \`gemini-4-argon\` e \`gemini-3.5-flash-lite\`).
  - Retry com exponential backoff (4 tentativas para HTTP 429/5xx), JSON Schema estrito via \`response_format: { type: "text", mime_type: "application/json", schema }\` e \`store: false\` para privacidade (RNF05), lendo \`interaction.output_text\`.
  - **Serviço 1 — Visão & OCR (RF02 / RNF02)**: recebe imagem (\`multipart/form-data\` ou base64) e extrai \`{ produto, categoria, data_validade, confianca_ocr, lote_ou_obs }\`, interpretando datas brasileiras \`DD/MM/AAAA\`, \`DD/MM/AA\`, \`MM/AAAA\` (convertendo \`MM/AAAA\` para o último dia do mês) mesmo em carimbos pontilhados borrados ou embalagens curvas.
  - **Serviço 2 — Curadoria de Receitas (RF07)**: cruza itens ativos com validade \`<= 5 dias\` contra os demais itens válidos da despensa e gera 2 receitas práticas com ingredientes, passo a passo, dica nutricional e termo de busca de link.
- **Persistência Dual (RF04 / RNF06)**:
  - Modo Produção: **Supabase PostgreSQL** via \`@supabase/supabase-js\` nas tabelas \`usuarios\`, \`despensa\` e \`logs_notificacoes\`.
  - Modo Local Zero-Config: fallback automático para arquivo JSON (\`backend/data/pantry.json\`) quando \`SUPABASE_URL\` não estiver preenchido, garantindo execução imediata em apresentações.
- **Motor Cron + Isolamento de Falhas (RF06 / RF08 / RNF04)**:
  - \`node-cron\` diário às \`00:00\` (\`America/Sao_Paulo\`) + endpoint manual \`POST /api/cron/run\`.
  - Cada usuário é processado em \`try/catch\` isolado para que a falha de disparo de um usuário não interrompa a fila dos demais.
  - Endpoint \`GET /api/cron/summary\` gera o **Resumo Semanal** (Prioridade 2 da Matriz Impacto x Esforço).
- **Webhooks & Comandos (RF01 / RF05)**:
  - \`POST /api/chat/command\`: suporta \`/estoque\`, \`/consumido\`, \`/consumido <id>\`, \`/consumido <nome>\`, \`/alerta\`, \`/resumo\`.
  - \`POST /api/webhooks/telegram\` e \`GET|POST /api/webhooks/whatsapp\` prontos para produção.

### B) Frontend (\`frontend/\` — React 19 + Vite + TypeScript Strict + Tailwind CSS v4 + Lucide)
Interface dark responsiva dividida em 4 abas integradas à API REST (\`VITE_API_URL\`):
1. **Bot & Gemini OCR (Chat — RF01 a RF05)**: upload real de foto via câmera/arquivo + 5 embalagens de amostra para demo, indicador de latência (< 10s RNF01) e modo IA (\`Gemini Live\` vs \`Demo\`), cartão de confirmação editável (permite ajustar **nome do produto** e **data** com validação \`DD/MM/AAAA\` e \`MM/AAAA\` antes de salvar) e barra de comandos rápidos.
2. **Despensa Supabase (PostgreSQL Live View — RF04)**: busca por texto, filtros por status (\`Todos\`, \`Em estoque\`, \`Alerta <= 5d\`, \`Consumido\`, \`Vencido\`), inserção manual, botões \`-5d / +5d\` para simular aproximação de vencimento em tempo real, baixa rápida (\`Consumir / Reativar\`) e exclusão.
3. **Motor n8n & Receitas IA (00:00 — RF06 a RF08)**: pipeline visual de 5 nós com destaque animado da etapa ativa, botão para disparar o Cron manualmente, exibição das receitas geradas com links externos, console de logs do contêiner e prévia do Resumo Semanal por e-mail.
4. **Planejamento & Prompt Antigravity**: Master Prompt copiável, DDL SQL do Supabase, \`docker-compose.yml\`, guia de configuração da chave Gemini (incluindo resgate de créditos mensais da assinatura Google AI Pro no Google AI Studio), Matriz Impacto x Esforço, Matriz 5W2H e Cronograma de 6 meses.

### C) Infraestrutura (\`infra/\` — RNF03)
- \`infra/docker-compose.yml\`: contêineres \`backend\`, \`frontend\` (Nginx) e \`n8n\` com timezone \`America/Sao_Paulo\` e variáveis injetadas via \`.env\`.
- \`infra/supabase/migrations/001_init.sql\`: tabelas \`usuarios\`, \`despensa\`, \`logs_notificacoes\`, índices, trigger \`updated_at\`, função \`marcar_itens_vencidos()\`, view \`vw_itens_alerta_vencimento\` e políticas RLS.
- \`infra/n8n/workflow-capture-ocr.json\` e \`infra/n8n/workflow-cron-recipes.json\`: fluxos n8n reais prontos para importação.

---

## 3. CONTRATO DE ENDPOINTS REST DO BACKEND
- \`GET /api/health\` → status de storage (\`supabase\`|\`local-json\`), Gemini (\`geminiConfigured\`, \`geminiModel\`), bots e cron.
- \`GET /api/pantry\` | \`POST /api/pantry\` | \`PATCH /api/pantry/:id/status\` | \`PATCH /api/pantry/:id/shift-date\` | \`DELETE /api/pantry/:id\`
- \`POST /api/ocr/analyze\` → aceita \`multipart/form-data\` (\`image\`) ou JSON (\`base64Image\`, \`mimeType\`, \`autoSave\`).
- \`POST /api/chat/command\` → executa comandos de texto (\`/estoque\`, \`/consumido <id|nome>\`, \`/alerta\`, \`/resumo\`).
- \`POST /api/cron/run\` | \`GET /api/cron/logs\` | \`GET /api/cron/summary\`
- \`POST /api/webhooks/telegram\` | \`GET /api/webhooks/whatsapp\` | \`POST /api/webhooks/whatsapp\`

---

## 4. CRITÉRIOS DE ACEITE E VERIFICAÇÃO
1. \`npm run typecheck\` passa sem erros em \`backend/\` e \`frontend/\`.
2. \`npm run test:backend\` valida parsing de datas \`DD/MM/AAAA\`, \`MM/AAAA\`, ano bissexto e cálculo de dias restantes.
3. Nenhuma chave de API aparece no bundle do frontend (RNF05).
4. O fluxo completo (upload de foto → OCR → confirmação/edição → persistência → disparo de receitas) conclui em menos de 10s em conexão normal (RNF01) e continua operacional em modo demonstração caso credenciais externas ainda não tenham sido preenchidas.`;

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- MIGRATION 001 — SMART PANTRY ASSISTANT MVP (SUPABASE POSTGRESQL)
-- Requisitos: RF04, RF06, RF07, RF08, RNF05 (Segurança) e RNF06 (API-First)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    chat_id TEXT UNIQUE NOT NULL,
    canal TEXT NOT NULL DEFAULT 'telegram' CHECK (canal IN ('telegram', 'whatsapp', 'web')),
    email TEXT,
    janela_seguranca_dias INT NOT NULL DEFAULT 5 CHECK (janela_seguranca_dias BETWEEN 1 AND 60),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.despensa (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    produto TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Mercearia'
        CHECK (categoria IN ('Suplemento', 'Grãos & Cereais', 'Laticínios', 'Hortifruti', 'Mercearia', 'Geral')),
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    data_validade DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em estoque' CHECK (status IN ('Em estoque', 'Consumido', 'Vencido')),
    confianca_ocr TEXT DEFAULT 'Manual',
    lote_ou_obs TEXT,
    imagem_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.logs_notificacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    canal TEXT NOT NULL DEFAULT 'telegram',
    tipo TEXT NOT NULL DEFAULT 'alerta_vencimento'
        CHECK (tipo IN ('alerta_vencimento', 'resumo_semanal', 'ocr_confirmacao', 'erro_pipeline')),
    itens_criticos JSONB NOT NULL DEFAULT '[]'::jsonb,
    receitas_geradas JSONB NOT NULL DEFAULT '[]'::jsonb,
    status_envio TEXT NOT NULL DEFAULT 'OK' CHECK (status_envio IN ('OK', 'FALLBACK', 'ERRO')),
    detalhe_erro TEXT,
    latencia_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despensa_validade_status ON public.despensa (status, data_validade);
CREATE INDEX IF NOT EXISTS idx_despensa_user_id ON public.despensa (user_id);

CREATE OR REPLACE VIEW public.vw_itens_alerta_vencimento AS
SELECT
    d.id, d.user_id, u.nome AS nome_usuario, u.chat_id, u.canal,
    d.produto, d.categoria, d.data_validade,
    (d.data_validade - CURRENT_DATE) AS dias_restantes
FROM public.despensa d
JOIN public.usuarios u ON u.id = d.user_id
WHERE u.ativo = true
  AND d.status = 'Em estoque'
  AND d.data_validade >= CURRENT_DATE
  AND (d.data_validade - CURRENT_DATE) <= u.janela_seguranca_dias;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_notificacoes ENABLE ROW LEVEL SECURITY;`;

export const DOCKER_COMPOSE_CONFIG = `# ============================================================================
# DOCKER COMPOSE — BACKEND + FRONTEND + N8N (RNF03 & RNF05)
# Execução: docker compose -f infra/docker-compose.yml up -d --build
# ============================================================================
services:
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    container_name: smart_pantry_backend
    restart: unless-stopped
    ports: ["3001:3001"]
    env_file: [../.env]
    environment:
      - NODE_ENV=production
      - TZ=America/Sao_Paulo
    volumes:
      - pantry_local_data:/app/data

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: \${VITE_API_URL:-http://localhost:3001}
    container_name: smart_pantry_frontend
    restart: unless-stopped
    ports: ["5173:80"]
    depends_on: [backend]

  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: smart_pantry_n8n
    restart: unless-stopped
    ports: ["5678:5678"]
    environment:
      - GENERIC_TIMEZONE=America/Sao_Paulo
      - TZ=America/Sao_Paulo
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - SUPABASE_URL=\${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=\${SUPABASE_SERVICE_ROLE_KEY}
      - TELEGRAM_BOT_TOKEN=\${TELEGRAM_BOT_TOKEN}
      - BACKEND_INTERNAL_URL=http://backend:3001
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n:/home/node/workflows:ro

volumes:
  n8n_data:
  pantry_local_data:`;

export const FIVE_W_TWO_H_ROWS = [
  {
    what: '1. Infraestrutura & Banco de Dados',
    why: 'Garantir ambiente padronizado em contêineres e persistência confiável.',
    where: 'Docker (Local/Cloud) + Supabase PostgreSQL.',
    when: 'Mês 1',
    who: 'Arquiteto / Dev Full-Stack',
    how: 'Subir stack Docker (backend, frontend, n8n) e rodar migration 001_init.sql no Supabase.',
    howMuch: 'R$ 0 a R$ 30/mês (Free Tier)',
  },
  {
    what: '2. Bot + Fluxo de Captura & OCR Gemini',
    why: 'Eliminar digitação manual cadastrando validade via foto no chat.',
    where: 'Backend API, n8n, Telegram/WhatsApp e Google AI Studio.',
    when: 'Meses 2 e 3',
    who: 'Desenvolvedor do Projeto',
    how: 'Webhook recebe foto → @google/genai extrai JSON (DD/MM/AAAA & MM/AAAA) → grava no Supabase.',
    howMuch: 'R$ 0 (Free Tier / Créditos Google AI Pro)',
  },
  {
    what: '3. Monitoramento 00:00 & Curadoria IA',
    why: 'Transformar alertas passivos em receitas práticas com o estoque real.',
    where: 'Cron Job (n8n / node-cron) + Supabase + Gemini.',
    when: 'Mês 4',
    who: 'Desenvolvedor do Projeto',
    how: 'Varredura diária <= 5 dias, cruzamento com estoque válido e disparo Markdown com links.',
    howMuch: 'R$ 0 (infra já provisionada)',
  },
  {
    what: '4. Testes Integrados & Homologação',
    why: 'Validar acurácia do OCR em rótulos reais e utilidade das receitas.',
    where: 'Smartphones reais (Telegram/WhatsApp) e Painel Web.',
    when: 'Mês 5',
    who: 'Desenvolvedor e voluntários',
    how: 'Fotografar grãos, laticínios e suplementos com carimbos variados e validar SLA < 10s.',
    howMuch: 'R$ 0 (itens domésticos próprios)',
  },
  {
    what: '5. Documentação Final & Roadmap v2.0',
    why: 'Consolidar métricas acadêmicas e visão de evolução mobile.',
    where: 'GitHub + Relatório Acadêmico.',
    when: 'Mês 6',
    who: 'Responsável pelo Projeto',
    how: 'Documentar taxa de acerto OCR, arquitetura API-First e protótipo Flutter/NFC-e.',
    howMuch: 'R$ 0 (dedicação técnica)',
  },
];

export const SCHEDULE_ROWS = [
  { fase: '1. Concepção (Problema, MVP, RF/RNF e 5W2H)', m: [1, 0, 0, 0, 0, 0] },
  { fase: '2. Infraestrutura (Docker, n8n, Backend API e Supabase SQL)', m: [1, 1, 0, 0, 0, 0] },
  { fase: '3. Visão e OCR (Bot Telegram/WhatsApp + Gemini Vision)', m: [0, 1, 1, 0, 0, 0] },
  { fase: '4. Persistência (Gravação automática e comandos /estoque)', m: [0, 0, 1, 0, 0, 0] },
  { fase: '5. Automação e Receitas (Cron 00:00 + Curadoria IA)', m: [0, 0, 1, 1, 0, 0] },
  { fase: '6. Notificações Ativas (Alertas no Chat + Resumo Semanal)', m: [0, 0, 0, 1, 1, 0] },
  { fase: '7. Homologação (Testes com embalagens reais e ajuste de prompt)', m: [0, 0, 0, 0, 1, 0] },
  { fase: '8. Entrega Final (Relatório técnico e apresentação do MVP)', m: [0, 0, 0, 0, 1, 1] },
];
