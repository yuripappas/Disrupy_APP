import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfigTabNav } from "@/components/configuracoes/ConfigTabNav";

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isGestor = user?.app_metadata?.role === "gestor";

  if (!isGestor) redirect("/dashboard");

  const tabs = [
    ...(isGestor ? [{ href: "/configuracoes/usuarios", label: "Usuários" }] : []),
    ...(isGestor ? [{ href: "/configuracoes/fornecedores", label: "Fornecedores" }] : []),
    ...(isGestor ? [{ href: "/configuracoes/templates", label: "Templates" }] : []),
    { href: "/configuracoes", label: "Integrações" },
  ];

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Configurações</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Gerencie integrações, notificações e usuários
        </p>
      </div>

      <ConfigTabNav tabs={tabs} />

      {children}
    </div>
  );
}
