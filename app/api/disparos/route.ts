/**
 * POST /api/disparos
 *
 * Envia o link do portal via WhatsApp para o fornecedor
 * e registra o disparo na tabela `disparos`.
 *
 * Body: { ffId: string }
 *   ffId = faturamento_fornecedor.id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';

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

  // Busca o ff com dados do fornecedor e faturamento
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: ff, error: ffErr } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_whatsapp, contato_nome )
    `)
    .eq('id', ffId)
    .single();

  if (ffErr || !ff) {
    return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
  }

  const whatsapp = (ff.fornecedor as { contato_whatsapp?: string | null })?.contato_whatsapp;
  if (!whatsapp) {
    return NextResponse.json({ error: 'Fornecedor sem WhatsApp cadastrado' }, { status: 400 });
  }

  if (!ff.link_token) {
    return NextResponse.json({ error: 'Portal não configurado para este fornecedor' }, { status: 400 });
  }

  // Monta mensagem
  const portalUrl   = `${APP_URL}/portal/${ff.link_token}`;
  const campanha    = (ff.faturamento as { nome_campanha?: string })?.nome_campanha ?? '';
  const contatoNome = (ff.fornecedor as { contato_nome?: string | null })?.contato_nome;

  const saudacao = contatoNome ? `Olá, *${contatoNome}*!` : `Olá!`;
  const mensagem = [
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

  // ── Agendamento ────────────────────────────────────────────────────────────
  if (agendadoPara) {
    await admin.from('disparos').insert({
      faturamento_fornecedor_id: ffId,
      tipo: 'whatsapp',
      numero_destino: whatsapp,
      mensagem,
      status: 'agendado',
      agendado_para: agendadoPara,
      enviado_por: user.id,
    });
    return NextResponse.json({ ok: true, agendado: true, agendadoPara });
  }

  // ── Envio imediato ─────────────────────────────────────────────────────────
  const estado = await estadoConexao(INSTANCE_NAME);
  if (estado !== 'open') {
    return NextResponse.json({ error: 'WhatsApp não conectado. Configure em Configurações.' }, { status: 503 });
  }

  try {
    await enviarMensagem(INSTANCE_NAME, whatsapp, mensagem);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
    await admin.from('disparos').insert({
      faturamento_fornecedor_id: ffId,
      tipo: 'whatsapp',
      numero_destino: whatsapp,
      mensagem,
      status: 'falhou',
      enviado_por: user.id,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await admin.from('disparos').insert({
    faturamento_fornecedor_id: ffId,
    tipo: 'whatsapp',
    numero_destino: whatsapp,
    mensagem,
    status: 'enviado',
    enviado_em: new Date().toISOString(),
    enviado_por: user.id,
  });

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
    .select('id, tipo, numero_destino, status, created_at')
    .eq('faturamento_fornecedor_id', ffId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ disparos: data ?? [] });
}
