"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare, Mail, Check, Loader2, ChevronDown, ChevronUp, Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type CadenciaTemplate = {
  id: string;
  step: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  dias_apos_envio: number | null;
  canal_whatsapp: boolean;
  canal_email: boolean;
  mensagem_whatsapp: string | null;
  assunto_email: string | null;
  corpo_email: string | null;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const STEP_ORDER = [
  "link_inicial", "lembrete_1", "lembrete_2", "lembrete_3", "lembrete_4",
  "confirmacao", "divergencia",
];

const STEP_META: Record<string, { emoji: string; badge: string }> = {
  link_inicial: { emoji: "📤", badge: "Dia 0 — imediato" },
  lembrete_1:   { emoji: "🔔", badge: "Dia 2 sem resposta" },
  lembrete_2:   { emoji: "🔔", badge: "Dia 3 sem resposta" },
  lembrete_3:   { emoji: "🔔", badge: "Dia 4 sem resposta" },
  lembrete_4:   { emoji: "🔔", badge: "Dia 5 sem resposta" },
  confirmacao:  { emoji: "✅", badge: "Quando docs preenchidos" },
  divergencia:  { emoji: "⚠️", badge: "Quando doc reprovado" },
};

const VARS_HINT = "{{nome}}, {{empresa}}, {{campanha}}, {{link}}";

// ── TemplateCard ───────────────────────────────────────────────────────────────

