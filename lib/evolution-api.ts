/**
 * Cliente para a Evolution API (WhatsApp)
 * Documentação: https://doc.evolution-api.com
 */

const BASE_URL = process.env.EVOLUTION_API_URL!;
const API_KEY  = process.env.EVOLUTION_API_KEY!;

const headers = {
  'Content-Type': 'application/json',
  apikey: API_KEY,
};

export type InstanceState = 'open' | 'connecting' | 'close';

export interface InstanceInfo {
  instanceName: string;
  state: InstanceState;
  number?: string;
}

// ── Criar / inicializar instância ──────────────────────────────────────────────
export async function criarInstancia(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao criar instância: ${err}`);
  }
  return res.json();
}

// ── Obter QR Code ──────────────────────────────────────────────────────────────
export async function obterQrCode(instanceName: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
    headers,
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Evolution API v2 retorna { base64: "data:image/png;base64,..." }
  return data.base64 ?? data.qrcode?.base64 ?? null;
}

// ── Estado da conexão ──────────────────────────────────────────────────────────
export async function estadoConexao(instanceName: string): Promise<InstanceState> {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${instanceName}`, {
    headers,
  });
  if (!res.ok) return 'close';
  const data = await res.json();
  return data.instance?.state ?? data.state ?? 'close';
}

// ── Listar instâncias ──────────────────────────────────────────────────────────
export async function listarInstancias(): Promise<InstanceInfo[]> {
  const res = await fetch(`${BASE_URL}/instance/fetchInstances`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list.map((i: { instance?: { instanceName?: string; state?: InstanceState; owner?: string }; instanceName?: string; state?: InstanceState }) => ({
    instanceName: i.instance?.instanceName ?? i.instanceName ?? '',
    state:        i.instance?.state        ?? i.state        ?? 'close',
    number:       i.instance?.owner,
  }));
}

// ── Desconectar ────────────────────────────────────────────────────────────────
export async function desconectarInstancia(instanceName: string) {
  await fetch(`${BASE_URL}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers,
  });
}

// ── Deletar instância ──────────────────────────────────────────────────────────
export async function deletarInstancia(instanceName: string) {
  await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers,
  });
}
