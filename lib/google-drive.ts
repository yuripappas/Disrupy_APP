/**
 * lib/google-drive.ts
 * Utilitário server-only para integração com Google Drive via Service Account.
 *
 * Variáveis de ambiente necessárias:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — client_email do JSON da Service Account
 *   GOOGLE_PRIVATE_KEY            — private_key do JSON (com \n reais)
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID   — ID da pasta raiz no Google Drive
 */

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { Readable } from "stream";

// ── Auth ──────────────────────────────────────────────────────────────────────

function getDrive(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

// ── Helpers de pasta ──────────────────────────────────────────────────────────

/**
 * Busca uma pasta por nome dentro de um parent.
 * Se não existir, cria e retorna o ID.
 */
export async function criarOuBuscarPasta(
  nome: string,
  parentId: string,
): Promise<string> {
  const drive = getDrive();

  // Escapa aspas simples para a query do Drive
  const nomeEscapado = nome.replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `name='${nomeEscapado}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files?.length) {
    return res.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return created.data.id!;
}

/**
 * Cria a hierarquia de pastas para um faturamento:
 *   [ROOT] / ANO / CLIENTE / #JOB - CAMPANHA / OS, PI, CUSTO INTERNO, PROPOSTA
 */
export async function criarEstruturaPastas(params: {
  ano: number;
  cliente_nome: string;
  iclips_job_id: string;   // ex: "#2955"
  nome_campanha: string;   // ex: "MAIO AMARELO 2024"
}): Promise<{
  drive_folder_id: string;
  drive_os_folder_id: string;
  drive_pi_folder_id: string;
  drive_ci_folder_id: string;
  drive_proposta_folder_id: string;
}> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID não configurado");

  // ANO
  const anoId = await criarOuBuscarPasta(String(params.ano), rootId);

  // CLIENTE
  const clienteId = await criarOuBuscarPasta(params.cliente_nome, anoId);

  // CAMPANHA — sempre cria nova (job_id garante unicidade)
  const nomeCampanha = `${params.iclips_job_id} - ${params.nome_campanha}`;
  const campanhaId = await criarOuBuscarPasta(nomeCampanha, clienteId);

  // SUBPASTAS em paralelo
  const [osId, piId, ciId, propostaId] = await Promise.all([
    criarOuBuscarPasta("OS",            campanhaId),
    criarOuBuscarPasta("PI",            campanhaId),
    criarOuBuscarPasta("CUSTO INTERNO", campanhaId),
    criarOuBuscarPasta("PROPOSTA",      campanhaId),
  ]);

  return {
    drive_folder_id:         campanhaId,
    drive_os_folder_id:      osId,
    drive_pi_folder_id:      piId,
    drive_ci_folder_id:      ciId,
    drive_proposta_folder_id: propostaId,
  };
}

// ── Upload de arquivo ─────────────────────────────────────────────────────────

/**
 * Cria uma sessão de upload resumível no Google Drive.
 * O cliente faz o PUT diretamente para a URL retornada — sem passar pelo Vercel,
 * logo sem limite de tamanho.
 *
 * @returns URL de upload resumível (válida por ~1 semana)
 */
export async function criarSessaoUploadResumivel(params: {
  folderId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}): Promise<string> {
  const drive = getDrive();

  // Obtém o token de acesso do service account
  const authClient = drive.context._options.auth as ReturnType<typeof google.auth.GoogleAuth.prototype.fromJSON>;
  // @ts-expect-error — acesso interno ao client auth
  const tokenResponse = await drive.context._options.auth.getAccessToken();
  const accessToken = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

  if (!accessToken) throw new Error("Não foi possível obter access token do Drive");

  // Inicia sessão resumível via fetch (googleapis não expõe isso facilmente)
  const metadataRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": String(params.fileSize),
      },
      body: JSON.stringify({
        name: params.filename,
        parents: [params.folderId],
      }),
    }
  );

  if (!metadataRes.ok) {
    const err = await metadataRes.text();
    throw new Error(`Drive: erro ao criar sessão de upload: ${err}`);
  }

  const uploadUrl = metadataRes.headers.get("location");
  if (!uploadUrl) throw new Error("Drive: Location header não retornado");

  return uploadUrl;
}

/**
 * Após o upload do arquivo para o Google Drive, define permissão pública
 * (anyone with link → reader) e retorna o link de visualização.
 */
export async function publicarArquivoDrive(fileId: string): Promise<string> {
  const drive = getDrive();

  // Permissão pública de leitura
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Retorna link de visualização
  const file = await drive.files.get({
    fileId,
    fields: "webViewLink",
  });

  return file.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Upload direto de um Buffer (para uso server-side em arquivos pequenos / certidões).
 * Para arquivos grandes do portal, use criarSessaoUploadResumivel + publicarArquivoDrive.
 */
export async function uploadBufferDrive(params: {
  folderId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDrive();

  const res = await drive.files.create({
    requestBody: {
      name: params.filename,
      parents: [params.folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: "id,webViewLink",
  });

  const fileId = res.data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId,
    webViewLink: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}
