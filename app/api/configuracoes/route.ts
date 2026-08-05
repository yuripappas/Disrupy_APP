/**
 * /api/configuracoes
 *
 * GET  → retorna todas as configurações como { chave: valor }
 * PATCH → atualiza uma configuração (gestor apenas)
 *
 * Tabela: configuracoes (chave TEXT PK, valor TEXT, updated_at TIMESTAMPTZ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const { data, error } = await admin()
    .from('configuracoes')
    .select('chave, valor');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config: Record<string, string> = {};
  for (const row of data ?? []) {
    config[row.chave] = row.valor ?? '';
  }

  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'gestor') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json() as { chave: string; valor: string };
  const { chave, valor } = body;
  if (!chave) return NextResponse.json({ error: 'chave obrigatória' }, { status: 400 });

  const { error } = await admin()
    .from('configuracoes')
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
