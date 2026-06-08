"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faturamentos", label: "Faturamentos", icon: FileText },
  { href: "/fornecedores", label: "Fornecedores", icon: Users },
  { href: "/certidoes", label: "Certidões", icon: ShieldCheck },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-58 min-h-screen flex flex-col" style={{ backgroundColor: "#00246D" }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Image
          src="/logo-disrupy-branca.svg"
          alt="Disrupy"
          width={130}
          height={30}
          priority
        />
        <p className="text-xs mt-2 tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
          Faturamento
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "hover:text-white"
              )}
              style={
                active
                  ? { backgroundColor: "#2E60FF", color: "white" }
                  : { color: "rgba(255,255,255,0.55)" }
              }
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
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
          style={{ color: "rgba(255,255,255,0.55)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
            (e.currentTarget as HTMLElement).style.color = "white";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
          }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sair
        </button>
        <p className="text-xs px-3" style={{ color: "rgba(255,255,255,0.2)" }}>
          v0.1.0 · MVP
        </p>
      </div>
    </aside>
  );
}
