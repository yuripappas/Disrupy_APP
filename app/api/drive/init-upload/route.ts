/**
 * POST /api/drive/init-upload
 *
 * Determina a pasta correta no Drive e cria uma sessão de upload resumível.
 * O cliente então faz PUT diretamente para a URL retornada — sem passar pelo Vercel.
 * Isso elimina limites de tamanho de arquivo.
 *
 * Body: {
 *   documentoId: string
 *   ffId:        string   (faturamento_fornecedor_id)
 *   filename:    string
 *   mimeType:    string
 *   fileSize:    number   (bytes)
 * }
 *
 * Response: { uploadUrl: string, folderId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarSessaoUploadResumivel } from "@/lib/google-drive";

// Mapa de tipo de documento → qual subpasta usar (por tipo de fornecedor)
// midia → PI | producao → OS | null (custos internos) → CUSTO INTERNO
function getFolderKey(
  tipoFornecedor: "midia" | "producao" | null
): "drive_pi_folder_id" | "drive_os_folder_id" | "drive_ci_folder_id" {
  if (tipoFornecedor === "midia") return "drive_pi_folder_id";
  if (tipoFornecedor === "producao") return "drive_os_folder_id";
  return "drive_ci_folder_id";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Permite anon (fornecedores no portal)
  // Verifica apenas se o documento e ff existem e estão relacionados

  const body = await req.json() as {
    documentoId: string;
    ffId:        string;
    filename:    string;
    mimeType:    string;
    fileSize:    number;
  };

  const { documentoId, ffId, filename, mimeType, fileSize } = body;
  if (!documentoId || !ffId || !filename || !mimeType || !fileSize) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  // Busca o faturamento_fornecedor e o faturamento (com pastas do Drive)
  const { data: ff, error: ffErr } = await supabase
    .from("faturamento_fornecedores")
    .select(`
      id,
      tipo_iclips,
      fornecedor:fornecedores ( tipo ),
      faturamento:faturamentos (
        id,
        drive_folder_id,
        drive_os_folder_id,
        drive_pi_folder_id,
        drive_ci_folder_id,
        drive_proposta_folder_id
      )
    `)
    .eq("id", ffId)
    .single();

  if (ffErr || !ff) {
    return NextResponse.json({ error: "Fornecedor de faturamento não encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fat = ff.faturamento as any;
  if (!fat?.drive_folder_id) {
    return NextResponse.json(
      { error: "Pastas do Drive ainda não criadas para este faturamento. Crie via importação." },
      { status: 400 }
    );
  }

  // Determina tipo do fornecedor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tipoFornecedor = (ff.tipo_iclips ?? (ff.fornecedor as any)?.tipo ?? null) as "midia" | "producao" | null;
  const folderKey = getFolderKey(tipoFornecedor);
  const folderId  = fat[folderKey] as string;

  if (!folderId) {
    return NextResponse.json({ error: "Pasta Drive não encontrada para esse tipo" }, { status: 400 });
  }

  // Cria sessão de upload resumível
  let uploadUrl: string;
  try {
    uploadUrl = await criarSessaoUploadResumivel({ folderId, filename, mimeType, fileSize });
  } catch (e) {
    console.error("[drive/init-upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar sessão no Drive" },
      { status: 500 }
    );
  }

  return NextResponse.json({ uploadUrl, folderId });
}
