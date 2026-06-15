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
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';
import { sendEmail } from '@/lib/email';
import { interpolar, buildVars } from '@/lib/cadencia';

const INSTANCE_NAME = 'disrupy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    documentoId:  string;
    viewUrl:      string;
    fileName:     string;
    fileSize?:    number;
    token?:       string;
    numeroNf?:    string | null;
    nfStatus?:    'extraido' | 'falhou' | 'pendente';
    valorLiquido?: string | null;
  };

  const { documentoId, viewUrl, fileName, fileSize, token, numeroNf, nfStatus, valorLiquido } = body;

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

    const admin = createServiceClient(serviceUrl, serviceRole,
      { auth: { autoRefreshToken: false, persistSession: false } });

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

    // 4. Atualiza status do documento para "enviado" + NF se extraída
    const docUpdate: Record<string, unknown> = { status: 'enviado', arquivo_url: viewUrl };
    if (nfStatus) {
      docUpdate.numero_nf_status = nfStatus;
      if (numeroNf)     docUpdate.numero_nf    = numeroNf;
      if (valorLiquido) docUpdate.valor_nf      = valorLiquido;
    }
    await admin.from('documentos').update(docUpdate).eq('id', documentoId);

    // 5. Verifica se todos os docs estão preenchidos → dispara confirmação
    void verificarConfirmacao(ff.id).catch((e) =>
      console.error('[salvar-arquivo] Erro ao verificar confirmação:', e),
    );

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

  // Precisa do ff_id para verificar confirmação
  const { data: docInfo } = await supabase
    .from('documentos')
    .select('faturamento_fornecedor_id')
    .eq('id', documentoId)
    .single();

  const docUpdateAuth: Record<string, unknown> = { status: 'enviado', arquivo_url: viewUrl };
  if (nfStatus) {
    docUpdateAuth.numero_nf_status = nfStatus;
    if (numeroNf)     docUpdateAuth.numero_nf = numeroNf;
    if (valorLiquido) docUpdateAuth.valor_nf   = valorLiquido;
  }
  await supabase.from('documentos').update(docUpdateAuth).eq('id', documentoId);

  if (docInfo?.faturamento_fornecedor_id) {
    void verificarConfirmacao(docInfo.faturamento_fornecedor_id).catch((e) =>
      console.error('[salvar-arquivo] Erro ao verificar confirmação (auth):', e),
    );
  }

  return NextResponse.json({ ok: true, arquivo: arq });
}

// ── Confirmação de recebimento ─────────────────────────────────────────────────
//
// Disparada automaticamente quando TODOS os documentos do fornecedor
// estão preenchidos (status = 'enviado' ou 'aprovado', nenhum 'pendente').
// Dedup por 1 hora para evitar duplicatas em uploads simultâneos.

async function verificarConfirmacao(ffId: string) {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Busca todos os documentos do ff
  const { data: docs } = await admin
    .from('documentos')
    .select('id, status')
    .eq('faturamento_fornecedor_id', ffId);

  if (!docs || docs.length === 0) return;

  // Todos devem estar preenchidos (enviado ou aprovado) — nenhum pendente ou reprovado
  const allFilled = docs.every(
    (d) => d.status === 'enviado' || d.status === 'aprovado',
  );
  if (!allFilled) return;

  // 2. Dedup: não reenvia se já enviou confirmação nos últimos 60 min
  const umHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recente } = await admin
    .from('disparos')
    .select('id')
    .eq('faturamento_fornecedor_id', ffId)
    .eq('subtipo', 'confirmacao')
    .eq('status', 'enviado')
    .gte('created_at', umHoraAtras)
    .limit(1)
    .maybeSingle();

  if (recente) return; // Já enviou recentemente

  // 3. Busca o template de confirmação
  const { data: tmpl } = await admin
    .from('cadencia_templates')
    .select('ativo, canal_whatsapp, canal_email, mensagem_whatsapp, assunto_email, corpo_email')
    .eq('step', 'confirmacao')
    .single();

  if (!tmpl?.ativo) return;

  // 4. Busca dados do ff + fornecedor + campanha
  const { data: ff } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_nome, contato_whatsapp, contato_email )
    `)
    .eq('id', ffId)
    .single();

  if (!ff) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forn = (ff.fornecedor as any) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fat  = (ff.faturamento as any) ?? {};
  const portalUrl = `${APP_URL}/portal/${ff.link_token}`;

  const vars = buildVars({
    contatoNome:  forn.contato_nome,
    razaoSocial:  forn.razao_social ?? '',
    nomeCampanha: fat.nome_campanha ?? '',
    portalUrl,
  });

  const agora = new Date().toISOString();

  // 5. Envia Email
  if (tmpl.canal_email && forn.contato_email && tmpl.corpo_email && tmpl.assunto_email) {
    const html    = interpolar(tmpl.corpo_email,   vars);
    const subject = interpolar(tmpl.assunto_email, vars);
    try {
      const res = await sendEmail({ to: forn.contato_email, subject, html });
      await admin.from('disparos').insert({
        faturamento_fornecedor_id: ffId,
        tipo: 'email', subtipo: 'confirmacao',
        email_destino: forn.contato_email,
        assunto: subject, mensagem: html,
        status: res.ok ? 'enviado' : 'falhou',
        enviado_em: res.ok ? agora : null,
        erro: res.ok ? null : res.error,
      });
    } catch (e) { console.error('[confirmação email]', e); }
  }

  // 6. Envia WhatsApp (se gestor ativar o canal no template)
  if (tmpl.canal_whatsapp && forn.contato_whatsapp && tmpl.mensagem_whatsapp) {
    const msg = interpolar(tmpl.mensagem_whatsapp, vars);
    try {
      const estado = await estadoConexao(INSTANCE_NAME);
      if (estado === 'open') {
        await enviarMensagem(INSTANCE_NAME, forn.contato_whatsapp, msg);
        await admin.from('disparos').insert({
          faturamento_fornecedor_id: ffId,
          tipo: 'whatsapp', subtipo: 'confirmacao',
          numero_destino: forn.contato_whatsapp,
          mensagem: msg, status: 'enviado', enviado_em: agora,
        });
      }
    } catch (e) { console.error('[confirmação WA]', e); }
  }

  console.log(`[confirmação] Enviada para ff=${ffId} (${forn.razao_social})`);
}
