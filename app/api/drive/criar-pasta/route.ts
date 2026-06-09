/**
 * POST /api/drive/criar-pasta
 *
 * Cria a estrutura de pastas no Google Drive para um faturamento
 * e salva os IDs das pastas no banco.
 *
 * Body: { faturamentoId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarEstruturaPastas } from "@/lib/google-drive";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { faturamentoId } = await req.json() as { faturamentoId: string };
  if (!faturamentoId) {
    return NextResponse.json({ error: "faturamentoId obrigatório" }, { status: 400 });
  }

  // Busca dados do faturamento
  const { data: fat, error: fatErr } = await supabase
    .from("faturamentos")
    .select("id, nome_campanha, iclips_job_id, cliente_nome, drive_folder_id, created_at")
    .eq("id", faturamentoId)
    .single();

  if (fatErr || !fat) {
    return NextResponse.json({ error: "Faturamento não encontrado" }, { status: 404 });
  }

  // Se já tem pasta criada, retorna os IDs existentes
  if (fat.drive_folder_id) {
    const { data: fat2 } = await supabase
      .from("faturamentos")
      .select("drive_folder_id, drive_os_folder_id, drive_pi_folder_id, drive_ci_folder_id, drive_proposta_folder_id")
      .eq("id", faturamentoId)
      .single();
    return NextResponse.json({ ok: true, folders: fat2 });
  }

  // Cria estrutura de pastas no Drive
  const ano = new Date(fat.created_at).getFullYear();
  const jobId = fat.iclips_job_id ?? `FAT-${faturamentoId.slice(0, 6)}`;
  const nomeCampanha = fat.nome_campanha ?? "SEM NOME";
  const clienteNome  = fat.cliente_nome  ?? "SEM CLIENTE";

  let folders;
  try {
    folders = await criarEstruturaPastas({
      ano,
      cliente_nome:  clienteNome.toUpperCase(),
      iclips_job_id: jobId,
      nome_campanha: nomeCampanha.toUpperCase(),
    });
  } catch (e) {
    console.error("[drive/criar-pasta]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar pastas no Drive" },
      { status: 500 }
    );
  }

  // Salva os IDs no banco
  const { error: updateErr } = await supabase
    .from("faturamentos")
    .update(folders)
    .eq("id", faturamentoId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, folders });
}
