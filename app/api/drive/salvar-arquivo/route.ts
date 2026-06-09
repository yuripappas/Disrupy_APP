/**
 * POST /api/drive/salvar-arquivo
 *
 * Chamado APÓS o browser fazer o upload direto ao Apps Script.
 * Recebe a URL do Drive e salva no banco de dados.
 *
 * Aceita dois modos de autenticação:
 *   1. Usuário autenticado (gestor/admin) — cookie de sessão Supabase
 *   2. Portal (fornecedor anônimo)        — campo `token` no body (link_token da FF)
 *
 * Body: {
 *   documentoId: string
 *   viewUrl:     string   — link público do Google Drive
 *   fileName:    string
 *   fileSize?:   number   — bytes
 *   token?:      string   — link_token do portal (para acesso anônimo)
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    documentoId: string;
    viewUrl:     string;
    fileName:    string;
    fileSize?:   number;
    token?:      string;   // portal link_token
  };

  const { documentoId, viewUrl, fileName, fileSize, token } = body;

  if (!documentoId || !viewUrl || !fileName) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
  }

  // ── Determina o cliente Supabase a usar ────────────────────────────────────
  // Para o portal (token presente): usa service role para bypassar RLS,
  // mas valida que o documento pertence ao ff daquele token.
  // Para usuário autenticado: usa o cliente normal com cookies de sessão.

  if (token) {
    // Modo portal: valida o token e usa service role
    const serviceUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceRole) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const admin = createServiceClient(serviceUrl, serviceRole);

    // 1. Valida que o link_token existe e obtém o ff_id
    const { data: ff, error: ffErr } = await admin
      .from('faturamento_fornecedores')
      .select('id')
      .eq('link_token', token)
      .single();

    if (ffErr || !ff) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Valida que o documento pertence a esse ff
    const { data: doc, error: docErr } = await admin
      .from('documentos')
      .select('id')
      .eq('id', documentoId)
      .eq('faturamento_fornecedor_id', ff.id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Documento não encontrado para este portal' }, { status: 403 });
    }

    // 3. Salva em documento_arquivos com service role
    const { data: arq, error: arqErr } = await admin
      .from('documento_arquivos')
      .insert({
        documento_id:  documentoId,
        arquivo_url:   viewUrl,
        nome_arquivo:  fileName,
        tamanho_bytes: fileSize ?? null,
      })
      .select()
      .single();

    if (arqErr || !arq) {
      return NextResponse.json({ error: arqErr?.message ?? 'Erro ao salvar arquivo' }, { status: 500 });
    }

    // 4. Atualiza status do documento para "enviado"
    await admin
      .from('documentos')
      .update({ status: 'enviado', arquivo_url: viewUrl })
      .eq('id', documentoId);

    return NextResponse.json({ ok: true, arquivo: arq });
  }

  // ── Modo autenticado (gestor/admin) ───────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: arq, error: arqErr } = await supabase
    .from('documento_arquivos')
    .insert({
      documento_id:  documentoId,
      arquivo_url:   viewUrl,
      nome_arquivo:  fileName,
      tamanho_bytes: fileSize ?? null,
    })
    .select()
    .single();

  if (arqErr || !arq) {
    return NextResponse.json({ error: arqErr?.message ?? 'Erro ao salvar arquivo' }, { status: 500 });
  }

  await supabase
    .from('documentos')
    .update({ status: 'enviado', arquivo_url: viewUrl })
    .eq('id', documentoId);

  return NextResponse.json({ ok: true, arquivo: arq });
}
