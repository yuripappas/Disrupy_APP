import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplatesConfig } from "@/components/configuracoes/TemplatesConfig";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "gestor") redirect("/dashboard");

  return (
    <div className="mt-6">
      <div className="mb-6">
        <p className="text-sm" style={{ color: "#64748B" }}>
          Configure as mensagens enviadas automaticamente aos fornecedores durante a cadência de cobrança.
        </p>
      </div>
      <TemplatesConfig />
    </div>
  );
}
