"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Users, ShieldCheck, Settings, LogOut, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { MeuPerfilModal } from "@/components/perfil/MeuPerfilModal";

const NAV_ITEMS = [
  { href: "/dashboard",     label: "Dashboard",         icon: LayoutDashboard, gestorOnly: false },
  { href: "/faturamentos",  label: "Faturamentos",      icon: FileText,        gestorOnly: false },
  { href: "/disparos",      label: "Central de Envios", icon: MessageSquare,   gestorOnly: false },
  { href: "/fornecedores",  label: "Fornecedores",      icon: Users,           gestorOnly: false },
  { href: "/certidoes",     label: "Certidões",         icon: ShieldCheck,     gestorOnly: false },
  { href: "/configuracoes", label: "Configurações",     icon: Settings,        gestorOnly: true  },
];

const ROLE_LABEL: Record<string, string> = {
  gestor:      "Gestor",
  midia:       "Mídia",
  producao:    "Produção",
  faturamento: "Faturamento",
};

type CurrentUser = { id: string; nome: string; email: string; role: string };

export function Sidebar({ currentUser }: { currentUser: CurrentUser }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(true);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isGestor    = currentUser.role === "gestor";
  const displayName = currentUser.nome || currentUser.email.split("@")[0];
  const initials    = displayName.charAt(0).toUpperCase();
  const roleLabel   = ROLE_LABEL[currentUser.role] ?? "";
  const navItems    = NAV_ITEMS.filter((item) => !item.gestorOnly || isGestor);

  return (
    <>
      <aside
        className="min-h-screen flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          backgroundColor: "#0A0A0A",
          width: collapsed ? "64px" : "232px",
          transition: "width 220ms ease",
        }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
      >
        {/* Logo */}
        <div
          className="flex items-center"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            padding: collapsed ? "20px 0" : "20px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {collapsed ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: "#2E60FF" }}
            >
              D
            </div>
          ) : (
            <div className="min-w-0">
              <Image src="/logo-disrupy-branca.svg" alt="Disrupy" width={120} height={28} priority />
              <p
                className="text-xs mt-2 tracking-[0.2em] uppercase whitespace-nowrap"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Faturamento
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 py-4 space-y-0.5"
          style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                )}
                style={active ? { backgroundColor: "#2E60FF", color: "white" } : { color: "rgba(255,255,255,0.55)" }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.color = "white";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                  }
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="space-y-1"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: collapsed ? "12px 8px 16px" : "12px 12px 16px",
          }}
        >
          {/* User info */}
          <button
            onClick={() => setPerfilOpen(true)}
            title={collapsed ? `${displayName}${roleLabel ? ` · ${roleLabel}` : ""}` : undefined}
            className={cn(
              "w-full flex items-center rounded-lg transition-all duration-150 text-left",
              collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"
            )}
            style={{ color: "rgba(255,255,255,0.75)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: "#2E60FF" }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "white" }}>{displayName}</p>
                {roleLabel && <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{roleLabel}</p>}
              </div>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150",
              collapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
            )}
            style={{ color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sair"}
          </button>

          {!collapsed && (
            <p className="text-xs px-3 pt-1" style={{ color: "rgba(255,255,255,0.2)" }}>v0.1.0 · MVP</p>
          )}
        </div>
      </aside>

      {perfilOpen && (
        <MeuPerfilModal user={currentUser} onClose={() => setPerfilOpen(false)} />
      )}
    </>
  );
}
