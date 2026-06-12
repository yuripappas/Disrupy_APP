/**
 * PATCH /api/templates/[step]
 * Atualiza um template de cadência. Apenas gestores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_FIELDS = [
  'ativo', 'canal_whatsapp', 'canal_email',
  'mensagem_whatsapp', 'assunto_email', 'corpo_email',
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ step: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || role !== 'gestor') {
    return NextResponse.json({ error: 'Sem permissão — apenas gestores' }, { status: 403 });
  }

  const { step } = await params;
  const body = await req.json() as Record<string, unknown>;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from('cadencia_templates')
    .update(update)
    .eq('step', step)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, template: data });
}
