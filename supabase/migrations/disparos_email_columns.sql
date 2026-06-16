-- Adiciona suporte a email na tabela disparos.
-- Colunas já existentes (whatsapp): numero_destino, mensagem
-- Novas colunas para email e rastreamento de erro:
ALTER TABLE disparos
  ADD COLUMN IF NOT EXISTS email_destino TEXT,
  ADD COLUMN IF NOT EXISTS assunto       TEXT,
  ADD COLUMN IF NOT EXISTS erro          TEXT;
