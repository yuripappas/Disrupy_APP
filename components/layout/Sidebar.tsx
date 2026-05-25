"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/faturamentos", label: "Faturamentos", icon: FileText },
  { href: "/fornecedores", label: "Fornecedores", icon: Users },
  { href: "/certidoes", label: "Certidões", icon: ShieldCheck },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-58 min-h-screen flex flex-col" style={{ backgroundColor: "#00246D" }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 flex items-center justify-center rounded"
            style={{ backgroundColor: "#2E60FF" }}
          >
            <Zap className="w-4 h-4" style={{ color: "#00E7FF" }} fill="currentColor" />
          </div>
          <span className="text-white font-bold text-base tracking-[0.15em]">DISRUPY</span>
        </div>
        <p className="text-xs mt-1.5 tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
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
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          v0.1.0 · MVP
        </p>
      </div>
    </aside>
  );
}
