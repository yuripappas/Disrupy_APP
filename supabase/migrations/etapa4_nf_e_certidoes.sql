-- ============================================================
-- Etapa 4 — NF extraction + certidões por faturamento
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1. Colunas de NF no documentos
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS numero_nf TEXT,
  ADD COLUMN IF NOT EXISTS numero_nf_status TEXT DEFAULT 'pendente'
    CHECK (numero_nf_status IN ('pendente', 'extraido', 'falhou', 'manual'));

-- 2. Tabela de arquivos associados a documentos (se ainda não existir)
CREATE TABLE IF NOT EXISTS documento_arquivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tamanho_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documento_arquivos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON documento_arquivos FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "portal_select" ON documento_arquivos FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "portal_insert" ON documento_arquivos FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Certidões por faturamento
-- Nota: a constraint CHECK em `tipo` foi removida pois a tabela passou a armazenar
-- também empenhos, proposta, evidências e ofício (qualquer string é válida).
CREATE TABLE IF NOT EXISTS faturamento_certidoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faturamento_id UUID NOT NULL REFERENCES faturamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  label TEXT NOT NULL,
  arquivo_url TEXT,
  nome_arquivo TEXT,
  tamanho_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Remover constraint antiga se existir (rode manualmente se a tabela já existia)
ALTER TABLE faturamento_certidoes
  DROP CONSTRAINT IF EXISTS faturamento_certidoes_tipo_check;

ALTER TABLE faturamento_certidoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all" ON faturamento_certidoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
