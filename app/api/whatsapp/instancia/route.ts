/**
 * /api/whatsapp/instancia
 *
 * GET    → estado da conexão (open/conectando/close/nao_configurado)
 * POST   → cria instância e retorna QR code (com retry)
 * DELETE → desconecta e deleta instância
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { criarInstancia, desconectarInstancia, deletarInstancia } from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';
const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;
const H = { 'Content-Type': 'application/json', apikey: API_KEY };

async function autenticarGestor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.app_metadata?.role !== 'gestor') return null;
  return user;
}

// ── GET → estado + QR code quando conectando ──────────────────────────────────
export async function GET() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const res = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE_NAME}`, { headers: H });

  if (!res.ok) {
    return NextResponse.json({ status: 'nao_configurado', instanceName: INSTANCE_NAME });
  }

  const data = await res.json();
  const rawState: string = data?.instance?.state ?? data?.state ?? 'close';

  const status =
    rawState === 'open'       ? 'open'       :
    rawState === 'connecting' ? 'conectando' :
    'close';

  const number: string | null = data?.instance?.ownerJid ?? null;

  // Quando conectando, busca QR code para exibir no modal
  let qrCode: string | null = null;
  if (status === 'conectando') {
    const qrRes = await fetch(`${BASE_URL}/instance/connect/${INSTANCE_NAME}`, { headers: H });
    if (qrRes.ok) {
      const qrData = await qrRes.json();
      qrCode = qrData.base64 ?? null;
    }
  }

  return NextResponse.json({ status, instanceName: INSTANCE_NAME, number, qrCode });
}

// ── POST → cria instância (retorna imediato, cliente faz polling do QR) ────────
export async function POST() {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Deleta instância anterior e cria nova
  await deletarInstancia(INSTANCE_NAME);
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
