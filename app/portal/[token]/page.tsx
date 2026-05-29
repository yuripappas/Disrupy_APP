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
      `id, status, prazo_dias, valor_total, link_token,
       fornecedor:fornecedores (razao_social, cnpj, tipo, contato_nome),
       faturamento:faturamentos (nome_campanha, cliente_nome, cliente_tipo),
       documentos (id, tipo, label, status, arquivo_url)`
    )
    .eq("link_token", token)
    .single();

  if (!ff) notFound();

  return <PortalClient ff={ff as never} token={token} />;
}
