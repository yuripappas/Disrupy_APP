import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { FornecedoresConfig } from "@/components/configuracoes/FornecedoresConfig";

export default async function FornecedoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== "gestor") {
    redirect("/configuracoes");
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin
    .from("fornecedores")
    .select("id, razao_social, cnpj, tipo, contato_nome, contato_whatsapp, contato_email, ativo")
    .eq("ativo", true)
    .order("razao_social");

  if (error) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: "#FEE2E2", backgroundColor: "#FFF5F5" }}
      >
        <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
          Erro ao carregar fornecedores: {error.message}
        </p>
      </div>
    );
  }

  return <FornecedoresConfig fornecedores={data ?? []} />;
}
