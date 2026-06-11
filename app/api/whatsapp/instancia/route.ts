/**
 * /api/whatsapp/instancia
 *
 * GET    → estado da conexão + QR code (se estiver conectando)
 * POST   → cria instância (deleta a antiga se existir)
 * DELETE → desconecta e deleta instância
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  criarInstancia,
  estadoConexao,
  listarInstancias,
  desconectarInstancia,
  deletarInstancia,
} from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';
const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;

async function autenticarGestor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.app_metadata?.role !== 'gestor') return null;
  return user;
}

// ── GET → estado + QR code ─────────────────────────────────────────────────────
export async function GET() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const instancias = await listarInstancias();
  const instancia = instancias.find(i => i.instanceName === INSTANCE_NAME);

  if (!instancia) {
    return NextResponse.json({ status: 'nao_configurado', instanceName: INSTANCE_NAME });
  }

  const state = await estadoConexao(INSTANCE_NAME);

  // Se conectando, tenta pegar o QR code
  let qrCode: string | null = null;
  if (state !== 'open') {
    const res = await fetch(`${BASE_URL}/instance/connect/${INSTANCE_NAME}`, {
      headers: { apikey: API_KEY },
    });
    if (res.ok) {
      const data = await res.json();
      qrCode = data.base64 ?? null;
    }
  }

  return NextResponse.json({
    status: state,
    instanceName: INSTANCE_NAME,
    number: instancia.number ?? null,
    qrCode,
  });
}

// ── POST → cria instância ──────────────────────────────────────────────────────
export async function POST() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Deleta instância anterior se existir
  await deletarInstancia(INSTANCE_NAME);

  // Cria nova instância
  await criarInstancia(INSTANCE_NAME);

  return NextResponse.json({ ok: true, instanceName: INSTANCE_NAME });
}

// ── DELETE → desconectar ───────────────────────────────────────────────────────
export async function DELETE() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await desconectarInstancia(INSTANCE_NAME);
  await deletarInstancia(INSTANCE_NAME);

  return NextResponse.json({ ok: true });
}
