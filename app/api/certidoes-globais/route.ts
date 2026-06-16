/**
 * /api/certidoes-globais
 *
 * GET   → lista as certidões globais da agência (com arquivo_url)
 * PATCH → atualiza arquivo_url + validade de uma certidão global
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

export async function GET() {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('certidoes')
    .select('id, tipo, label, validade, arquivo_url, nome_arquivo, tamanho_bytes')
    .order('tipo');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ certidoes: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json() as {
    id: string;
    arquivo_url: string;
    nome_arquivo?: string;
    tamanho_bytes?: number;
    validade?: string;
  };

  const { id, arquivo_url, nome_arquivo, tamanho_bytes, validade } = body;
  if (!id || !arquivo_url) {
    return NextResponse.json({ error: 'id e arquivo_url obrigatórios' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    arquivo_url,
    nome_arquivo: nome_arquivo ?? null,
    tamanho_bytes: tamanho_bytes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (validade) update.validade = validade;

  const { data, error } = await supabase
    .from('certidoes')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ certidao: data });
}
