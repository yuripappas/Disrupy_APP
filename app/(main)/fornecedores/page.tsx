import { createClient } from "@/lib/supabase/server";
import { FornecedoresClient } from "./FornecedoresClient";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const { data: fornecedores = [] } = await supabase
    .from("fornecedores")
    .select("*")
    .eq("ativo", true)
    .order("razao_social");

  return <FornecedoresClient fornecedores={fornecedores ?? []} />;
}
