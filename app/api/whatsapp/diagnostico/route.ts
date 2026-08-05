/**
 * GET /api/whatsapp/diagnostico?numero=5582999999999
 *
 * Retorna diagnóstico completo da instância Evolution API:
 * - Estado real da conexão (connectionState + fetchInstances)
 * - Verificação se o número está registrado no WhatsApp
 * - Número conectado à instância
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verificarNumeros } from '@/lib/evolution-api';

const INSTANCE_NAME = 'disrupy';
const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;
const H = { 'Content-Type': 'application/json', apikey: API_KEY };

async function autenticarGestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'gestor') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const numero = req.nextUrl.searchParams.get('numero');

  // 1. connectionState bruto
  let connectionStateRaw: unknown = null;
  try {
    const r = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE_NAME}`, { headers: H });
    connectionStateRaw = r.ok ? await r.json() : { httpStatus: r.status };
  } catch (e) {
    connectionStateRaw = { fetchError: String(e) };
  }

  // 2. fetchInstances bruto
  let fetchInstancesRaw: unknown = null;
  try {
    const r = await fetch(`${BASE_URL}/instance/fetchInstances?instanceName=${INSTANCE_NAME}`, { headers: H });
    fetchInstancesRaw = r.ok ? await r.json() : { httpStatus: r.status };
  } catch (e) {
    fetchInstancesRaw = { fetchError: String(e) };
  }

  // 3. Verificação do número (se fornecido)
  let verificacaoNumero: unknown = null;
  if (numero) {
    try {
      const result = await verificarNumeros(INSTANCE_NAME, [numero]);
      verificacaoNumero = result[0] ?? null;
    } catch (e) {
      verificacaoNumero = { error: String(e) };
    }
  }

  // 4. Derivar estado legível
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs = connectionStateRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fi = Array.isArray(fetchInstancesRaw) ? (fetchInstancesRaw as any[])[0] : fetchInstancesRaw as any;

  const estado = cs?.instance?.state ?? cs?.state ?? 'desconhecido';
  const numeroConectado =
    fi?.ownerJid ??
    fi?.instance?.ownerJid ??
    fi?.instance?.owner ??
    fi?.owner ??
    cs?.instance?.ownerJid ??
    null;

  return NextResponse.json({
    instancia: INSTANCE_NAME,
    estado,
    numeroConectado,
    verificacaoNumero,
    raw: {
      connectionState: connectionStateRaw,
      fetchInstances: fetchInstancesRaw,
    },
  });
}

/**
 * POST /api/whatsapp/diagnostico
 * Body: { numero: string }
 * Envia uma mensagem de teste e retorna resposta bruta da Evolution API.
 */
export async function POST(req: NextRequest) {
  const user = await autenticarGestor();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { numero } = await req.json() as { numero?: string };
  if (!numero) return NextResponse.json({ error: 'numero obrigatório' }, { status: 400 });

  const num = numero.replace(/\D/g, '');
  const destino = num.startsWith('55') ? num : `55${num}`;

  let sendRaw: unknown = null;
  let sendOk = false;
  let sendError: string | null = null;

  try {
    const r = await fetch(`${BASE_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        number: destino,
        text: `[Disrupy] Mensagem de teste — ${new Date().toLocaleTimeString('pt-BR')}`,
      }),
    });
    sendRaw = r.ok ? await r.json() : { httpStatus: r.status, body: await r.text() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendOk = r.ok && !!(sendRaw as any)?.key?.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (r.ok && !(sendRaw as any)?.key?.id) {
      sendError = 'API retornou 200 mas sem key.id — sessão inoperante';
    }
  } catch (e) {
    sendError = String(e);
    sendRaw = { fetchError: sendError };
  }

  return NextResponse.json({
    destino,
    sendOk,
    sendError,
    raw: sendRaw,
  });
}
