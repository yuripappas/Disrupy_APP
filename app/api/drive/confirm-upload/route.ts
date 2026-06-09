/**
 * POST /api/drive/confirm-upload
 *
 * Após o cliente fazer o upload direto para o Google Drive,
 * chama esta rota para:
 *   1. Tornar o arquivo público (anyone with link → reader)
 *   2. Obter o webViewLink
 *   3. Salvar em documento_arquivos
 *   4. Marcar documentos.status = "enviado"
 *
 * Body: {
 *   driveFileId:  string   (ID retornado pelo Google após o upload)
 *   documentoId:  string
 *   ffId:         string   (faturamento_fornecedor_id)
 *   filename:     string
 *   fileSize:     number
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicarArquivoDrive } from "@/lib/google-drive";

export async function POST(req: NextRequest) {
  // Supabase com role anon (portal de fornecedores não é autenticado)
  const supabase = await createClient();

  const body = await req.json() as {
    driveFileId: string;
    documentoId: string;
    ffId:        string;
    filename:    string;
    fileSize:    number;
  };

  const { driveFileId, documentoId, ffId, filename, fileSize } = body;

  if (!driveFileId || !documentoId || !ffId || !filename) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  // Torna o arquivo público e pega o link
  let webViewLink: string;
  try {
    webViewLink = await publicarArquivoDrive(driveFileId);
  } catch (e) {
    console.error("[drive/confirm-upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao publicar arquivo no Drive" },
      { status: 500 }
    );
  }

  // Salva em documento_arquivos
  const { data: arq, error: arqErr } = await supabase
    .from("documento_arquivos")
    .insert({
      documento_id:   documentoId,
      arquivo_url:    webViewLink,
      nome_arquivo:   filename,
      tamanho_bytes:  fileSize ?? null,
    })
    .select()
    .single();

  if (arqErr || !arq) {
    return NextResponse.json({ error: arqErr?.message ?? "Erro ao salvar arquivo" }, { status: 500 });
  }

  // Atualiza status do documento para "enviado" e guarda URL legada
  await supabase
    .from("documentos")
    .update({ status: "enviado", arquivo_url: webViewLink })
    .eq("id", documentoId);

  return NextResponse.json({ ok: true, arquivo: arq });
}
