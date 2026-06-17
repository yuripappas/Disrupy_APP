/**
 * POST /api/faturamentos/[id]/etapa
 *
 * Avança o pipeline do faturamento:
 *   - Marca a etapa em_andamento como concluida
 *   - Marca a próxima etapa pendente como em_andamento
 *   - Atualiza faturamentos.etapa com o slug correspondente
 *
 * Body: { acao: "avancar" | "voltar" | "inconformidade", motivo?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mapa: número da etapa → slug em faturamentos.status (6 etapas)
const ETAPA_SLUG: Record<number, string> = {
  1: 'iniciando',
  2: 'docs_fornecedores',
  3: 'docs_agencia',
  4: 'revisao_processo',
  5: 'publicacao',
  6: 'concluido',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth: apenas gestor ou faturamento
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !['gestor', 'faturamento'].includes(role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json() as { acao: 'avancar' | 'voltar' | 'inconformidade'; motivo?: string };

  // Busca etapas ordenadas
  const { data: etapas, error } = await supabase
    .from('faturamento_etapas')
    .select('id, numero, status')
    .eq('faturamento_id', id)
    .order('numero');

  if (error || !etapas) {
    return NextResponse.json({ error: 'Faturamento não encontrado' }, { status: 404 });
  }

  const atual = etapas.find(e => e.status === 'em_andamento');

  // ── AVANÇAR ──────────────────────────────────────────────────────────────────
  if (body.acao === 'avancar') {
    if (!atual) return NextResponse.json({ error: 'Nenhuma etapa em andamento' }, { status: 400 });

    const proxima = etapas.find(e => e.numero === atual.numero + 1);

    // Conclui a etapa atual
    await supabase
      .from('faturamento_etapas')
      .update({ status: 'concluida' })
      .eq('id', atual.id);

    // Ativa a próxima (se existir)
    if (proxima) {
      await supabase
        .from('faturamento_etapas')
        .update({ status: 'em_andamento' })
        .eq('id', proxima.id);
    }

    // Atualiza slug e etapa_atual no faturamento
    const novoSlug = proxima ? (ETAPA_SLUG[proxima.numero] ?? 'concluido') : 'concluido';
    const novaEtapaNum = proxima?.numero ?? atual.numero;
    await supabase
      .from('faturamentos')
      .update({ etapa: novoSlug, etapa_atual: novaEtapaNum, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ ok: true, novaEtapa: novaEtapaNum, slug: novoSlug });
  }

  // ── VOLTAR ────────────────────────────────────────────────────────────────────
  if (body.acao === 'voltar') {
    if (!atual) return NextResponse.json({ error: 'Nenhuma etapa em andamento' }, { status: 400 });
    if (atual.numero <= 1) return NextResponse.json({ error: 'Já está na primeira etapa' }, { status: 400 });

    const anterior = etapas.find(e => e.numero === atual.numero - 1);
    if (!anterior) return NextResponse.json({ error: 'Etapa anterior não encontrada' }, { status: 400 });

    // Volta atual para pendente
    await supabase
      .from('faturamento_etapas')
      .update({ status: 'pendente' })
      .eq('id', atual.id);

    // Reativa a anterior (remove concluída), incrementa retornos
    const { data: antData } = await supabase
      .from('faturamento_etapas')
      .select('retornos')
      .eq('id', anterior.id)
      .single();

    await supabase
      .from('faturamento_etapas')
      .update({ status: 'em_andamento', retornos: (antData?.retornos ?? 0) + 1 })
      .eq('id', anterior.id);

    // Atualiza slug e etapa_atual no faturamento
    const slug = ETAPA_SLUG[anterior.numero] ?? 'rascunho';
    await supabase
      .from('faturamentos')
      .update({ etapa: slug, etapa_atual: anterior.numero, updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ ok: true, novaEtapa: anterior.numero, slug });
  }

  // ── INCONFORMIDADE ────────────────────────────────────────────────────────────
  if (body.acao === 'inconformidade') {
    if (!atual) return NextResponse.json({ error: 'Nenhuma etapa em andamento' }, { status: 400 });
    if (!body.motivo?.trim()) return NextResponse.json({ error: 'Motivo obrigatório' }, { status: 400 });

    await supabase
      .from('faturamento_etapas')
      .update({ status: 'inconformidade', inconformidade_motivo: body.motivo })
      .eq('id', atual.id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
