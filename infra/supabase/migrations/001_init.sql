-- ============================================================================
-- MIGRATION 001 — SMART PANTRY ASSISTANT MVP (SUPABASE POSTGRESQL)
-- Requisitos atendidos: RF04, RF06, RF07, RF08, RNF05 (Segurança) e RNF06 (API-First)
-- Execute este script no SQL Editor do painel do Supabase.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabela de Usuários (Isolamento lógico por Chat ID / Canal)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    chat_id TEXT UNIQUE NOT NULL, -- Telegram chat_id ou número WhatsApp (ex: 5547999999999)
    canal TEXT NOT NULL DEFAULT 'telegram' CHECK (canal IN ('telegram', 'whatsapp', 'web')),
    email TEXT,
    janela_seguranca_dias INT NOT NULL DEFAULT 5 CHECK (janela_seguranca_dias BETWEEN 1 AND 60),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela Principal de Inventário da Despensa (RF04)
CREATE TABLE IF NOT EXISTS public.despensa (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    produto TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'Mercearia'
        CHECK (categoria IN ('Suplemento', 'Grãos & Cereais', 'Laticínios', 'Hortifruti', 'Mercearia', 'Geral')),
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    data_validade DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Em estoque'
        CHECK (status IN ('Em estoque', 'Consumido', 'Vencido')),
    confianca_ocr TEXT DEFAULT 'Manual',
    lote_ou_obs TEXT,
    imagem_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Auditoria e Logs de Notificações / Cron Job (RF06, RF08, RNF04)
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

-- 4. Índices de Performance para o Cron Job Diário (RF06 & RNF01)
CREATE INDEX IF NOT EXISTS idx_despensa_validade_status
    ON public.despensa (status, data_validade);

CREATE INDEX IF NOT EXISTS idx_despensa_user_id
    ON public.despensa (user_id);

CREATE INDEX IF NOT EXISTS idx_logs_notificacoes_user_created
    ON public.logs_notificacoes (user_id, created_at DESC);

-- 5. Trigger automática para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_despensa_updated_at ON public.despensa;
CREATE TRIGGER trg_despensa_updated_at
    BEFORE UPDATE ON public.despensa
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Função utilitária para marcar itens vencidos automaticamente antes do disparo
CREATE OR REPLACE FUNCTION public.marcar_itens_vencidos()
RETURNS INT AS $$
DECLARE
    afetados INT;
BEGIN
    UPDATE public.despensa
    SET status = 'Vencido'
    WHERE status = 'Em estoque'
      AND data_validade < CURRENT_DATE;
    GET DIAGNOSTICS afetados = ROW_COUNT;
    RETURN afetados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. View Inteligente para Consulta do n8n / Backend (Janela configurável por usuário, padrão 5 dias)
CREATE OR REPLACE VIEW public.vw_itens_alerta_vencimento AS
SELECT
    d.id,
    d.user_id,
    u.nome AS nome_usuario,
    u.chat_id,
    u.canal,
    u.janela_seguranca_dias,
    d.produto,
    d.categoria,
    d.data_cadastro,
    d.data_validade,
    d.confianca_ocr,
    (d.data_validade - CURRENT_DATE) AS dias_restantes
FROM public.despensa d
JOIN public.usuarios u ON u.id = d.user_id
WHERE u.ativo = true
  AND d.status = 'Em estoque'
  AND d.data_validade >= CURRENT_DATE
  AND (d.data_validade - CURRENT_DATE) <= u.janela_seguranca_dias
ORDER BY d.data_validade ASC;

-- 8. Row Level Security (RNF05 — Isolamento Lógico e Segurança)
-- Obs: O backend usa SUPABASE_SERVICE_ROLE_KEY (que ignora RLS com segurança no servidor).
-- As políticas abaixo protegem acessos diretos via cliente autenticado (Supabase Auth - Evolução v2.0).
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_own_profile" ON public.usuarios;
CREATE POLICY "usuarios_own_profile" ON public.usuarios
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "despensa_own_items" ON public.despensa;
CREATE POLICY "despensa_own_items" ON public.despensa
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_own_records" ON public.logs_notificacoes;
CREATE POLICY "logs_own_records" ON public.logs_notificacoes
    FOR SELECT
    USING (auth.uid() = user_id);

-- 9. Seed inicial opcional do usuário padrão de validação do MVP
INSERT INTO public.usuarios (nome, chat_id, canal, janela_seguranca_dias)
VALUES ('Usuário MVP', 'usr_telegram_99412', 'telegram', 5)
ON CONFLICT (chat_id) DO NOTHING;
