/**
 * lib/google-drive.ts
 *
 * Integração com Google Drive via Google Apps Script Web App.
 * O Apps Script roda com a conta Google da Disrupy — sem service account,
 * sem googleapis, sem limite de tamanho de arquivo.
 *
 * Variável de ambiente necessária:
 *   NEXT_PUBLIC_APPS_SCRIPT_URL  — URL do Web App publicado no Apps Script
 *
 * Estrutura de pastas criada automaticamente:
 *   [PASTA RAIZ] / ANO / CLIENTE / #JOB - CAMPANHA / OS | PI | CUSTO INTERNO | PROPOSTA
 */

export type SubpastaDrive = 'OS' | 'PI' | 'CUSTO INTERNO' | 'PROPOSTA';

export interface UploadDriveParams {
  fileName:    string;
  fileContent: string;   // base64
  mimeType:    string;
  ano:         number;
  clienteNome: string;
  jobId:       string;   // ex: "#2955"
  campanha:    string;   // ex: "MAIO AMARELO 2024"
  subpasta:    SubpastaDrive;
}

export interface UploadDriveResult {
  fileId:   string;
  viewUrl:  string;
  fileName: string;
  pasta:    string;
}

/**
 * Determina a subpasta do Drive com base no tipo de fornecedor.
 * - midia    → PI
 * - producao → OS
 * - null     → CUSTO INTERNO (custos internos da agência)
 */
export function getSubpasta(tipoFornecedor: string | null): SubpastaDrive {
  if (tipoFornecedor === 'midia')    return 'PI';
  if (tipoFornecedor === 'producao') return 'OS';
  return 'CUSTO INTERNO';
}

/**
 * Chama o Apps Script diretamente do browser.
 * Usa Content-Type: text/plain para evitar CORS preflight.
 */
export async function uploadParaDrive(params: UploadDriveParams): Promise<UploadDriveResult> {
  const url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL não configurada');

  const res = await fetch(url, {
    method:  'POST',
    // text/plain = requisição "simples" → sem preflight CORS → Apps Script responde
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(params),
  });

  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);

  const data = await res.json() as { ok: boolean; error?: string } & UploadDriveResult;
  if (!data.ok) throw new Error(data.error ?? 'Erro no Apps Script');

  return data;
}
