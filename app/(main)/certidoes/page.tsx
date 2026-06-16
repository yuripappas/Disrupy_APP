import { createClient } from "@/lib/supabase/server";
import { CerticoesClient } from "./CerticoesClient";

export default async function CerticoesPage() {
  const supabase = await createClient();
  const { data: certidoes = [] } = await supabase
    .from("certidoes")
    .select("id, tipo, label, validade, arquivo_url, nome_arquivo, tamanho_bytes")
    .order("tipo");

  return <CerticoesClient certidoesIniciais={certidoes ?? []} />;
}
