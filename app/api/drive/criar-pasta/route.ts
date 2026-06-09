/**
 * POST /api/drive/criar-pasta
 *
 * Cria a estrutura de pastas no Google Drive para um faturamento,
 * chamando o Apps Script com um arquivo vazio de marcação.
 *
 * A criação de pastas agora é automática no upload — este endpoint
 * é um "warm-up" opcional para garantir que a pasta exista antes de
 * o fornecedor acessar o portal.
 *
 * Body: { faturamentoId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { faturamentoId } = await req.json() as { faturamentoId: string };
  if (!faturamentoId) {
    return NextResponse.json({ error: 'faturamentoId obrigatório' }, { status: 400 });
  }

  const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APPS_SCRIPT_URL não configurada' }, { status: 500 });
  }

  // Busca dados do faturamento
  const { data: fat, error: fatErr } = await supabase
    .from('faturamentos')
    .select('id, nome_campanha, iclips_job_id, cliente_nome, created_at')
    .eq('id', faturamentoId)
    .single();

  if (fatErr || !fat) {
    return NextResponse.json({ error: 'Faturamento não encontrado' }, { status: 404 });
  }

  const ano = new Date(fat.created_at).getFullYear();

  // Cria estrutura de pastas via Apps Script com arquivo de marcação
  // (As pastas OS, PI, CUSTO INTERNO, PROPOSTA são criadas no primeiro upload)
  const payloads = ['OS', 'PI', 'CUSTO INTERNO', 'PROPOSTA'];

  try {
    // Cria apenas as pastas enviando um arquivo .txt mínimo em cada subpasta
    // Isso garante que a estrutura existe antes do fornecedor acessar
    await Promise.all(payloads.map((subpasta) =>
      fetch(scriptUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({
          fileName:    '.keep',
          fileContent: btoa(' '), // arquivo de marcação mínimo
          mimeType:    'text/plain',
          ano,
          clienteNome: fat.cliente_nome ?? 'SEM_CLIENTE',
          jobId:       fat.iclips_job_id ?? `FAT-${faturamentoId.slice(0, 6)}`,
          campanha:    fat.nome_campanha ?? 'SEM_NOME',
          subpasta,
        }),
      })
    ));
  } catch (e) {
    console.error('[drive/criar-pasta]', e);
    // Não bloqueia — a pasta será criada automaticamente no primeiro upload
  }

  return NextResponse.json({ ok: true });
}
