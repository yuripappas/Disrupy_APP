import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalClient } from "./PortalClient";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: ff } = await supabase
    .from("faturamento_fornecedores")
    .select(
      `id, status, prazo_dias, valor_total, link_token, orcamentos_internos_habilitado,
       fornecedor:fornecedores (razao_social, cnpj, tipo, contato_nome),
       faturamento:faturamentos (nome_campanha, cliente_nome, cliente_tipo, iclips_job_id, created_at),
       documentos (id, tipo, label, status, arquivo_url, reprovacao_motivo,
         documento_arquivos (id, arquivo_url, nome_arquivo, tamanho_bytes, created_at))`
    )
    .eq("link_token", token)
    .single();

  if (!ff) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PortalClient ff={ff as any} token={token} />;
}
