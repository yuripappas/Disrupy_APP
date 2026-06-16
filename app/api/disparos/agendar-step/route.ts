/**
 * POST /api/disparos/agendar-step
 *
 * Agenda (ou reagenda) um step específico da cadência para um fornecedor.
 * Cancela qualquer agendamento anterior do mesmo step antes de criar o novo.
 *
 * Body: { ffId: string; step: string; agendadoPara: string; canal?: "whatsapp" | "email" | "ambos" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

const STEPS_VALIDOS = ['link_inicial', 'lembrete_1', 'lembrete_2', 'lembrete_3', 'lembrete_4'];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !['gestor', 'faturamento'].includes(role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { ffId, step, agendadoPara, canal = 'ambos' } = await req.json() as {
    ffId: string;
    step: string;
    agendadoPara: string;
    canal?: 'whatsapp' | 'email' | 'ambos';
  };

  if (!ffId || !step || !agendadoPara) {
    return NextResponse.json({ error: 'ffId, step e agendadoPara são obrigatórios' }, { status: 400 });
  }
  if (!STEPS_VALIDOS.includes(step)) {
    return NextResponse.json({ error: `Step inválido: ${step}` }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Cancela agendamentos anteriores deste step (status agendado)
  await admin
    .from('disparos')
    .update({ status: 'cancelado' })
    .eq('faturamento_fornecedor_id', ffId)
    .eq('subtipo', step)
    .eq('status', 'agendado');

  // Busca dados do fornecedor para montar a mensagem
  const { data: ff } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_nome, contato_whatsapp, contato_email )
    `)
    .eq('id', ffId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forn  = (ff?.fornecedor as any) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fat   = (ff?.faturamento as any) ?? {};
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';
  const portalUrl = `${appUrl}/portal/${ff?.link_token ?? ''}`;

  // Busca template do step
  const { data: tmpl } = await admin
    .from('cadencia_templates')
    .select('canal_whatsapp, mensagem_whatsapp, canal_email, assunto_email, corpo_email')
    .eq('step', step)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserts: any[] = [];

  const enviarWa    = (canal === 'ambos' || canal === 'whatsapp') && forn.contato_whatsapp;
  const enviarEmail = (canal === 'ambos' || canal === 'email')    && forn.contato_email;

  if (enviarWa) {
    let mensagem = `Lembrete sobre a campanha ${fat.nome_campanha}. Acesse: ${portalUrl}`;
    if (tmpl?.canal_whatsapp && tmpl?.mensagem_whatsapp) {
      mensagem = tmpl.mensagem_whatsapp
        .replace(/\{\{nome\}\}/g, forn.contato_nome ?? '')
        .replace(/\{\{empresa\}\}/g, forn.razao_social ?? '')
        .replace(/\{\{campanha\}\}/g, fat.nome_campanha ?? '')
        .replace(/\{\{link\}\}/g, portalUrl);
    }
    inserts.push(admin.from('disparos').insert({
      faturamento_fornecedor_id: ffId,
      tipo: 'whatsapp',
      subtipo: step,
      numero_destino: forn.contato_whatsapp,
      mensagem,
      status: 'agendado',
      agendado_para: agendadoPara,
      enviado_por: user.id,
    }));
  }

  if (enviarEmail) {
    const assunto = tmpl?.assunto_email
      ?.replace(/\{\{campanha\}\}/g, fat.nome_campanha ?? '') ?? `Lembrete — ${fat.nome_campanha}`;
    const corpo = tmpl?.corpo_email
      ?.replace(/\{\{nome\}\}/g, forn.contato_nome ?? '')
      .replace(/\{\{empresa\}\}/g, forn.razao_social ?? '')
      .replace(/\{\{campanha\}\}/g, fat.nome_campanha ?? '')
      .replace(/\{\{link\}\}/g, portalUrl)
      ?? `<p>Lembrete sobre a campanha <strong>${fat.nome_campanha}</strong>. <a href="${portalUrl}">Acesse o portal</a>.</p>`;

    inserts.push(admin.from('disparos').insert({
      faturamento_fornecedor_id: ffId,
      tipo: 'email',
      subtipo: step,
      email_destino: forn.contato_email,
      assunto,
      mensagem: corpo,
      status: 'agendado',
      agendado_para: agendadoPara,
      enviado_por: user.id,
    }));
  }

  if (inserts.length === 0) {
    return NextResponse.json({ error: 'Nenhum canal disponível para este fornecedor' }, { status: 400 });
  }

  await Promise.all(inserts);
  return NextResponse.json({ ok: true, step, agendadoPara, canais: inserts.length });
}
