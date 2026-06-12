/**
 * POST /api/disparos/lote
 *
 * Envia ou agenda o link do portal para múltiplos fornecedores de uma vez.
 *
 * Body: { ffIds: string[], agendadoPara?: string }
 *   ffIds        = lista de faturamento_fornecedor.id
 *   agendadoPara = ISO timestamp (opcional) — se não informado, envia imediatamente
 *
 * Returns: { enviados, agendados, erros: [{ ffId, error }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://disrupy-app.vercel.app';

function montarMensagem(ff: {
  link_token: string | null;
  faturamento: { nome_campanha?: string } | null;
  fornecedor: { contato_nome?: string | null; razao_social?: string } | null;
}) {
  const portalUrl = `${APP_URL}/portal/${ff.link_token}`;
  const campanha  = ff.faturamento?.nome_campanha ?? '';
  const nome      = ff.fornecedor?.contato_nome;
  return [
    nome ? `Olá, *${nome}*! 👋` : `Olá! 👋`,
    ``,
    `Sou da equipe *Disrupy* e estou entrando em contato sobre a campanha:`,
    `📋 *${campanha}*`,
    ``,
    `Para agilizar o faturamento, acesse o portal e envie os documentos solicitados:`,
    ``,
    `🔗 ${portalUrl}`,
    ``,
    `Em caso de dúvidas, estamos à disposição. Obrigado! 🙏`,
  ].join('\n');
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || !['gestor', 'faturamento'].includes(role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json() as { ffIds?: string[]; agendadoPara?: string };
  const { ffIds, agendadoPara } = body;

  if (!ffIds || ffIds.length === 0) {
    return NextResponse.json({ error: 'ffIds obrigatório e não pode ser vazio' }, { status: 400 });
  }

  // Verifica conexão WhatsApp se for envio imediato
  if (!agendadoPara) {
    const estado = await estadoConexao(INSTANCE_NAME);
    if (estado !== 'open') {
      return NextResponse.json(
        { error: 'WhatsApp não conectado. Configure em Configurações.' },
        { status: 503 },
      );
    }
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Busca todos os ffs de uma vez
  const { data: ffs } = await admin
    .from('faturamento_fornecedores')
    .select(`
      id, link_token,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_whatsapp, contato_nome )
    `)
    .in('id', ffIds);

  if (!ffs) {
    return NextResponse.json({ error: 'Erro ao buscar fornecedores' }, { status: 500 });
  }

  let enviados = 0;
  let agendados = 0;
  const erros: { ffId: string; error: string }[] = [];

  for (const ff of ffs) {
    const whatsapp = (ff.fornecedor as { contato_whatsapp?: string | null })?.contato_whatsapp;

    if (!whatsapp) {
      erros.push({ ffId: ff.id, error: 'Sem WhatsApp cadastrado' });
      continue;
    }
    if (!ff.link_token) {
      erros.push({ ffId: ff.id, error: 'Portal não configurado' });
      continue;
    }

    const mensagem = montarMensagem(ff as Parameters<typeof montarMensagem>[0]);

    if (agendadoPara) {
      // Agenda — salva no banco sem enviar
      const { error: insErr } = await admin.from('disparos').insert({
        faturamento_fornecedor_id: ff.id,
        tipo: 'whatsapp',
        numero_destino: whatsapp,
        mensagem,
        status: 'agendado',
        agendado_para: agendadoPara,
        enviado_por: user.id,
      });
      if (insErr) {
        erros.push({ ffId: ff.id, error: insErr.message });
      } else {
        agendados++;
      }
    } else {
      // Envia imediatamente
      try {
        await enviarMensagem(INSTANCE_NAME, whatsapp, mensagem);
        await admin.from('disparos').insert({
          faturamento_fornecedor_id: ff.id,
          tipo: 'whatsapp',
          numero_destino: whatsapp,
          mensagem,
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          enviado_por: user.id,
        });
        enviados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao enviar';
        await admin.from('disparos').insert({
          faturamento_fornecedor_id: ff.id,
          tipo: 'whatsapp',
          numero_destino: whatsapp,
          mensagem,
          status: 'falhou',
          erro: msg,
          enviado_por: user.id,
        });
        erros.push({ ffId: ff.id, error: msg });
      }
    }
  }

  return NextResponse.json({ enviados, agendados, erros });
}
