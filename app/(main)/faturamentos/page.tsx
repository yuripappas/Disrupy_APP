import { createClient } from "@/lib/supabase/server";
import { FaturamentosClient } from "./FaturamentosClient";

export default async function FaturamentosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isGestor = user?.app_metadata?.role === "gestor";

  const { data: faturamentos = [] } = await supabase
    .from("faturamentos")
    .select("*")
    .order("updated_at", { ascending: false });

  return <FaturamentosClient faturamentos={faturamentos ?? []} isGestor={isGestor} />;
}
