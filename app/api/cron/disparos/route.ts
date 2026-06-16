/**
 * GET /api/cron/disparos
 *
 * Cron job que:
 * 1. Processa disparos agendados (agendado_para <= agora)
 * 2. Executa a cadência automática de lembretes (lembrete_1..4)
 *    baseado em dias desde envio_inicial_em
 *
 * Vercel cron — configurar em vercel.json:
 *   Hobby:  "0 9 * * *"  (diário — suficiente, lembretes são por dia)
 *   Pro:    "0 * * * *"  (a cada hora)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';
import { sendEmail } from '@/lib/email';
import { interpolar, buildVars, diasDesde } from '@/lib/cadencia';

const INSTANCE_NAME = 'disrupy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';

// Ordem dos lembretes automáticos
const LEMBRETES = [
  { step: 'lembrete_1', dias: 2 },
  { step: 'lembrete_2', dias: 3 },
  { step: 'lembrete_3', dias: 4 },
  { step: 'lembrete_4', dias: 5 },
] as const;

type CadenciaTemplate = {
  step: string;
  ativo: boolean;
  dias_apos_envio: number | null;
  canal_whatsapp: boolean;
  canal_email: boolean;
  mensagem_whatsapp: string | null;
  assunto_email: string | null;
  corpo_email: string | null;
};

export async function GET(req: NextRequest) {
  // Segurança: Vercel injeta automaticamente Authorization: Bearer {CRON_SECRET}
  const auth   = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const resultado = {
    agendados: { enviados: 0, falhos: 0 },
    cadencia:  { enviados: 0, falhos: 0, ignorados: 0 },
  };

  // ── 1. Processa disparos agendados ────────────────────────────────────────

  const agora = new Date().toISOString();
  const { data: agendados, error: errAgend } = await admin
    .from('disparos')
    .select('id, faturamento_fornecedor_id, tipo, numero_destino, mensagem, email_destino, assunto')
    .eq('status', 'agendado')
    .lte('agendado_para', agora);

  if (errAgend) {
    console.error('[cron] Erro ao buscar agendados:', errAgend.message);
  } else {
    const whatsappConectado = (await estadoConexao(INSTANCE_NAME)) === 'open';

    for (const d of (agendados ?? [])) {
      try {
        if (d.tipo === 'whatsapp') {
          if (!whatsappConectado) throw new Error('WhatsApp desconectado');
          await enviarMensagem(INSTANCE_NAME, d.numero_destino, d.mensagem);
        } else if (d.tipo === 'email') {
          const emailRes = await sendEmail({
            to: d.email_destino,
            subject: d.assunto ?? 'Disrupy — Documentação pendente',
            html: d.mensagem,
          });
          if (!emailRes.ok) throw new Error(emailRes.error ?? 'Falha no email');
        }
        await admin.from('disparos').update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
        }).eq('id', d.id);
        resultado.agendados.enviados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        await admin.from('disparos').update({ status: 'falhou', erro: msg }).eq('id', d.id);
        resultado.agendados.falhos++;
        console.error(`[cron] Falha agendado ${d.id}:`, msg);
      }
    }
  }

  // ── 2. Cadência automática de lembretes ───────────────────────────────────

  // Busca todos os templates ativos
  const { data: templates } = await admin
    .from('cadencia_templates')
    .select('step, ativo, dias_apos_envio, canal_whatsapp, canal_email, mensagem_whatsapp, assunto_email, corpo_email')
    .eq('ativo', true);

  const tmplMap = new Map<string, CadenciaTemplate>(
    ((templates ?? []) as CadenciaTemplate[]).map((t) => [t.step, t]),
  );

  // Busca ffs com link enviado, docs pendentes
  const { data: ffs, error: errFfs } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token, envio_inicial_em,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_nome, contato_whatsapp, contato_email ),
      documentos ( id, status ),
      disparos   ( id, subtipo, status, tipo )
    `)
    .eq('associado', true)
    .not('link_token', 'is', null)
    .not('envio_inicial_em', 'is', null);

  if (errFfs) {
    console.error('[cron] Erro ao buscar ffs:', errFfs.message);
    return NextResponse.json({ ok: false, error: errFfs.message, resultado });
  }

  const whatsappConectado = (await estadoConexao(INSTANCE_NAME)) === 'open';

  for (const ff of (ffs ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forn   = (ff.fornecedor as any) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fat    = (ff.faturamento as any) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs   = (ff.documentos as any[]) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disp   = (ff.disparos as any[]) ?? [];

    // Verifica se já respondeu (todos os docs preenchidos)
    const totalDocs  = docs.length;
    const filledDocs = docs.filter((d: { status: string }) => d.status !== 'pendente').length;
    if (totalDocs > 0 && filledDocs === totalDocs) {
      resultado.cadencia.ignorados++;
      continue; // Fornecedor já respondeu — não enviar lembretes
    }

    const portalUrl   = `${APP_URL}/portal/${ff.link_token}`;
    const nomeCampanha = fat.nome_campanha ?? '';
    const vars = buildVars({
      contatoNome: forn.contato_nome,
      razaoSocial: forn.razao_social ?? '',
      nomeCampanha,
      portalUrl,
    });

    // Dias desde envio inicial
    const dias = diasDesde(ff.envio_inicial_em);

    // Verifica cada lembrete na ordem
    for (const lembrete of LEMBRETES) {
      if (dias < lembrete.dias) continue; // Ainda não chegou o dia

      const tmpl = tmplMap.get(lembrete.step);
      if (!tmpl || !tmpl.ativo) continue;

      // Verifica por canal se já foi enviado (independentes)
      const waJaEnviado = disp.some(
        (d: { subtipo: string; status: string; tipo: string }) =>
          d.subtipo === lembrete.step && d.tipo !== 'email' && d.status === 'enviado',
      );
      const mailJaEnviado = disp.some(
        (d: { subtipo: string; status: string; tipo: string }) =>
          d.subtipo === lembrete.step && d.tipo === 'email' && d.status === 'enviado',
      );
      // Pula se todos os canais configurados já foram enviados
      const waOk   = !tmpl.canal_whatsapp || waJaEnviado;
      const mailOk = !tmpl.canal_email    || mailJaEnviado;
      if (waOk && mailOk) continue;

      const agora2 = new Date().toISOString();

      // Envia WhatsApp se configurado e ainda não enviado
      if (tmpl.canal_whatsapp && !waJaEnviado && forn.contato_whatsapp && tmpl.mensagem_whatsapp) {
        const msg = interpolar(tmpl.mensagem_whatsapp, vars);
        try {
          if (!whatsappConectado) throw new Error('WhatsApp desconectado');
          await enviarMensagem(INSTANCE_NAME, forn.contato_whatsapp, msg);
          await admin.from('disparos').insert({
            faturamento_fornecedor_id: ff.id,
            tipo: 'whatsapp',
            subtipo: lembrete.step,
            numero_destino: forn.contato_whatsapp,
            mensagem: msg,
            status: 'enviado',
            enviado_em: agora2,
          });
          resultado.cadencia.enviados++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro WA';
          await admin.from('disparos').insert({
            faturamento_fornecedor_id: ff.id,
            tipo: 'whatsapp',
            subtipo: lembrete.step,
            numero_destino: forn.contato_whatsapp,
            mensagem: msg,
            status: 'falhou',
            erro: errMsg,
          });
          resultado.cadencia.falhos++;
          console.error(`[cron] Cadência WA falhou (${lembrete.step}, ff=${ff.id}):`, errMsg);
        }
      }

      // Envia Email se configurado e ainda não enviado
      if (tmpl.canal_email && !mailJaEnviado && forn.contato_email && tmpl.corpo_email && tmpl.assunto_email) {
        const html    = interpolar(tmpl.corpo_email,   vars);
        const subject = interpolar(tmpl.assunto_email, vars);
        try {
          const emailRes = await sendEmail({ to: forn.contato_email, subject, html });
          if (!emailRes.ok) throw new Error(emailRes.error ?? 'Falha no email');
          await admin.from('disparos').insert({
            faturamento_fornecedor_id: ff.id,
            tipo: 'email',
            subtipo: lembrete.step,
            email_destino: forn.contato_email,
            assunto: subject,
            mensagem: html,
            status: 'enviado',
            enviado_em: agora2,
          });
          resultado.cadencia.enviados++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro email';
          await admin.from('disparos').insert({
            faturamento_fornecedor_id: ff.id,
            tipo: 'email',
            subtipo: lembrete.step,
            email_destino: forn.contato_email,
            assunto: subject,
            mensagem: html,
            status: 'falhou',
            erro: errMsg,
          });
          resultado.cadencia.falhos++;
          console.error(`[cron] Cadência email falhou (${lembrete.step}, ff=${ff.id}):`, errMsg);
        }
      }
    }
  }

  console.log('[cron/disparos]', JSON.stringify(resultado));
  return NextResponse.json({ ok: true, resultado });
}
