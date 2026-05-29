"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <h2 className="font-semibold text-base" style={{ color: "#0F172A" }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" style={{ color: "#64748B" }} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
      style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
      onFocus={(e) => { e.target.style.borderColor = "#2E60FF"; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = "#CBD5E1"; props.onBlur?.(e); }}
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none bg-white"
      style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
    >
      {children}
    </select>
  );
}
