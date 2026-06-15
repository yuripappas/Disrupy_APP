-- ============================================================
-- Adiciona coluna valor_nf à tabela documentos
-- Armazena o Valor Líquido extraído automaticamente da NFS-e
-- Formato BR: "67.926,00"
-- Rodar no SQL Editor do Supabase
-- ============================================================

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS valor_nf TEXT;
