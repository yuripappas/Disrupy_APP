/**
 * GET /api/cron/disparos
 *
 * Cron job que processa disparos agendados com agendado_para <= agora.
 * Configurado em vercel.json para rodar a cada hora.
 *
 * Segurança: Vercel injeta automaticamente Authorization: Bearer {CRON_SECRET}
 * Adicione CRON_SECRET nas variáveis de ambiente do Vercel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enviarMensagem, estadoConexao } from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';

export async function GET(req: NextRequest) {
  // Segurança: verifica CRON_SECRET (Vercel injeta automaticamente)
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verifica se WhatsApp está conectado
  const estado = await estadoConexao(INSTANCE_NAME);
  if (estado !== 'open') {
    return NextResponse.json({
      ok: false,
      msg: 'WhatsApp não conectado — disparos agendados não processados',
    });
  }

  // Busca todos os disparos agendados que já passaram do horário
  const agora = new Date().toISOString();
  const { data: pendentes, error } = await admin
    .from('disparos')
    .select('id, faturamento_fornecedor_id, numero_destino, mensagem')
    .eq('status', 'agendado')
    .lte('agendado_para', agora);

  if (error) {
    console.error('[cron/disparos] Erro ao buscar agendados:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ ok: true, processados: 0, msg: 'Nenhum disparo pendente' });
  }

  let enviados = 0;
  let falhos   = 0;

  for (const d of pendentes) {
    try {
      await enviarMensagem(INSTANCE_NAME, d.numero_destino, d.mensagem);
      await admin.from('disparos').update({
        status: 'enviado',
        enviado_em: new Date().toISOString(),
      }).eq('id', d.id);
      enviados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      await admin.from('disparos').update({
        status: 'falhou',
        erro: msg,
      }).eq('id', d.id);
      falhos++;
      console.error(`[cron/disparos] Falha ao enviar ${d.id}:`, msg);
    }
  }

  console.log(`[cron/disparos] Processados: ${enviados} enviados, ${falhos} falhos`);
  return NextResponse.json({ ok: true, enviados, falhos });
}
