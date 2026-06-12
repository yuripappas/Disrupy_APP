/**
 * PATCH /api/fornecedores/[id]
 *
 * Atualiza os dados de contato de um fornecedor.
 * Utilizado tanto em Configurações → Fornecedores quanto no
 * card de faturamento (two-way sync: ambos escrevem na mesma tabela).
 *
 * Body (parcial):
 *   { contato_nome?: string | null, contato_whatsapp?: string | null, contato_email?: string | null }
 *
 * Auth: gestor ou faturamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  if (!user || !['gestor', 'faturamento'].includes(role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;

  const body = (await req.json()) as {
    contato_nome?: string | null;
    contato_whatsapp?: string | null;
    contato_email?: string | null;
  };

  // Apenas campos de contato são permitidos (segurança)
  const update: Record<string, string | null | undefined> = {};
  if ('contato_nome' in body)      update.contato_nome      = body.contato_nome      ?? null;
  if ('contato_whatsapp' in body)  update.contato_whatsapp  = body.contato_whatsapp  ?? null;
  if ('contato_email' in body)     update.contato_email     = body.contato_email     ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await admin
    .from('fornecedores')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, razao_social, contato_nome, contato_whatsapp, contato_email')
    .single();

  if (error) {
    console.error('[PATCH /api/fornecedores]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fornecedor: data });
}
