/**
 * /api/certidoes-globais
 *
 * GET   → lista as certidões globais da agência (com arquivo_url)
 * POST  → faz upload do arquivo para Supabase Storage e atualiza o registro
 * PATCH → atualiza arquivo_url + validade de uma certidão global (uso interno)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

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

// ── POST /api/certidoes-globais — upload arquivo + atualiza registro ──────────

export async function POST(req: NextRequest) {
  const { supabase, user } = await autenticar();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get('file')     as File   | null;
  const id       = formData.get('id')       as string | null;
  const validade = formData.get('validade') as string | null;

  if (!file || !id) {
    return NextResponse.json({ error: 'file e id são obrigatórios' }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const path = `${id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from('certidoes')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from('certidoes')
    .getPublicUrl(path);

  const update: Record<string, unknown> = {
    arquivo_url:   publicUrl,
    nome_arquivo:  file.name,
    tamanho_bytes: file.size,
    updated_at:    new Date().toISOString(),
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

// ── PATCH /api/certidoes-globais — atualiza sem upload ────────────────────────

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
