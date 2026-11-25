# MASTER PROMPT — ASSISTENTE INTELIGENTE DE DESPENSA (SMART PANTRY ASSISTANT MVP)

> **Como usar:** copie todo o bloco abaixo e cole em uma nova conversa do **Antigravity** (ou use com `/plan` ou `/boost`) sempre que quiser recriar, auditar ou evoluir este aplicativo para a Versão 2.0.

```markdown
Atue como um Engenheiro de Software Full-Stack Sênior e Arquiteto de Automação com IA.
Construa, refine e valide a aplicação full-stack **"Smart Pantry Assistant MVP"** seguindo rigorosamente o contexto de negócio, arquitetura API-First, requisitos funcionais (RF01–RF08), requisitos não-funcionais (RNF01–RNF06) e critérios de verificação abaixo.

## 1. DECLARAÇÃO DO PROBLEMA E PROPOSTA DO MVP
O desperdício doméstico de alimentos básicos (grãos, laticínios, hortifruti) e suplementos nutricionais (whey protein, pasta de amendoim zero lactose, suco verde em pó) acontece por:
1. Alto atrito no cadastro manual de validades (leitores EAN-13 não contêm lote nem data de validade da unidade física).
2. Alertas passivos e isolados que avisam o vencimento sem sugerir preparos práticos usando o restante da despensa.

**Solução MVP**: Assistente Inteligente de Despensa com entrada via foto no Chatbot (Telegram/WhatsApp) + OCR Multimodal via Google Gemini API, persistência em PostgreSQL (Supabase), varredura diária às 00:00 (n8n / node-cron) e disparo ativo de receitas anti-desperdício cruzando todo o estoque ativo do usuário.

## 2. ARQUITETURA FULL-STACK (MONOREPO DESACOPLADO)
Organize o projeto em:
- `backend/`: Node.js 22 + Express + TypeScript (`strict: true`) + `@google/genai` + `@supabase/supabase-js` + `node-cron` + `multer` + `zod`.
- `frontend/`: React 19 + Vite + TypeScript (`strict: true`) + Tailwind CSS v4 + `lucide-react`.
- `infra/`: `docker-compose.yml` (backend + frontend + n8n), `supabase/migrations/001_init.sql`, e fluxos JSON importáveis do n8n (`workflow-capture-ocr.json` e `workflow-cron-recipes.json`).
- `docs/`: Planejamento completo e guia de configuração de credenciais.

## 3. REGRAS DE SEGURANÇA E INTEGRAÇÃO IA (RNF05)
- NUNCA exponha `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` ou `WHATSAPP_ACCESS_TOKEN` no frontend. Todas as chamadas externas devem passar pelo backend.
- Use o SDK oficial `@google/genai` (>= 3.5.0) no backend com a **Interactions API** (`new GoogleGenAI({ apiKey, apiVersion: 'v1beta' })` + `client.interactions.create(...)` para suporte a `type: 'image'`) e `GEMINI_API_KEY` lida de `.env` (suportando Free Tier e créditos mensais do plano Google AI Pro resgatados no Google AI Studio) e `GEMINI_MODEL` configurável (padrão `gemini-4-hydrogen`; alternativas `gemini-4-argon` ou `gemini-3.5-flash-lite`).
- Implemente retry com exponential backoff (4 tentativas para HTTP 429/5xx), saída estruturada via `response_format: { type: "text", mime_type: "application/json", schema }`, `store: false` para privacidade (RNF05), leitura em `interaction.output_text` e modo fallback demonstrativo transparente quando chaves ainda não estiverem configuradas.

## 4. REQUISITOS FUNCIONAIS (RF01 a RF08) E NÃO-FUNCIONAIS (RNF01 a RNF06)
- **RF01 (Captura)**: Receber foto via upload web, Telegram Bot API (`POST /api/webhooks/telegram`) ou WhatsApp Cloud API (`GET/POST /api/webhooks/whatsapp`).
- **RF02 & RNF02 (Visão + OCR Tolerante)**: Extrair `{ produto, categoria, data_validade, confianca_ocr, lote_ou_obs }`, normalizando formatos brasileiros `DD/MM/AAAA`, `DD/MM/AA`, `MM/AAAA` (convertendo `MM/AAAA` para o último dia do mês) e datas ISO, mesmo em carimbos industriais pontilhados ou superfícies curvas.
- **RF03 (Confirmação)**: Responder em < 10s (RNF01) com cartão editável permitindo ajustar nome do produto e data de validade (com validação) ou descartar antes de persistir.
- **RF04 (Persistência Dual)**: Persistir nas tabelas PostgreSQL `usuarios`, `despensa` e `logs_notificacoes` no Supabase (com índices, trigger `updated_at`, view `vw_itens_alerta_vencimento` e RLS). Se `SUPABASE_URL` não estiver definida, usar persistência automática local em `backend/data/pantry.json`.
- **RF05 (Comandos no Chat)**: `POST /api/chat/command` suportando `/estoque`, `/consumido`, `/consumido <id>`, `/consumido <nome>`, `/resumo` e `/alerta`.
- **RF06 & RNF04 (Cron Diário 00:00 com Isolamento)**: Executar diariamente à meia-noite (`America/Sao_Paulo`) e sob demanda (`POST /api/cron/run`), filtrando itens `Em estoque` com `0 <= diasRestantes <= 5`. Processar cada usuário em `try/catch` isolado para que falhas individuais não interrompam a fila.
- **RF07 & RF08 (Curadoria e Disparo Ativo)**: Cruzar itens críticos (`<= 5d`) com demais itens ativos do mesmo usuário via Gemini para gerar 2 receitas estruturadas (ingredientes, passo a passo, dica nutricional e link de busca) e disparar mensagem formatada em Markdown no chat + gerar prévia de Resumo Semanal (`GET /api/cron/summary`).
- **RNF03 & RNF06 (Docker + API-First)**: Contêineres Docker reproduzíveis e API REST limpa pronta para futura evolução em Flutter/React Native e importação via QR Code NFC-e.

## 5. INTERFACE WEB (4 ABAS)
1. **Bot & Gemini OCR (Chat)**: Upload real de foto + amostras rápidas de teste + chat interativo com renderização Markdown segura, status de latência/modo IA e cartão de confirmação editável vinculado ao `messageId`.
2. **Despensa Supabase (Live View)**: Busca por texto, filtros (`Todos`, `Em estoque`, `Alerta <= 5d`, `Consumido`, `Vencido`), inserção manual, simulação `-5d / +5d`, baixa (`Consumir/Reativar`) e exclusão.
3. **Motor n8n & Receitas IA (00:00)**: Pipeline visual animado de 5 nós, disparo manual do Cron, receitas geradas, logs do contêiner e prévia do Resumo Semanal (Prioridade 2).
4. **Planejamento & Prompt Antigravity**: Master Prompt copiável, DDL SQL, `docker-compose.yml`, guia Google AI Pro/AI Studio, Matriz Impacto x Esforço, Matriz 5W2H e Cronograma de 6 meses.

## 6. VERIFICAÇÃO OBRIGATÓRIA
- Execute `npm run typecheck` em `backend/` e `frontend/` sem erros.
- Execute testes unitários do parser de datas (`DD/MM/AAAA`, `MM/AAAA`, ano bissexto, cálculo de dias restantes).
- Confirme que nenhuma credencial sensível aparece no código do frontend.
- Teste o fluxo completo: `GET /api/health` -> `POST /api/ocr/analyze` -> `POST /api/pantry` -> `POST /api/chat/command` -> `POST /api/cron/run`.
```
