import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { UsuariosClient } from "@/components/configuracoes/UsuariosClient";

const ROLE_LABELS: Record<string, string> = {
  gestor:      "Gestor",
  midia:       "Mídia",
  producao:    "Produção",
  faturamento: "Faturamento",
};

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Only gestors can access this page
  if (!user || user.app_metadata?.role !== "gestor") {
    redirect("/configuracoes");
  }

  // Fetch users with service role key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ borderColor: "#FEE2E2", backgroundColor: "#FFF5F5" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: "#991B1B" }}>Service Role Key não configurada</p>
        <p className="text-xs" style={{ color: "#B91C1C" }}>
          Adicione <code className="font-mono bg-red-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> no arquivo{" "}
          <code className="font-mono bg-red-100 px-1 rounded">.env.local</code> para gerenciar usuários.
        </p>
      </div>
    );
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });

  if (error) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ borderColor: "#FEE2E2", backgroundColor: "#FFF5F5" }}>
        <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
          Erro ao carregar usuários: {error.message}
        </p>
      </div>
    );
  }

  const users = data.users.map((u) => ({
    id:           u.id,
    email:        u.email ?? "",
    nome:         (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? "",
    role:         (u.app_metadata?.role as string) ?? "",
    role_label:   ROLE_LABELS[(u.app_metadata?.role as string) ?? ""] ?? "—",
    confirmed:    !!u.email_confirmed_at,
    last_sign_in: u.last_sign_in_at ?? null,
    created_at:   u.created_at,
  }));

  // Sort: gestor first, then alphabetically by email
  users.sort((a, b) => {
    if (a.role === "gestor" && b.role !== "gestor") return -1;
    if (b.role === "gestor" && a.role !== "gestor") return 1;
    return a.email.localeCompare(b.email);
  });

  return <UsuariosClient initialUsers={users} currentUserId={user.id} />;
}
