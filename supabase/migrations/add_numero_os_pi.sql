-- Adiciona campo para número da OS (produção) ou PI (mídia) por fornecedor no faturamento
ALTER TABLE faturamento_fornecedores
  ADD COLUMN IF NOT EXISTS numero_os_pi TEXT;
