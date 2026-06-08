"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ConfigTabNav({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 mb-7 border-b" style={{ borderColor: "#E2E8F0" }}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: active ? "#2E60FF" : "transparent",
              color: active ? "#2E60FF" : "#64748B",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
