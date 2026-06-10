import { Settings, Bell, Globe, Key } from "lucide-react";
import { WhatsAppConfig } from "@/components/configuracoes/WhatsAppConfig";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Section icon={<Globe className="w-4 h-4" />} title="Integrações">
        <ConfigItem label="iClips ERP" value="API Key configurada · AgencyId 5050" status="ok" />
        <WhatsAppConfig />
        <ConfigItem label="Google Drive" value="Apps Script configurado" status="ok" />
      </Section>

      <Section icon={<Bell className="w-4 h-4" />} title="Notificações">
        <ConfigItem label="WhatsApp para fornecedores" value="Prazo padrão: 5 dias úteis" status="ok" />
        <ConfigItem label="E-mail de alertas" value="Não configurado" status="pending" />
      </Section>

      <Section icon={<Key className="w-4 h-4" />} title="Automações">
        <ConfigItem label="Diana (Governo AL)" value="Playwright · não configurado" status="pending" />
        <ConfigItem label="PPE SEBRAE" value="Playwright · não configurado" status="pending" />
      </Section>

      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4" style={{ color: "#94A3B8" }} />
          <p className="text-sm font-semibold" style={{ color: "#334155" }}>Sobre esta versão</p>
        </div>
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          Disrupy Faturamento v0.1.0 · MVP
          <br />
          Evolution API v2.2.3 · Railway
        </p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
        <span style={{ color: "#64748B" }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: "#334155" }}>{title}</span>
      </div>
      <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>{children}</div>
    </div>
  );
}

function ConfigItem({ label, value, status }: { label: string; value: string; status: "ok" | "pending" | "error" }) {
  const dot = { ok: "#10B981", pending: "#F59E0B", error: "#EF4444" }[status];
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div>
        <p className="text-sm font-medium" style={{ color: "#334155" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{value}</p>
      </div>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
    </div>
  );
}
