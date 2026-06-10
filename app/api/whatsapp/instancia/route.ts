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

  // 1. Tenta direto o endpoint /connect (funciona se instância já existe)
  let qrCode = await obterQrCode(INSTANCE_NAME);

  // 2. Se não tem QR, deleta instância antiga e recria
  if (!qrCode) {
    await deletarInstancia(INSTANCE_NAME);

    const criada = await criarInstancia(INSTANCE_NAME);

    // QR pode vir direto na resposta do create
    qrCode =
      criada?.qrcode?.base64 ??
      criada?.qr?.base64 ??
      null;

    // Fallback: tenta /connect após criação
    if (!qrCode) {
      qrCode = await obterQrCode(INSTANCE_NAME);
    }
  }

  if (!qrCode) {
    return NextResponse.json(
      { error: 'Não foi possível gerar o QR code. Verifique se a Evolution API está online.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ instanceName: INSTANCE_NAME, qrCode });
}

// ── DELETE → desconectar ───────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest) {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await desconectarInstancia(INSTANCE_NAME);
  await deletarInstancia(INSTANCE_NAME);

  return NextResponse.json({ ok: true });
}
