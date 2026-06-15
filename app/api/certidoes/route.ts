/**
 * /api/certidoes
 *
 * GET    ?faturamentoId=xxx  → lista certidões do faturamento
 * POST                       → salva arquivo de certidão (viewUrl do Drive)
 * DELETE ?id=xxx             → remove certidão
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function autenticar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const role = user.app_metadata?.role as string;
  if (role !== 'gestor' && role !== 'faturamento') return { supabase, user: null };
  return { supabase, user };
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const faturamentoId = req.nextUrl.searchParams.get('faturamentoId');
  if (!faturamentoId) return NextResponse.json({ error: 'faturamentoId obrigatório' }, { status: 400 });

  const { data, error } = await supabase
    .from('faturamento_certidoes')
    .select('*')
    .eq('faturamento_id', faturamentoId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ certidoes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json() as {
    faturamentoId: string;
    tipo: string;
    label: string;
    viewUrl: string;
    fileName: string;
    fileSize?: number;
  };

  const { faturamentoId, tipo, label, viewUrl, fileName, fileSize } = body;
  if (!faturamentoId || !tipo || !label || !viewUrl || !fileName) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
  }

  // Remove qualquer certidão prévia do mesmo tipo para este faturamento
  await supabase
    .from('faturamento_certidoes')
    .delete()
    .eq('faturamento_id', faturamentoId)
    .eq('tipo', tipo);

  const { data, error } = await supabase
    .from('faturamento_certidoes')
    .insert({
      faturamento_id: faturamentoId,
      tipo,
      label,
      arquivo_url: viewUrl,
      nome_arquivo: fileName,
      tamanho_bytes: fileSize ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ certidao: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase
    .from('faturamento_certidoes')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
