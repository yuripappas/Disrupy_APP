"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Loader2, X, Search, UserPlus, Link2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  parseIClipsXlsx, normalizeName,
  type IClipsProposta, type OrcamentoGrupo, type MidiaGrupo,
} from "@/lib/iclips/parser";

// ── Helpers ───────────────────────────────────────────────────────────────────

// "Produto/Serviço" do iClips tem formato "PRODUTO - Formato - NOME_PEÇA - TRANSFERÊNCIA DIGITAL"
// O sufixo "TRANSFERÊNCIA DIGITAL" é o canal de mídia, não o produto — deve ser ignorado.
function produtoTitulo(descricao: string): string {
  const IGNORAR = ["TRANSFERÊNCIA DIGITAL", "TRANSFERENCIA DIGITAL"];
  const partes = descricao.split(" - ").map((p) => p.trim());
  const relevantes = partes.filter((p) => !IGNORAR.includes(p.toUpperCase()));
  const lista = relevantes.length > 0 ? relevantes : partes;
  return lista[lista.length - 1];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCS_MIDIA = [
  { tipo: "nf", label: "Nota Fiscal" },
  { tipo: "pi", label: "PI – Pedido de Inserção" },
  { tipo: "comprovacao", label: "Comprovação de Veiculação" },
  { tipo: "tabela_orcamento", label: "Tabela de Preços / Orçamento" },
];
const DOCS_PRODUCAO = [
  { tipo: "nf", label: "Nota Fiscal" },
  { tipo: "evidencia", label: "Evidência de Produção" },
  { tipo: "orcamento_1", label: "Orçamento 1" },
  { tipo: "orcamento_2", label: "Orçamento 2" },
  { tipo: "orcamento_3", label: "Orçamento 3" },
];
const ETAPAS_NOMES = [
  "Enviar Faturamento",
  "Documentação Fornecedores",
  "Documentação Agência",
  "Revisão do Processo",
  "Publicação",
  "Concluído",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type DbCliente    = { id: string; nome: string; tipo: string };
type DbFornecedor = { id: string; razao_social: string; tipo: string };

type MatchedFornecedor = (OrcamentoGrupo | MidiaGrupo) & {
  fornecedor_id: string | null;
  kind: "orcamento" | "midia";
  honorarios_editavel: number;
  valor_total_editavel: number;
};

type Resolucao = { modo: "associar" | "criando"; busca: string; loading: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchName(target: string, candidates: DbFornecedor[]): DbFornecedor | null {
  const t = normalizeName(target);
  return candidates.find((c) => normalizeName(c.razao_social) === t) ?? null;
}
function matchCliente(nome: string, clientes: DbCliente[]): DbCliente | null {
  const t = normalizeName(nome);
  return clientes.find((c) => normalizeName(c.nome) === t) ?? null;
}
function getNome(f: MatchedFornecedor): string {
  return "nome_fornecedor" in f
    ? (f as OrcamentoGrupo).nome_fornecedor
    : (f as MidiaGrupo).nome_veiculo;
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

// ── Inline resolution for unmatched suppliers ─────────────────────────────────

function ResolucaoInline({
  dbFornecedores, resolucao,
  onIniciarAssociar, onAssociar, onCriar, onCancelar, onBuscaChange,
}: {
  dbFornecedores: DbFornecedor[];
  resolucao: Resolucao | undefined;
  onIniciarAssociar: () => void;
  onAssociar: (f: DbFornecedor) => void;
  onCriar: () => void;
  onCancelar: () => void;
  onBuscaChange: (v: string) => void;
}) {
  if (!resolucao) {
    // Default: show action buttons
    return (
      <div className="px-4 pb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onIniciarAssociar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-blue-50"
          style={{ borderColor: "#BFDBFE", color: "#1D4ED8", backgroundColor: "#EFF6FF" }}
        >
          <Link2 className="w-3 h-3" /> Associar a existente
        </button>
        <button
          type="button"
          onClick={onCriar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-green-50"
          style={{ borderColor: "#BBF7D0", color: "#15803D", backgroundColor: "#F0FDF4" }}
        >
          <UserPlus className="w-3 h-3" /> Criar no cadastro
        </button>
        <span className="text-xs" style={{ color: "#94A3B8" }}>
          ou ignore — adicione manualmente após criar
        </span>
      </div>
    );
  }

  if (resolucao.loading) {
    return (
      <div className="px-4 pb-3 flex items-center gap-2 text-xs" style={{ color: "#64748B" }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando fornecedor...
      </div>
    );
  }

  if (resolucao.modo === "associar") {
    const filtrados = dbFornecedores.filter((f) =>
      !resolucao.busca ||
      normalizeName(f.razao_social).includes(normalizeName(resolucao.busca))
    );
    return (
      <div className="px-4 pb-3 space-y-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "#94A3B8" }} />
          <input
            autoFocus
            type="text"
            value={resolucao.busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar fornecedor no cadastro..."
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none"
            style={{ borderColor: "#2E60FF", color: "#334155" }}
          />
        </div>
        <div
          className="border rounded-lg overflow-y-auto"
          style={{ borderColor: "#E2E8F0", maxHeight: "160px" }}
        >
          {filtrados.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "#94A3B8" }}>Nenhum resultado</p>
          ) : (
            filtrados.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onAssociar(f)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between"
                style={{ borderBottom: "1px solid #F1F5F9" }}
              >
                <span className="font-medium" style={{ color: "#0F172A" }}>{f.razao_social}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                  style={{
                    backgroundColor: f.tipo === "midia" ? "#EEF2FF" : "#F5F3FF",
                    color: f.tipo === "midia" ? "#00246D" : "#7C3AED",
                  }}
                >
                  {f.tipo === "midia" ? "Mídia" : "Produção"}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs"
          style={{ color: "#94A3B8" }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ImportarIClipsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState("");

  const [proposta, setProposta] = useState<IClipsProposta | null>(null);
  const [clienteMatch, setClienteMatch] = useState<DbCliente | null | "loading">("loading");
  const [fornecedoresMatch, setFornecedoresMatch] = useState<MatchedFornecedor[]>([]);
  const [dbFornecedores, setDbFornecedores] = useState<DbFornecedor[]>([]);
  const [resolucoes, setResolucoes] = useState<Record<number, Resolucao>>({});

  const [prazo, setPrazo] = useState("5");
  const [secretaria, setSecretaria] = useState("");
  const [empenho, setEmpenho] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function resetAndClose() {
    setStep(0);
    setParseError("");
    setProposta(null);
    setClienteMatch("loading");
    setFornecedoresMatch([]);
    setDbFornecedores([]);
    setResolucoes({});
    setCreating(false);
    setCreateError("");
    setPrazo("5");
    setSecretaria("");
    setEmpenho("");
    onClose();
  }

  // ── File processing ────────────────────────────────────────────────────────

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setParseError(`Selecione um arquivo .xlsx exportado do iClips. Arquivo recebido: "${file.name}"`);
      return;
    }
    setParseError("");
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseIClipsXlsx(buffer);
      setProposta(parsed);

      const supabase = createClient();
      const [{ data: clientes }, { data: fornecedores }] = await Promise.all([
        supabase.from("clientes").select("id, nome, tipo").eq("ativo", true),
        supabase.from("fornecedores").select("id, razao_social, tipo").eq("ativo", true),
      ]);

      const dbCli = (clientes ?? []) as DbCliente[];
      const dbForn = (fornecedores ?? []) as DbFornecedor[];
      setDbFornecedores(dbForn);

      setClienteMatch(matchCliente(parsed.dados_gerais.cliente_nome, dbCli));

      const orcMatched: MatchedFornecedor[] = parsed.orcamentos.map((orc) => {
        const m = matchName(orc.nome_fornecedor, dbForn);
        return { ...orc, kind: "orcamento", fornecedor_id: m?.id ?? null, honorarios_editavel: orc.honorarios, valor_total_editavel: orc.valor_total };
      });
      const midMatched: MatchedFornecedor[] = parsed.midias.map((mid) => {
        const m = matchName((mid as MidiaGrupo).nome_veiculo, dbForn);
        return { ...mid, kind: "midia", fornecedor_id: m?.id ?? null, honorarios_editavel: mid.honorarios, valor_total_editavel: mid.valor_total };
      });

      setFornecedoresMatch([...orcMatched, ...midMatched]);
      setStep(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao ler o arquivo.";
      console.error("[ImportarIClips] Erro ao processar arquivo:", e);
      setParseError(msg);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  // ── Honorários editing ─────────────────────────────────────────────────────

  function updateHonorarios(idx: number, raw: string) {
    const hon = parseFloat(raw.replace(",", ".")) || 0;
    setFornecedoresMatch((prev) => prev.map((f, i) =>
      i !== idx ? f : { ...f, honorarios_editavel: hon, valor_total_editavel: Math.round((f.valor + hon) * 100) / 100 }
    ));
  }

  // ── Resolução de não encontrados ───────────────────────────────────────────

  function iniciarAssociar(idx: number) {
    setResolucoes((prev) => ({ ...prev, [idx]: { modo: "associar", busca: "", loading: false } }));
  }

  function cancelarResolucao(idx: number) {
    setResolucoes((prev) => { const n = { ...prev }; delete n[idx]; return n; });
  }

  function setBusca(idx: number, busca: string) {
    setResolucoes((prev) => ({ ...prev, [idx]: { ...prev[idx], busca } }));
  }

  function handleAssociar(idx: number, fornecedor: DbFornecedor) {
    setFornecedoresMatch((prev) => prev.map((f, i) => i === idx ? { ...f, fornecedor_id: fornecedor.id } : f));
    cancelarResolucao(idx);
  }

  async function handleCriarNovo(idx: number) {
    const f = fornecedoresMatch[idx];
    if (!f) return;
    const nome = getNome(f);
    const tipo = f.kind === "midia" ? "midia" : "producao";

    setResolucoes((prev) => ({ ...prev, [idx]: { modo: "criando", busca: "", loading: true } }));

    const supabase = createClient();
    const { data, error } = await supabase
      .from("fornecedores")
      .insert({ razao_social: nome.toUpperCase(), tipo, ativo: true })
      .select()
      .single();

    if (error || !data) {
      cancelarResolucao(idx);
      return;
    }

    const novoForn = data as DbFornecedor;
    setDbFornecedores((prev) => [...prev, novoForn]);
    setFornecedoresMatch((prev) => prev.map((f2, i) => i === idx ? { ...f2, fornecedor_id: novoForn.id } : f2));
    cancelarResolucao(idx);
  }

  // ── Create faturamento ─────────────────────────────────────────────────────

  async function handleCreate() {
    if (!proposta || !clienteMatch || clienteMatch === "loading") return;
    setCreating(true);
    setCreateError("");
    setStep(2);

    const supabase = createClient();
    // Inclui todos — matched e unmatched — no valor total
    const totalForn = fornecedoresMatch.reduce((s, f) => s + f.valor_total_editavel, 0);
    const totalCI   = proposta.custos_internos.reduce((s, c) => s + c.valor_total, 0);

    const { data: fat, error: fatErr } = await supabase
      .from("faturamentos")
      .insert({
        nome_campanha:      proposta.dados_gerais.nome_campanha,
        iclips_job_id:      `#${proposta.dados_gerais.job_id}`,
        iclips_proposta_id: proposta.dados_gerais.proposta_id,
        cliente_id:         clienteMatch.id,
        cliente_nome:       clienteMatch.nome,
        cliente_tipo:       clienteMatch.tipo,
        secretaria:         secretaria || null,
        empenho:            empenho || null,
        valor_total:        Math.round((totalForn + totalCI) * 100) / 100,
        prazo_dias_uteis:   parseInt(prazo) || 5,
        status:             "aguardando_inicio",
        etapa_atual:        1,
      })
      .select().single();

    if (fatErr || !fat) {
      setCreateError("Erro ao criar faturamento.");
      setCreating(false);
      setStep(1);
      return;
    }

    await supabase.from("faturamento_etapas").insert(
      ETAPAS_NOMES.map((nome, i) => ({
        faturamento_id: fat.id, numero: i + 1, nome,
        status: i === 0 ? "em_andamento" : "pendente",
        iniciada_em: i === 0 ? new Date().toISOString() : null,
      }))
    );

    if (proposta.custos_internos.length > 0) {
      await supabase.from("faturamento_custos_internos").insert(
        proposta.custos_internos.map((ci) => ({
          faturamento_id: fat.id, codigo: ci.codigo,
          servico: ci.servico || ci.descricao, qtde: ci.qtde,
          valor_unitario: ci.valor_unitario, valor_total: ci.valor_total,
        }))
      );
    }

    // Salva TODOS os fornecedores — matched e unmatched
    // Unmatched ficam com fornecedor_id null, associado false, nome_iclips preenchido
    for (const f of fornecedoresMatch) {
      const nomeIclips = getNome(f);
      const tipoIclips = f.kind === "midia" ? "midia" : "producao";
      const { data: ff } = await supabase.from("faturamento_fornecedores").insert({
        faturamento_id: fat.id,
        fornecedor_id: f.fornecedor_id ?? null,
        nome_iclips: !f.fornecedor_id ? nomeIclips : null,
        associado: !!f.fornecedor_id,
        tipo_iclips: tipoIclips,
        valor: f.valor, honorarios: f.honorarios_editavel, valor_total: f.valor_total_editavel,
        prazo_dias: parseInt(prazo) || 5, status: "aguardando",
        numero_os_pi: f.kind === "midia" ? ((f as MidiaGrupo).codigo ?? null) : null,
      }).select().single();
      if (!ff) continue;
      const docs = f.kind === "midia" ? DOCS_MIDIA : DOCS_PRODUCAO;
      await supabase.from("documentos").insert(
        docs.map((d) => ({ faturamento_fornecedor_id: ff.id, tipo: d.tipo, label: d.label, status: "pendente" }))
      );
    }

    // Cria estrutura de pastas no Google Drive em background
    fetch("/api/drive/criar-pasta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faturamentoId: fat.id }),
    }).catch((e) => console.warn("[drive/criar-pasta] background error:", e));

    router.push(`/faturamentos/${fat.id}`);
    router.refresh();
    resetAndClose();
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const orcamentosMatch = fornecedoresMatch.filter((f) => f.kind === "orcamento");
  const midiasMatch     = fornecedoresMatch.filter((f) => f.kind === "midia");
  const naoResolvidos   = fornecedoresMatch.filter((f) => !f.fornecedor_id);
  const totalOrc        = orcamentosMatch.reduce((s, f) => s + f.valor_total_editavel, 0);
  const totalMid        = midiasMatch.reduce((s, f) => s + f.valor_total_editavel, 0);
  const totalCI         = proposta?.custos_internos.reduce((s, c) => s + c.valor_total, 0) ?? 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: "100%", maxWidth: "720px", maxHeight: "90vh" }}>

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
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
                onDragLeave={(e) => { e.stopPropagation(); setDragging(false); }}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 cursor-pointer transition-colors"
                style={{ borderColor: dragging ? "#2E60FF" : parseError ? "#EF4444" : "#CBD5E1", backgroundColor: dragging ? "#EEF2FF" : parseError ? "#FEF2F2" : "#F8FAFC" }}
              >
                {parseError ? (
                  <>
                    <AlertTriangle className="w-10 h-10 mb-3" style={{ color: "#EF4444" }} />
                    <p className="text-sm font-semibold mb-1 text-center px-6" style={{ color: "#991B1B" }}>{parseError}</p>
                    <p className="text-xs mt-2" style={{ color: "#EF4444" }}>Clique para tentar outro arquivo</p>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-12 h-12 mb-3" style={{ color: dragging ? "#2E60FF" : "#94A3B8" }} />
                    <p className="text-sm font-semibold mb-1" style={{ color: "#334155" }}>
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>Arquivo .xlsx exportado do iClips (Proposta)</p>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".xlsx,.XLSX" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              </div>
            </div>
          )}

          {/* ── Step 1: Preview ────────────────────────────────────────────── */}
          {step === 1 && proposta && (
            <div className="p-6 space-y-4">

              {/* Header card */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: "#94A3B8" }}>
                      #{proposta.dados_gerais.job_id} · Proposta {proposta.dados_gerais.proposta_id}
                    </p>
                    <p className="text-base font-bold" style={{ color: "#0F172A" }}>{proposta.dados_gerais.nome_campanha}</p>
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
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold" style={{ color: "#0F172A" }}>{formatCurrency(totalCI + totalOrc + totalMid)}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>total estimado</p>
                  </div>
                </div>

                {/* Summary: resolved status */}
                {naoResolvidos.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t text-xs" style={{ borderColor: "#F1F5F9" }}>
                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                    <span style={{ color: "#92400E" }}>
                      <strong>{naoResolvidos.length}</strong> fornecedor(es) ainda não vinculado(s) — serão salvos como pendentes e poderão ser associados depois
                    </span>
                  </div>
                )}
                {naoResolvidos.length === 0 && fornecedoresMatch.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t text-xs" style={{ borderColor: "#F1F5F9" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                    <span style={{ color: "#059669" }}>Todos os fornecedores vinculados</span>
                  </div>
                )}

                {/* Editable fields */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                  {[
                    { label: "Empenho", value: empenho, set: setEmpenho, placeholder: "2026NE00913" },
                    { label: "Secretaria / Emissor", value: secretaria, set: setSecretaria, placeholder: "DETRAN ALAGOAS" },
                    { label: "Prazo (dias úteis)", value: prazo, set: setPrazo, placeholder: "5", type: "number" },
                  ].map(({ label, value, set, placeholder, type }) => (
                    <div key={label}>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#64748B" }}>{label}</label>
                      <input type={type ?? "text"} value={value} onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                        style={{ borderColor: "#E2E8F0", color: "#334155" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Custos Internos */}
              <Section title="Custos Internos da Agência" count={proposta.custos_internos.length} total={totalCI}>
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
                          <p className="font-medium">{produtoTitulo(ci.descricao)}</p>
                          <p className="text-xs" style={{ color: "#94A3B8" }}>{ci.servico.substring(0, 80)}</p>
                        </td>
                        <td className="px-4 py-2 text-right" style={{ color: "#64748B" }}>{ci.qtde}</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "#0F172A" }}>{formatCurrency(ci.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Fornecedores de Produção */}
              {orcamentosMatch.length > 0 && (
                <Section title="Fornecedores de Produção" count={orcamentosMatch.length} total={totalOrc}>
                  {orcamentosMatch.map((f) => {
                    const idx = fornecedoresMatch.indexOf(f);
                    const nome = getNome(f);
                    return (
                      <div key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <div className="px-4 py-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {f.fornecedor_id
                                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
                                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />}
                              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{nome}</p>
                            </div>
                            <p className="text-xs" style={{ color: "#94A3B8" }}>
                              {("itens" in f ? (f as OrcamentoGrupo).itens : []).slice(0, 2).join(" · ")}
                              {("itens" in f ? (f as OrcamentoGrupo).itens : []).length > 2 && ` +${("itens" in f ? (f as OrcamentoGrupo).itens : []).length - 2}`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{formatCurrency(f.valor_total_editavel)}</p>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-xs" style={{ color: "#94A3B8" }}>hon.</span>
                              <input type="number" step="0.01" value={f.honorarios_editavel}
                                onChange={(e) => updateHonorarios(idx, e.target.value)}
                                className="text-xs text-right rounded border px-1.5 py-0.5 w-24 outline-none"
                                style={{ borderColor: "#E2E8F0", color: "#334155" }} />
                            </div>
                          </div>
                        </div>
                        {!f.fornecedor_id && (
                          <ResolucaoInline
                            dbFornecedores={dbFornecedores}
                            resolucao={resolucoes[idx]}
                            onIniciarAssociar={() => iniciarAssociar(idx)}
                            onAssociar={(forn) => handleAssociar(idx, forn)}
                            onCriar={() => handleCriarNovo(idx)}
                            onCancelar={() => cancelarResolucao(idx)}
                            onBuscaChange={(v) => setBusca(idx, v)}
                          />
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Veículos de Mídia */}
              {midiasMatch.length > 0 && (
                <Section title="Veículos de Mídia" count={midiasMatch.length} total={totalMid}>
                  {midiasMatch.map((f) => {
                    const idx = fornecedoresMatch.indexOf(f);
                    const nome = getNome(f);
                    const tipo = "tipo_midia" in f ? (f as MidiaGrupo).tipo_midia : "";
                    return (
                      <div key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {f.fornecedor_id
                                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
                                : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />}
                              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{nome}</p>
                              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>{tipo}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{formatCurrency(f.valor_total_editavel)}</p>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-xs" style={{ color: "#94A3B8" }}>hon. 20%</span>
                              <input type="number" step="0.01" value={f.honorarios_editavel}
                                onChange={(e) => updateHonorarios(idx, e.target.value)}
                                className="text-xs text-right rounded border px-1.5 py-0.5 w-24 outline-none"
                                style={{ borderColor: "#E2E8F0", color: "#334155" }} />
                            </div>
                          </div>
                        </div>
                        {!f.fornecedor_id && (
                          <ResolucaoInline
                            dbFornecedores={dbFornecedores}
                            resolucao={resolucoes[idx]}
                            onIniciarAssociar={() => iniciarAssociar(idx)}
                            onAssociar={(forn) => handleAssociar(idx, forn)}
                            onCriar={() => handleCriarNovo(idx)}
                            onCancelar={() => cancelarResolucao(idx)}
                            onBuscaChange={(v) => setBusca(idx, v)}
                          />
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}

              {createError && <p className="text-sm" style={{ color: "#EF4444" }}>{createError}</p>}
            </div>
          )}

          {/* ── Step 2: Creating ───────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#2E60FF" }} />
              <p className="text-sm font-semibold" style={{ color: "#334155" }}>Criando faturamento...</p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>Registrando custos internos e fornecedores</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step <= 1 && (
          <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: "#E2E8F0" }}>
            <button type="button" onClick={step === 0 ? resetAndClose : () => setStep(0)}
              className="px-4 py-2.5 rounded-lg border text-sm font-medium"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
              {step === 0 ? "Cancelar" : "← Voltar"}
            </button>
            {step === 1 && (
              <button type="button" onClick={handleCreate}
                disabled={!clienteMatch || clienteMatch === "loading" || creating}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: "#2E60FF", opacity: (!clienteMatch || clienteMatch === "loading") ? 0.5 : 1 }}>
                <Upload className="w-4 h-4" />
                Criar Faturamento
                {naoResolvidos.length > 0 && (
                  <span className="text-xs opacity-75">
                    ({fornecedoresMatch.filter((f) => f.fornecedor_id).length}/{fornecedoresMatch.length} vinculados)
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
