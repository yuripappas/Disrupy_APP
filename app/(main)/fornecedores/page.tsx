import { createClient as createAdmin } from "@supabase/supabase-js";
import { FornecedoresClient } from "./FornecedoresClient";

export default async function FornecedoresPage() {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: fornecedores = [] } = await admin
    .from("fornecedores")
    .select("*")
    .eq("ativo", true)
    .order("razao_social");

  return <FornecedoresClient fornecedores={fornecedores ?? []} />;
}
