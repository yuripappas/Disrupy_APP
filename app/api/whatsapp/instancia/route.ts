/**
 * /api/whatsapp/instancia
 *
 * GET  → retorna estado atual da instância (status + número conectado)
 * POST → cria instância (se não existir) e retorna QR code
 * DELETE → desconecta e deleta a instância
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  criarInstancia,
  obterQrCode,
  estadoConexao,
  listarInstancias,
  desconectarInstancia,
  deletarInstancia,
} from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';

// ── Auth helper ────────────────────────────────────────────────────────────────
async function autenticarGestor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.app_metadata?.role !== 'gestor') return null;
  return user;
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const instancias = await listarInstancias();
  const instancia = instancias.find(i => i.instanceName === INSTANCE_NAME);

  if (!instancia) {
    return NextResponse.json({ status: 'nao_configurado', instanceName: INSTANCE_NAME });
  }

  const state = await estadoConexao(INSTANCE_NAME);

  return NextResponse.json({
    status: state,
    instanceName: INSTANCE_NAME,
    number: instancia.number ?? null,
  });
}

// ── POST → conectar / obter QR ─────────────────────────────────────────────────
export async function POST() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const BASE_URL = process.env.EVOLUTION_API_URL!;
  const API_KEY  = process.env.EVOLUTION_API_KEY!;
  const headers  = { 'Content-Type': 'application/json', apikey: API_KEY };

  // DEBUG: apaga instância existente e recria, retornando a resposta raw
  await fetch(`${BASE_URL}/instance/delete/${INSTANCE_NAME}`, { method: 'DELETE', headers });

  const createRes = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ instanceName: INSTANCE_NAME, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
  });
  const createData = await createRes.json();

  const connectRes = await fetch(`${BASE_URL}/instance/connect/${INSTANCE_NAME}`, { headers });
  const connectData = connectRes.ok ? await connectRes.json() : { error: connectRes.status };

  // Tenta extrair QR de qualquer campo possível
  const qrCode =
    connectData?.base64        ??
    connectData?.qrcode?.base64 ??
    createData?.qrcode?.base64  ??
    createData?.qr?.base64      ??
    null;

  // Retorna debug + QR (temporário para diagnosticar)
  return NextResponse.json({
    qrCode,
    debug: {
      createStatus: createRes.status,
      createKeys: Object.keys(createData ?? {}),
      connectStatus: connectRes.status,
      connectKeys: Object.keys(connectData ?? {}),
      connectData,
    },
  });
}

// ── DELETE → desconectar ───────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest) {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await desconectarInstancia(INSTANCE_NAME);
  await deletarInstancia(INSTANCE_NAME);

  return NextResponse.json({ ok: true });
}
