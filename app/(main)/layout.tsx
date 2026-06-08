import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentUser = {
    id:    user?.id ?? "",
    nome:  (user?.user_metadata?.full_name as string) ?? (user?.user_metadata?.name as string) ?? "",
    email: user?.email ?? "",
    role:  (user?.app_metadata?.role as string) ?? "",
  };

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar currentUser={currentUser} />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#F8FAFC" }}>
        {children}
      </main>
    </div>
  );
}