function TemplateCard({ template: initial }: { template: CadenciaTemplate }) {
  const [t, setT]             = useState(initial);
  const [expanded, setExp]    = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function upd(field: keyof CadenciaTemplate, value: unknown) {
    setT((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError(null);
    const res = await fetch(`/api/templates/${t.step}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ativo: t.ativo,
        canal_whatsapp: t.canal_whatsapp,
        canal_email: t.canal_email,
        mensagem_whatsapp: t.mensagem_whatsapp,
        assunto_email: t.assunto_email,
        corpo_email: t.corpo_email,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Erro ao salvar"); return; }
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const meta = STEP_META[t.step] ?? { emoji: "📨", badge: "" };

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        borderColor: t.ativo ? "#E2E8F0" : "#CBD5E1",
        backgroundColor: t.ativo ? "white" : "#F8FAFC",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <span className="text-xl flex-shrink-0">{meta.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: "#0F172A" }}>
              {t.nome}
            </h3>
            {meta.badge && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}
              >
                {meta.badge}
              </span>
            )}
            {!t.ativo && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "#F1F5F9", color: "#94A3B8" }}
              >
                Desativado
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "#64748B" }}>
            {t.descricao}
          </p>
        </div>

        {/* Channel pills */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {t.canal_whatsapp && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
            >
              <MessageSquare className="w-3 h-3" />WA
            </span>
          )}
          {t.canal_email && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}
            >
              <Mail className="w-3 h-3" />Email
            </span>
          )}
        </div>

        {/* Active toggle */}
        <button
          onClick={() => upd("ativo", !t.ativo)}
          className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0"
          style={{
            backgroundColor: t.ativo ? "#DCFCE7" : "#F1F5F9",
            color: t.ativo ? "#16A34A" : "#94A3B8",
          }}
        >
          {t.ativo ? "Ativo" : "Inativo"}
        </button>

        {/* Expand */}
        <button
          onClick={() => setExp((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          style={{ color: "#94A3B8" }}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Editor (expanded) */}
      {expanded && (
        <div
          className="border-t px-4 pb-4 space-y-4"
          style={{ borderColor: "#F1F5F9" }}
        >
          {/* Variables hint */}
          <div
            className="flex items-start gap-2 mt-4 p-3 rounded-lg"
            style={{ backgroundColor: "#F8FAFC" }}
          >
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
            <p className="text-xs" style={{ color: "#64748B" }}>
              <strong>Variáveis disponíveis:</strong> {VARS_HINT}
            </p>
          </div>

          {/* Channel toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={t.canal_whatsapp}
                onChange={(e) => upd("canal_whatsapp", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium flex items-center gap-1" style={{ color: "#334155" }}>
                <MessageSquare className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
                WhatsApp
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={t.canal_email}
                onChange={(e) => upd("canal_email", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium flex items-center gap-1" style={{ color: "#334155" }}>
                <Mail className="w-3.5 h-3.5" style={{ color: "#2E60FF" }} />
                Email
              </span>
            </label>
          </div>

          {/* WhatsApp template */}
          {t.canal_whatsapp && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#334155" }}>
                Mensagem WhatsApp
                <span className="ml-1 font-normal" style={{ color: "#94A3B8" }}>
                  (use *negrito* e variáveis acima)
                </span>
              </label>
              <textarea
                value={t.mensagem_whatsapp ?? ""}
                onChange={(e) => upd("mensagem_whatsapp", e.target.value)}
                rows={7}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none font-mono resize-y"
                style={{ borderColor: "#E2E8F0", color: "#334155" }}
                placeholder={"Olá, *{{nome}}*!\n\nAcesse: {{link}}"}
              />
            </div>
          )}

          {/* Email template */}
          {t.canal_email && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#334155" }}>
                  Assunto do Email
                </label>
                <input
                  type="text"
                  value={t.assunto_email ?? ""}
                  onChange={(e) => upd("assunto_email", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{ borderColor: "#E2E8F0", color: "#334155" }}
                  placeholder="[Disrupy] Documentos — {{campanha}}"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#334155" }}>
                  Corpo do Email
                  <span className="ml-1 font-normal" style={{ color: "#94A3B8" }}>
                    (HTML suportado)
                  </span>
                </label>
                <textarea
                  value={t.corpo_email ?? ""}
                  onChange={(e) => upd("corpo_email", e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none font-mono resize-y"
                  style={{ borderColor: "#E2E8F0", color: "#334155" }}
                  placeholder={"<p>Olá, <strong>{{nome}}</strong>!</p>\n<p>Acesse: <a href=\"{{link}}\">Portal</a></p>"}
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs" style={{ color: "#DC2626" }}>⚠ {error}</p>
          )}

          {/* Save button */}
          {dirty && (
            <div className="flex justify-end pt-1">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium text-white transition-colors"
                style={{
                  backgroundColor: saved ? "#059669" : saving ? "#94A3B8" : "#2E60FF",
                  opacity: saving ? 0.75 : 1,
                }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar template"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function TemplatesConfig() {
  const [templates, setTemplates] = useState<CadenciaTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        const sorted = ((d.templates ?? []) as CadenciaTemplate[]).sort(
          (a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step),
        );
        setTemplates(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#94A3B8" }} />
        <span className="text-sm" style={{ color: "#94A3B8" }}>Carregando templates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl" style={{ backgroundColor: "#FEF2F2" }}>
        <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>
        <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
          Verifique se rodou a migração SQL no Supabase.
        </p>
      </div>
    );
  }

  const cadencia = templates.filter((t) =>
    ["link_inicial", "lembrete_1", "lembrete_2", "lembrete_3", "lembrete_4"].includes(t.step),
  );
  const eventos = templates.filter((t) =>
    ["confirmacao", "divergencia"].includes(t.step),
  );

  return (
    <div className="space-y-8">
      {/* Cadence steps */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            Cadência automática
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            Enviados automaticamente pelo sistema baseado em dias sem resposta.
          </p>
        </div>
        <div className="space-y-3">
          {cadencia.map((t) => (
            <TemplateCard key={t.step} template={t} />
          ))}
        </div>
      </section>

      {/* Event-based */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            Mensagens por evento
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            Disparadas automaticamente quando eventos específicos ocorrem.
          </p>
        </div>
        <div className="space-y-3">
          {eventos.map((t) => (
            <TemplateCard key={t.step} template={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
