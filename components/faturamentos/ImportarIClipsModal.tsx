"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Loader2, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  parseIClipsXlsx, normalizeName,
  type IClipsProposta, type OrcamentoGrupo, type MidiaGrupo,
} from "@/lib/iclips/parser";

// ── Document templates ────────────────────────────────────────────────────────

const DOCS_MIDIA = [
  { tipo: "nf",          label: "Nota Fiscal" },
  { tipo: "pi",          label: "PI – Pedido de Inserção" },
  { tipo: "comprovacao", label: "Comprovação de Veiculação" },
  { tipo: "tabela_orcamento", label: "Tabela de Preços / Orçamento" },
];
const DOCS_PRODUCAO = [
  { tipo: "nf",          label: "Nota Fiscal" },
  { tipo: "evidencia",   label: "Evidência de Produção" },
  { tipo: "orcamento_1", label: "Orçamento 1" },
  { tipo: "orcamento_2", label: "Orçamento 2" },
  { tipo: "orcamento_3", label: "Orçamento 3" },
];

const ETAPAS_NOMES = [
  "Iniciar Faturamento", "Documentação Fornecedores", "Revisão de Documentação",
  "Documentação Agência", "Revisão do Processo", "Publicação",
  "Aguardando Validação", "Conclusão",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type DbCliente    = { id: string; nome: string; tipo: string };
type DbFornecedor = { id: string; razao_social: string; tipo: string };

type MatchedFornecedor = (OrcamentoGrupo | MidiaGrupo) & {
  fornecedor_id: string | null;   // null = não encontrado
  kind: "orcamento" | "midia";
  honorarios_editavel: number;
  valor_total_editavel: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchName(target: string, candidates: DbFornecedor[]): DbFornecedor | null {
  const t = normalizeName(target);
  return candidates.find((c) => normalizeName(c.razao_social) === t) ?? null;
}

function matchCliente(nome: string, clientes: DbCliente[]): DbCliente | null {
  const t = normalizeName(nome);
  return clientes.find((c) => normalizeName(c.nome) === t) ?? null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, count, total, children, defaultOpen = false,
}: {
  title: string; count: number; total?: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4" style={{ color: "#94A3B8" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "#94A3B8" }} />}
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E2E8F0", color: "#64748B" }}>{count}</span>
        </div>
        {total !== undefined && (
          <span className="text-sm font-bold" style={{ color: "#0F172A" }}>{formatCurrency(total)}</span>
        )}
      </button>
      {open && <div className="border-t" style={{ borderColor: "#E2E8F0" }}>{children}</div>}
    </div>
  );
}

function AlertaBloqueio({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 text-xs" style={{ backgroundColor: "#FFFBEB", borderBottom: "1px solid #FEF3C7" }}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#D97706" }} />
      <span style={{ color: "#92400E" }}>{text}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ImportarIClipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Steps: 0=upload, 1=preview, 2=creating
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState("");

  // Parsed data
  const [proposta, setProposta] = useState<IClipsProposta | null>(null);

  // DB data for matching
  const [clienteMatch, setClienteMatch] = useState<DbCliente | null | "loading">("loading");
  const [fornecedoresMatch, setFornecedoresMatch] = useState<MatchedFornecedor[]>([]);

  // Per-faturamento fields
  const [prazo, setPrazo] = useState("5");
  const [secretaria, setSecretaria] = useState("");
  const [empenho, setEmpenho] = useState("");

  // Creating state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function resetAndClose() {
    setStep(0);
    setFileName("");
    setParseError("");
    setProposta(null);
    setClienteMatch("loading");
    setFornecedoresMatch([]);
    setCreating(false);
    setCreateError("");
    onClose();
  }

  // ── File processing ────────────────────────────────────────────────────────

  async function processFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      setParseError("Selecione um arquivo .xlsx exportado do iClips.");
      return;
    }
    setParseError("");

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseIClipsXlsx(buffer);
      setProposta(parsed);

      // Load DB data for matching
      const supabase = createClient();
      const [{ data: clientes }, { data: fornecedores }] = await Promise.all([
        supabase.from("clientes").select("id, nome, tipo").eq("ativo", true),
        supabase.from("fornecedores").select("id, razao_social, tipo").eq("ativo", true),
      ]);

      const dbClientes    = (clientes    ?? []) as DbCliente[];
      const dbFornecedores = (fornecedores ?? []) as DbFornecedor[];

      // Match cliente
      const cm = matchCliente(parsed.dados_gerais.cliente_nome, dbClientes);
      setClienteMatch(cm);

      // Match orcamentos
      const orcMatched: MatchedFornecedor[] = parsed.orcamentos.map((orc) => {
        const match = matchName(orc.nome_fornecedor, dbFornecedores);
        return {
          ...orc,
          kind: "orcamento",
          fornecedor_id: match?.id ?? null,
          honorarios_editavel: orc.honorarios,
          valor_total_editavel: orc.valor_total,
        };
      });

      // Match mídias
      const midMatched: MatchedFornecedor[] = parsed.midias.map((mid) => {
        const match = matchName((mid as MidiaGrupo).nome_veiculo, dbFornecedores);
        return {
          ...mid,
          kind: "midia",
          fornecedor_id: match?.id ?? null,
          honorarios_editavel: mid.honorarios,
          valor_total_editavel: mid.valor_total,
        };
      });

      setFornecedoresMatch([...orcMatched, ...midMatched]);
      setStep(1);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erro ao ler o arquivo.");
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  // ── Honorários editing ─────────────────────────────────────────────────────

  function updateHonorarios(idx: number, raw: string) {
    const hon = parseFloat(raw.replace(",", ".")) || 0;
    setFornecedoresMatch((prev) => prev.map((f, i) => {
      if (i !== idx) return f;
      return { ...f, honorarios_editavel: hon, valor_total_editavel: Math.round((f.valor + hon) * 100) / 100 };
    }));
  }

  // ── Create faturamento ─────────────────────────────────────────────────────

  async function handleCreate() {
    if (!proposta || !clienteMatch || clienteMatch === "loading") return;
    setCreating(true);
    setCreateError("");
    setStep(2);

    const supabase = createClient();

    // 1. Faturamento
    const totalFornecedores = fornecedoresMatch
      .filter((f) => f.fornecedor_id)
      .reduce((s, f) => s + f.valor_total_editavel, 0);
    const totalCustosInternos = proposta.custos_internos
      .reduce((s, c) => s + c.valor_total, 0);

    const { data: fat, error: fatErr } = await supabase
      .from("faturamentos")
      .insert({
        nome_campanha:    proposta.dados_gerais.nome_campanha,
        iclips_job_id:    `#${proposta.dados_gerais.job_id}`,
        iclips_proposta_id: proposta.dados_gerais.proposta_id,
        cliente_id:       clienteMatch.id,
        cliente_nome:     clienteMatch.nome,
        cliente_tipo:     clienteMatch.tipo,
        secretaria:       secretaria || null,
        empenho:          empenho || null,
        valor_total:      Math.round((totalFornecedores + totalCustosInternos) * 100) / 100,
        prazo_dias_uteis: parseInt(prazo) || 5,
        status:           "aguardando_inicio",
        etapa_atual:      1,
      })
      .select()
      .single();

    if (fatErr || !fat) {
      setCreateError("Erro ao criar faturamento. Tente novamente.");
      setCreating(false);
      setStep(1);
      return;
    }

    // 2. Etapas
    await supabase.from("faturamento_etapas").insert(
      ETAPAS_NOMES.map((nome, i) => ({
        faturamento_id: fat.id, numero: i + 1, nome,
        status: i === 0 ? "em_andamento" : "pendente",
        iniciada_em: i === 0 ? new Date().toISOString() : null,
      }))
    );

    // 3. Custos internos
    if (proposta.custos_internos.length > 0) {
      await supabase.from("faturamento_custos_internos").insert(
        proposta.custos_internos.map((ci) => ({
          faturamento_id: fat.id,
          codigo:         ci.codigo,
          servico:        ci.servico || ci.descricao,
          qtde:           ci.qtde,
          valor_unitario: ci.valor_unitario,
          valor_total:    ci.valor_total,
        }))
      );
    }

    // 4. Fornecedores (apenas os que tiveram match)
    const matched = fornecedoresMatch.filter((f) => f.fornecedor_id);
    for (const f of matched) {
      const { data: ff } = await supabase
        .from("faturamento_fornecedores")
        .insert({
          faturamento_id: fat.id,
          fornecedor_id:  f.fornecedor_id,
          valor:          f.valor,
          honorarios:     f.honorarios_editavel,
          valor_total:    f.valor_total_editavel,
          prazo_dias:     parseInt(prazo) || 5,
          status:         "aguardando",
        })
        .select()
        .single();

      if (!ff) continue;

      // Documentos por tipo
      const docs = f.kind === "midia" ? DOCS_MIDIA : DOCS_PRODUCAO;
      await supabase.from("documentos").insert(
        docs.map((d) => ({
          faturamento_fornecedor_id: ff.id,
          tipo: d.tipo, label: d.label, status: "pendente",
        }))
      );
    }

    router.push(`/faturamentos/${fat.id}`);
    router.refresh();
    resetAndClose();
  }

  // ── Derived data for preview ───────────────────────────────────────────────

  const orcamentosMatched = fornecedoresMatch.filter((f) => f.kind === "orcamento");
  const midiasMatched     = fornecedoresMatch.filter((f) => f.kind === "midia");
  const naoEncontrados    = fornecedoresMatch.filter((f) => !f.fornecedor_id);
  const totalOrc          = orcamentosMatched.reduce((s, f) => s + f.valor_total_editavel, 0);
  const totalMid          = midiasMatched.reduce((s, f) => s + f.valor_total_editavel, 0);
  const totalCI           = proposta?.custos_internos.reduce((s, c) => s + c.valor_total, 0) ?? 0;

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "100%", maxWidth: "720px", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Importar do iClips</h2>
            {step === 1 && proposta && (
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Proposta #{proposta.dados_gerais.proposta_id} · Job #{proposta.dados_gerais.job_id}
              </p>
            )}
          </div>
          <button onClick={resetAndClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: "#64748B" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── Step 0: Upload ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-16 cursor-pointer transition-colors"
                style={{
                  borderColor: dragging ? "#2E60FF" : "#CBD5E1",
                  backgroundColor: dragging ? "#EEF2FF" : "#F8FAFC",
                }}
              >
                <FileSpreadsheet className="w-12 h-12 mb-3" style={{ color: dragging ? "#2E60FF" : "#94A3B8" }} />
                <p className="text-sm font-semibold mb-1" style={{ color: "#334155" }}>
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  Arquivo .xlsx exportado do iClips (Proposta)
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                />
              </div>

              {parseError && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: "#FEF2F2" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#EF4444" }} />
                  <p className="text-sm" style={{ color: "#991B1B" }}>{parseError}</p>
                </div>
              )}

              <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#64748B" }}>Como exportar do iClips:</p>
                <ol className="text-xs space-y-1" style={{ color: "#94A3B8" }}>
                  <li>1. Acesse o job no iClips e abra a Proposta aprovada</li>
                  <li>2. Clique em <strong>Exportar → Excel (.xlsx)</strong></li>
                  <li>3. Faça o upload do arquivo aqui</li>
                </ol>
              </div>
            </div>
          )}

          {/* ── Step 1: Preview ────────────────────────────────────────────── */}
          {step === 1 && proposta && (
            <div className="p-6 space-y-4">

              {/* Faturamento info */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: "#94A3B8" }}>
                      #{proposta.dados_gerais.job_id} · Proposta {proposta.dados_gerais.proposta_id}
                    </p>
                    <p className="text-base font-bold" style={{ color: "#0F172A" }}>
                      {proposta.dados_gerais.nome_campanha}
                    </p>

                    {/* Cliente status */}
                    {clienteMatch && clienteMatch !== "loading" ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                        <span className="text-sm" style={{ color: "#059669" }}>{clienteMatch.nome}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                        <span className="text-sm font-medium" style={{ color: "#D97706" }}>
                          Cliente &quot;{proposta.dados_gerais.cliente_nome}&quot; não encontrado — cadastre antes de importar
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary totals */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold" style={{ color: "#0F172A" }}>
                      {formatCurrency(totalCI + totalOrc + totalMid)}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>total estimado</p>
                  </div>
                </div>

                {/* Campos editáveis do faturamento */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Empenho</label>
                    <input
                      type="text"
                      value={empenho}
                      onChange={(e) => setEmpenho(e.target.value)}
                      placeholder="2026NE00913"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                      style={{ borderColor: "#E2E8F0", color: "#334155" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Secretaria / Emissor</label>
                    <input
                      type="text"
                      value={secretaria}
                      onChange={(e) => setSecretaria(e.target.value)}
                      placeholder="DETRAN ALAGOAS"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                      style={{ borderColor: "#E2E8F0", color: "#334155" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>Prazo (dias úteis)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                      style={{ borderColor: "#E2E8F0", color: "#334155" }}
                    />
                  </div>
                </div>
              </div>

              {/* Alertas de não encontrados */}
              {naoEncontrados.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#FEF3C7" }}>
                  <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "#FFFBEB" }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#D97706" }} />
                    <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
                      {naoEncontrados.length} fornecedor(es) não encontrado(s) no cadastro
                    </p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#FEF3C7" }}>
                    {naoEncontrados.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "#FFFBEB" }}>
                        <div>
                          <p className="text-xs font-medium" style={{ color: "#92400E" }}>
                            {"nome_fornecedor" in f ? f.nome_fornecedor : (f as MidiaGrupo).nome_veiculo}
                          </p>
                          <p className="text-xs" style={{ color: "#D97706" }}>
                            {f.kind === "midia" ? "Veículo de Mídia" : "Produção"} · não será criado automaticamente
                          </p>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: "#92400E" }}>
                          {formatCurrency(f.valor_total_editavel)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 text-xs" style={{ backgroundColor: "#FEF9EE", color: "#92400E" }}>
                    Adicione esses fornecedores no cadastro e depois adicione-os manualmente ao faturamento.
                  </div>
                </div>
              )}

              {/* Custos Internos */}
              <Section
                title="Custos Internos da Agência"
                count={proposta.custos_internos.length}
                total={totalCI}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Item</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Qtde</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#94A3B8" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposta.custos_internos.map((ci, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td className="px-4 py-2" style={{ color: "#334155" }}>
                          <p className="font-medium">{ci.descricao.split(" - ").pop()}</p>
                          <p className="text-xs" style={{ color: "#94A3B8" }}>{ci.servico.substring(0, 80)}</p>
                        </td>
                        <td className="px-4 py-2 text-right" style={{ color: "#64748B" }}>{ci.qtde}</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "#0F172A" }}>
                          {formatCurrency(ci.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Orçamentos (Produção) */}
              {orcamentosMatched.length > 0 && (
                <Section title="Fornecedores de Produção" count={orcamentosMatched.length} total={totalOrc}>
                  {orcamentosMatched.map((f, i) => {
                    const globalIdx = fornecedoresMatch.indexOf(f);
                    const nome = "nome_fornecedor" in f ? f.nome_fornecedor : "";
                    return (
                      <div key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        {!f.fornecedor_id && (
                          <AlertaBloqueio text={`"${nome}" não encontrado — será ignorado`} />
                        )}
                        <div className="px-4 py-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {f.fornecedor_id
                                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
                                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />
                              }
                              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{nome}</p>
                            </div>
                            <p className="text-xs" style={{ color: "#94A3B8" }}>
                              {("itens" in f ? f.itens : []).slice(0, 2).join(" · ")}
                              {("itens" in f ? f.itens : []).length > 2 && ` +${("itens" in f ? f.itens : []).length - 2} itens`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>
                              {formatCurrency(f.valor_total_editavel)}
                            </p>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-xs" style={{ color: "#94A3B8" }}>hon.</span>
                              <input
                                type="number"
                                step="0.01"
                                value={f.honorarios_editavel}
                                onChange={(e) => updateHonorarios(globalIdx, e.target.value)}
                                className="text-xs text-right rounded border px-1.5 py-0.5 w-24 outline-none"
                                style={{ borderColor: "#E2E8F0", color: "#334155" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Mídias */}
              {midiasMatched.length > 0 && (
                <Section title="Veículos de Mídia" count={midiasMatched.length} total={totalMid}>
                  {midiasMatched.map((f, i) => {
                    const globalIdx = fornecedoresMatch.indexOf(f);
                    const nome = "nome_veiculo" in f ? (f as MidiaGrupo).nome_veiculo : "";
                    const tipo = "tipo_midia" in f ? (f as MidiaGrupo).tipo_midia : "";
                    return (
                      <div key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        {!f.fornecedor_id && (
                          <AlertaBloqueio text={`"${nome}" não encontrado — será ignorado`} />
                        )}
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {f.fornecedor_id
                                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
                                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />
                              }
                              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{nome}</p>
                              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
                                {tipo}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>
                              {formatCurrency(f.valor_total_editavel)}
                            </p>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-xs" style={{ color: "#94A3B8" }}>hon. 20%</span>
                              <input
                                type="number"
                                step="0.01"
                                value={f.honorarios_editavel}
                                onChange={(e) => updateHonorarios(globalIdx, e.target.value)}
                                className="text-xs text-right rounded border px-1.5 py-0.5 w-24 outline-none"
                                style={{ borderColor: "#E2E8F0", color: "#334155" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}

              {createError && (
                <p className="text-sm" style={{ color: "#EF4444" }}>{createError}</p>
              )}
            </div>
          )}

          {/* ── Step 2: Creating ───────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#2E60FF" }} />
              <p className="text-sm font-semibold" style={{ color: "#334155" }}>Criando faturamento...</p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Registrando custos internos e fornecedores
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step <= 1 && (
          <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: "#E2E8F0" }}>
            <button
              type="button"
              onClick={step === 0 ? resetAndClose : () => setStep(0)}
              className="px-4 py-2.5 rounded-lg border text-sm font-medium"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}
            >
              {step === 0 ? "Cancelar" : "← Voltar"}
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!clienteMatch || clienteMatch === "loading" || creating}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "#2E60FF",
                  opacity: (!clienteMatch || clienteMatch === "loading") ? 0.5 : 1,
                }}
              >
                <Upload className="w-4 h-4" />
                Criar Faturamento
                {naoEncontrados.length > 0 && (
                  <span className="text-xs opacity-75">
                    ({fornecedoresMatch.filter(f => f.fornecedor_id).length}/{fornecedoresMatch.length} fornecedores)
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
