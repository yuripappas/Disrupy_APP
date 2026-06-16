/**
 * POST /api/disparos
 *
 * Envia o link do portal via WhatsApp para o fornecedor
 * e registra o disparo na tabela `disparos`.
 *
 * Body: { ffId: string; agendadoPara?: string }
 *   ffId = faturamento_fornecedor.id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';
import { sendEmail } from '@/lib/email';
import { interpolar, buildVars } from '@/lib/cadencia';

const INSTANCE_NAME = 'disrupy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';

// Mensagem padrão (usado se template não estiver configurado)
function buildMensagem(contatoNome: string | null | undefined, campanha: string, portalUrl: string): string {
  const saudacao = contatoNome ? `Olá, *${contatoNome}*!` : `Olá!`;
  return [
    `${saudacao} 👋`,
    ``,
    `Sou da equipe *Disrupy* e estou entrando em contato sobre a campanha:`,
    `📋 *${campanha}*`,
    ``,
    `Para agilizar o processo de faturamento, pedimos que acesse o portal abaixo e envie os documentos solicitados:`,
    ``,
    `🔗 ${portalUrl}`,
    ``,
    `Em caso de dúvidas, estamos à disposição. Obrigado! 🙏`,
  ].join('\n');
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth: gestor ou faturamento
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !['gestor', 'faturamento'].includes(role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { ffId, agendadoPara } = await req.json() as { ffId: string; agendadoPara?: string };
  if (!ffId) return NextResponse.json({ error: 'ffId obrigatório' }, { status: 400 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Busca o ff com dados do fornecedor e faturamento
  const { data: ff, error: ffErr } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token, envio_inicial_em, faturamento_id,
      faturamento:faturamentos ( id, nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_whatsapp, contato_nome, contato_email )
    `)
    .eq('id', ffId)
    .single();

  if (ffErr || !ff) {
    return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
  }

  const whatsapp    = (ff.fornecedor as { contato_whatsapp?: string | null })?.contato_whatsapp;
  const emailDest   = (ff.fornecedor as { contato_email?: string | null })?.contato_email ?? null;
  if (!whatsapp && !emailDest) {
    return NextResponse.json({ error: 'Fornecedor sem WhatsApp ou email cadastrado' }, { status: 400 });
  }

  if (!ff.link_token) {
    return NextResponse.json({ error: 'Portal não configurado para este fornecedor' }, { status: 400 });
  }

  // Tenta usar template do banco
  const portalUrl   = `${APP_URL}/portal/${ff.link_token}`;
  const campanha    = (ff.faturamento as { nome_campanha?: string })?.nome_campanha ?? '';
  const contatoNome = (ff.fornecedor as { contato_nome?: string | null })?.contato_nome;
  const razaoSocial = (ff.fornecedor as { razao_social?: string })?.razao_social ?? '';

  const vars = buildVars({ contatoNome, razaoSocial, nomeCampanha: campanha, portalUrl });

  // Busca template link_inicial (WhatsApp + Email)
  type LinkInicialTmpl = {
    ativo: boolean;
    canal_whatsapp: boolean; mensagem_whatsapp: string | null;
    canal_email: boolean;    assunto_email: string | null; corpo_email: string | null;
  };
  let tmplData: LinkInicialTmpl | null = null;
  try {
    const { data } = await admin
      .from('cadencia_templates')
      .select('ativo, canal_whatsapp, mensagem_whatsapp, canal_email, assunto_email, corpo_email')
      .eq('step', 'link_inicial')
      .single();
    tmplData = data as LinkInicialTmpl | null;
  } catch { /* sem template — usa fallback */ }

  const mensagemWa: string =
    (tmplData?.ativo && tmplData?.canal_whatsapp && tmplData?.mensagem_whatsapp)
      ? interpolar(tmplData.mensagem_whatsapp, vars)
      : buildMensagem(contatoNome, campanha, portalUrl);

  const enviarEmail =
    !!emailDest && tmplData?.ativo && tmplData?.canal_email &&
    !!tmplData?.corpo_email && !!tmplData?.assunto_email;
  const emailHtml    = enviarEmail ? interpolar(tmplData!.corpo_email!, vars)    : '';
  const emailAssunto = enviarEmail ? interpolar(tmplData!.assunto_email!, vars)  : '';

  // ── Agendamento ────────────────────────────────────────────────────────────
  if (agendadoPara) {
    const inserts = [];
    if (whatsapp) {
      inserts.push(admin.from('disparos').insert({
        faturamento_fornecedor_id: ffId,
        tipo: 'whatsapp', subtipo: 'link_inicial',
        numero_destino: whatsapp, mensagem: mensagemWa,
        status: 'agendado', agendado_para: agendadoPara, enviado_por: user.id,
      }));
    }
    if (enviarEmail) {
      inserts.push(admin.from('disparos').insert({
        faturamento_fornecedor_id: ffId,
        tipo: 'email', subtipo: 'link_inicial',
        email_destino: emailDest, assunto: emailAssunto, mensagem: emailHtml,
        status: 'agendado', agendado_para: agendadoPara, enviado_por: user.id,
      }));
    }
    await Promise.all(inserts);
    return NextResponse.json({ ok: true, agendado: true, agendadoPara });
  }

  // ── Envio imediato ─────────────────────────────────────────────────────────
  const agora = new Date().toISOString();
  let waOk = false;
  let mailOk = false;

  // WhatsApp
  if (whatsapp) {
    const estado = await estadoConexao(INSTANCE_NAME);
    if (estado !== 'open') {
      // Se não há email configurado como fallback, retorna erro
      if (!enviarEmail) {
        return NextResponse.json({ error: 'WhatsApp não conectado. Configure em Configurações.' }, { status: 503 });
      }
    } else {
      try {
        await enviarMensagem(INSTANCE_NAME, whatsapp, mensagemWa);
        await admin.from('disparos').insert({
          faturamento_fornecedor_id: ffId,
          tipo: 'whatsapp', subtipo: 'link_inicial',
          numero_destino: whatsapp, mensagem: mensagemWa,
          status: 'enviado', enviado_em: agora, enviado_por: user.id,
        });
        waOk = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao enviar';
        await admin.from('disparos').insert({
          faturamento_fornecedor_id: ffId,
          tipo: 'whatsapp', subtipo: 'link_inicial',
          numero_destino: whatsapp, mensagem: mensagemWa,
          status: 'falhou', erro: msg, enviado_por: user.id,
        });
      }
    }
  }

  // Email
  if (enviarEmail) {
    try {
      const res = await sendEmail({ to: emailDest!, subject: emailAssunto, html: emailHtml });
      if (!res.ok) throw new Error(res.error ?? 'Falha no email');
      await admin.from('disparos').insert({
        faturamento_fornecedor_id: ffId,
        tipo: 'email', subtipo: 'link_inicial',
        email_destino: emailDest, assunto: emailAssunto, mensagem: emailHtml,
        status: 'enviado', enviado_em: agora, enviado_por: user.id,
      });
      mailOk = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro email';
      await admin.from('disparos').insert({
        faturamento_fornecedor_id: ffId,
        tipo: 'email', subtipo: 'link_inicial',
        email_destino: emailDest, assunto: emailAssunto, mensagem: emailHtml,
        status: 'falhou', erro: msg, enviado_por: user.id,
      });
    }
  }

  if (!waOk && !mailOk) {
    return NextResponse.json({ error: 'Falha ao enviar por todos os canais configurados' }, { status: 500 });
  }

  // Marca envio_inicial_em na primeira vez que o link é enviado
  if (!ff.envio_inicial_em) {
    await admin
      .from('faturamento_fornecedores')
      .update({ envio_inicial_em: agora })
      .eq('id', ffId);

    // Auto-avança etapa 1 → 2 no primeiro envio do faturamento
    const faturamentoId = (ff as unknown as { faturamento_id: string }).faturamento_id;
    if (faturamentoId) {
      const { data: etapas } = await admin
        .from('faturamento_etapas')
        .select('id, numero, status')
        .eq('faturamento_id', faturamentoId)
        .order('numero');

      const etapa1 = etapas?.find(e => e.numero === 1 && e.status === 'em_andamento');
      if (etapa1) {
        const etapa2 = etapas?.find(e => e.numero === 2);
        await admin.from('faturamento_etapas').update({ status: 'concluida' }).eq('id', etapa1.id);
        if (etapa2) {
          await admin.from('faturamento_etapas')
            .update({ status: 'em_andamento', iniciada_em: agora })
            .eq('id', etapa2.id);
        }
        await admin.from('faturamentos')
          .update({ etapa: 'aguardando_docs', updated_at: agora })
          .eq('id', faturamentoId);
      }
    }
  }

  return NextResponse.json({ ok: true, agendado: false, numero: whatsapp });
}

// GET /api/disparos?ffId=xxx → histórico de disparos de um ff
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const ffId = req.nextUrl.searchParams.get('ffId');
  if (!ffId) return NextResponse.json({ error: 'ffId obrigatório' }, { status: 400 });

  const { data } = await supabase
    .from('disparos')
    .select('id, tipo, subtipo, numero_destino, status, created_at, enviado_em')
    .eq('faturamento_fornecedor_id', ffId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ disparos: data ?? [] });
}

// ── PATCH — Atualiza agendado_para de um disparo agendado ─────────────────────

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await req.json() as { id: string; agendado_para: string };
  const { id, agendado_para } = body;
  if (!id || !agendado_para) {
    return NextResponse.json({ error: 'id e agendado_para obrigatórios' }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from('disparos')
    .update({ agendado_para })
    .eq('id', id)
    .eq('status', 'agendado')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disparo: data });
}
