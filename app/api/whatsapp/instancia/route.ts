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

  // Verifica se instância já existe
  const instancias = await listarInstancias();
  const instanciaExistente = instancias.find(i => i.instanceName === INSTANCE_NAME);

  // Se já está conectada, retorna sem QR
  if (instanciaExistente?.state === 'open') {
    return NextResponse.json({ instanceName: INSTANCE_NAME, qrCode: null, jaConectado: true });
  }

  // Se existe mas não está conectada, deleta para recriar limpa
  if (instanciaExistente) {
    await desconectarInstancia(INSTANCE_NAME);
    await deletarInstancia(INSTANCE_NAME);
    // Aguarda um instante para o servidor processar
    await new Promise(r => setTimeout(r, 1500));
  }

  // Cria nova instância — o QR vem direto na resposta de criação
  const criada = await criarInstancia(INSTANCE_NAME);

  // Tenta pegar QR da resposta do create (v2: criada.qrcode.base64)
  let qrCode: string | null =
    criada?.qrcode?.base64 ??
    criada?.qr?.base64 ??
    null;

  // Fallback: tenta endpoint /connect
  if (!qrCode) {
    await new Promise(r => setTimeout(r, 1000));
    qrCode = await obterQrCode(INSTANCE_NAME);
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
