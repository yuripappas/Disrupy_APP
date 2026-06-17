-- ============================================================
-- Migração: 7/8 etapas → 6 etapas
-- Rodar no SQL Editor do Supabase
-- ============================================================
--
-- Mapeamento:
--   Faturamentos com 7 etapas (NovoFaturamentoModal):
--     1 Iniciar Faturamento → 1 Enviar Faturamento
--     2 Revisão de Documentação → 2 Documentação Fornecedores
--     3 Documentação Agência → 3 Documentação Agência (renomeia se necessário)
--     4 Revisão do Processo → 4 Revisão do Processo
--     5 Publicação → 5 Publicação
--     6 Aguardando Validação → (REMOVIDA, fundida em 6 Concluído)
--     7 Conclusão → 6 Concluído
--
--   Faturamentos com 8 etapas (ImportarIClipsModal):
--     1 Iniciar Faturamento → 1 Enviar Faturamento
--     2 Documentação Fornecedores → 2 Documentação Fornecedores
--     3 Revisão de Documentação → 3 Documentação Agência
--     4 Documentação Agência → (REMOVIDA, fundida em 3)
--     5 Revisão do Processo → 4 Revisão do Processo
--     6 Publicação → 5 Publicação
--     7 Aguardando Validação → (REMOVIDA, fundida em 6 Concluído)
--     8 Conclusão → 6 Concluído

DO $$
DECLARE
  fat_id  UUID;
  tot     INT;
  cur_num INT;
  new_num INT;
  fat_status TEXT;
BEGIN
  FOR fat_id IN SELECT id FROM faturamentos LOOP

    -- Total de etapas atuais
    SELECT COUNT(*) INTO tot
    FROM faturamento_etapas
    WHERE faturamento_id = fat_id;

    -- Status do faturamento (para detectar se já está concluído)
    SELECT status INTO fat_status
    FROM faturamentos
    WHERE id = fat_id;

    -- Etapa em andamento
    SELECT numero INTO cur_num
    FROM faturamento_etapas
    WHERE faturamento_id = fat_id AND status = 'em_andamento'
    LIMIT 1;

    -- Se não há em_andamento, usa a maior concluída (processo encerrado)
    IF cur_num IS NULL THEN
      SELECT MAX(numero) INTO cur_num
      FROM faturamento_etapas
      WHERE faturamento_id = fat_id AND status = 'concluida';
      IF cur_num IS NULL THEN
        cur_num := 1;
      END IF;
    END IF;

    -- Mapeia posição antiga para nova (1-6)
    IF tot >= 8 THEN
      -- 8-etapa
      CASE cur_num
        WHEN 1 THEN new_num := 1;
        WHEN 2 THEN new_num := 2;
        WHEN 3 THEN new_num := 3;
        WHEN 4 THEN new_num := 3;
        WHEN 5 THEN new_num := 4;
        WHEN 6 THEN new_num := 5;
        WHEN 7 THEN new_num := 6;
        WHEN 8 THEN new_num := 6;
        ELSE      new_num := LEAST(cur_num, 6);
      END CASE;
    ELSE
      -- 7-etapa (ou outro)
      CASE cur_num
        WHEN 1 THEN new_num := 1;
        WHEN 2 THEN new_num := 2;
        WHEN 3 THEN new_num := 3;
        WHEN 4 THEN new_num := 4;
        WHEN 5 THEN new_num := 5;
        WHEN 6 THEN new_num := 6;
        WHEN 7 THEN new_num := 6;
        ELSE      new_num := LEAST(cur_num, 6);
      END CASE;
    END IF;

    -- Remove todas as etapas antigas
    DELETE FROM faturamento_etapas WHERE faturamento_id = fat_id;

    -- Insere as 6 novas etapas
    INSERT INTO faturamento_etapas (faturamento_id, numero, nome, status)
    VALUES
      (fat_id, 1, 'Enviar Faturamento',
        CASE WHEN new_num > 1 THEN 'concluida' WHEN new_num = 1 THEN 'em_andamento' ELSE 'pendente' END),
      (fat_id, 2, 'Documentação Fornecedores',
        CASE WHEN new_num > 2 THEN 'concluida' WHEN new_num = 2 THEN 'em_andamento' ELSE 'pendente' END),
      (fat_id, 3, 'Documentação Agência',
        CASE WHEN new_num > 3 THEN 'concluida' WHEN new_num = 3 THEN 'em_andamento' ELSE 'pendente' END),
      (fat_id, 4, 'Revisão do Processo',
        CASE WHEN new_num > 4 THEN 'concluida' WHEN new_num = 4 THEN 'em_andamento' ELSE 'pendente' END),
      (fat_id, 5, 'Publicação',
        CASE WHEN new_num > 5 THEN 'concluida' WHEN new_num = 5 THEN 'em_andamento' ELSE 'pendente' END),
      (fat_id, 6, 'Concluído',
        CASE
          WHEN fat_status = 'concluido' THEN 'concluida'
          WHEN new_num >= 6             THEN 'em_andamento'
          ELSE 'pendente'
        END);

    -- Atualiza etapa_atual no faturamento
    UPDATE faturamentos
    SET etapa_atual = new_num, updated_at = NOW()
    WHERE id = fat_id;

  END LOOP;
END $$;
