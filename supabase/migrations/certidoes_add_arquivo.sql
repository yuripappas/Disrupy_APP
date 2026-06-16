-- Adiciona colunas de arquivo à tabela global de certidões da agência.
-- arquivo_url já existia; nome_arquivo e tamanho_bytes são novos.
ALTER TABLE certidoes
  ADD COLUMN IF NOT EXISTS nome_arquivo TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_bytes INTEGER;
