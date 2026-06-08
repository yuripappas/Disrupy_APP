"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Users, ShieldCheck, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { MeuPerfilModal } from "@/components/perfil/MeuPerfilModal";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
  { href: "/faturamentos",  label: "Faturamentos", icon: FileText },
  { href: "/fornecedores",  label: "Fornecedores", icon: Users },
  { href: "/certidoes",     label: "Certidões",    icon: ShieldCheck },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  gestor:      "Gestor",
  midia:       "Mídia",
  producao:    "Produção",
  faturamento: "Faturamento",
};

type CurrentUser = { id: string; nome: string; email: string; role: string };

export function Sidebar({ currentUser }: { currentUser: CurrentUser }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [perfilOpen, setPerfilOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName  = currentUser.nome || currentUser.email.split("@")[0];
  const initials     = displayName.charAt(0).toUpperCase();
  const roleLabel    = ROLE_LABEL[currentUser.role] ?? "";

  return (
    <>
      <aside className="w-58 min-h-screen flex flex-col" style={{ backgroundColor: "#0A0A0A" }}>
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <Image src="/logo-disrupy-branca.svg" alt="Disrupy" width={130} height={30} priority />
          <p className="text-xs mt-2 tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
            Faturamento
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active ? "text-white" : "hover:text-white")}
                style={active ? { backgroundColor: "#2E60FF", color: "white" } : { color: "rgba(255,255,255,0.55)" }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "white"; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; } }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>

          {/* User info — opens Meu Perfil */}
          <button
            onClick={() => setPerfilOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left"
            style={{ color: "rgba(255,255,255,0.75)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: "#2E60FF" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: "white" }}>{displayName}</p>
              {roleLabel && <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{roleLabel}</p>}
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sair
          </button>

          <p className="text-xs px-3 pt-1" style={{ color: "rgba(255,255,255,0.2)" }}>v0.1.0 · MVP</p>
        </div>
      </aside>

      {perfilOpen && (
        <MeuPerfilModal user={currentUser} onClose={() => setPerfilOpen(false)} />
      )}
    </>
  );
}
