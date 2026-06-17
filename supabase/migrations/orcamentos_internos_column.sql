-- Adiciona coluna para habilitar preenchimento interno dos orçamentos 2 e 3.
-- Por padrão desabilitado: o fornecedor só preenche o orçamento 1 via portal.

ALTER TABLE faturamento_fornecedores
ADD COLUMN IF NOT EXISTS orcamentos_internos_habilitado BOOLEAN DEFAULT false;
