"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  GripVertical, CheckCircle, XCircle, Clock, FileText,
  Building2, Tv, Wrench,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocStatus = "aprovado" | "reprovado" | "pendente" | "enviado";

interface DocSummary {
  label: string;
  status: DocStatus;
}

interface Block {
  id: string;
  tipo: "agencia" | "producao" | "midia";
  titulo: string;
  cnpj?: string | null;
  docs: DocSummary[];
}

interface Certidao {
  id: string;
  tipo: string;
  label: string;
  arquivo_url: string | null;
}

interface FornecedorNf {
  ffId: string;
  razaoSocial: string;
  cnpj: string | null;
  tipo: "midia" | "producao";
  numeroNf: string | null;
  nfStatus: string | null;
}

interface Props {
  faturamentoId: string;
  certidoesIniciais: Certidao[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fornecedores: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custosInternos: any[];
  fornecedoresNf: FornecedorNf[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusDocs(docs: { status: string }[]): DocStatus {
  if (docs.length === 0) return "pendente";
  if (docs.every((d) => d.status === "aprovado")) return "aprovado";
  if (docs.some((d) => d.status === "reprovado")) return "reprovado";
  if (docs.some((d) => d.status === "aprovado" || d.status === "enviado")) return "enviado";
  return "pendente";
}

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = {
    aprovado:  { label: "Aprovado",   bg: "#D1FAE5", color: "#059669", Icon: CheckCircle },
    reprovado: { label: "Reprovado",  bg: "#FEE2E2", color: "#EF4444", Icon: XCircle },
    enviado:   { label: "Parcial",    bg: "#FEF3C7", color: "#D97706", Icon: Clock },
    pendente:  { label: "Pendente",   bg: "#F1F5F9", color: "#94A3B8", Icon: Clock },
  }[status];
  const { label, bg, color, Icon } = cfg;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function RevisaoProcessoSection({
  faturamentoId,
  certidoesIniciais,
  fornecedores,
  custosInternos,
  fornecedoresNf,
}: Props) {
  const storageKey = `revisao_ordem_${faturamentoId}`;

  // Monta os blocos iniciais (agência + cada fornecedor)
  const buildDefaultBlocks = useCallback((): Block[] => {
    // ── Bloco Agência ──────────────────────────────────────────────────────────
    const agenciaDocs: DocSummary[] = [];

    certidoesIniciais.forEach((c) => {
      agenciaDocs.push({
        label: c.label,
        status: c.arquivo_url ? "aprovado" : "pendente",
      });
    });

    // Documentos dos custos internos (peças)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custosInternos.forEach((ci: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ci.custo_interno_documentos ?? []).forEach((d: any) => {
        agenciaDocs.push({ label: `Peça — ${ci.servico}`, status: d.status ?? "pendente" });
      });
    });

    const agencia: Block = {
      id: "__agencia__",
      tipo: "agencia",
      titulo: "Agência",
      docs: agenciaDocs,
    };

    // ── Fornecedores ───────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ffs = (fornecedores as any[]).filter((ff: any) => ff.associado !== false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fornBlocks: Block[] = ffs.map((ff: any): Block => {
      const tipo: "midia" | "producao" = ff.fornecedor?.tipo ?? ff.tipo_iclips ?? "producao";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs: DocSummary[] = (ff.documentos ?? []).map((d: any) => ({
        label: d.label ?? d.tipo ?? "Documento",
        status: d.status ?? "pendente",
      }));
      return {
        id: ff.id,
        tipo,
        titulo: ff.fornecedor?.razao_social ?? ff.nome_iclips ?? "Fornecedor",
        cnpj: ff.fornecedor?.cnpj ?? null,
        docs,
      };
    });

    // Ordena: produção primeiro, depois mídia, alfabético dentro
    fornBlocks.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "producao" ? -1 : 1;
      return a.titulo.localeCompare(b.titulo);
    });

    return [agencia, ...fornBlocks];
  }, [certidoesIniciais, custosInternos, fornecedores, fornecedoresNf]);

  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        const defaults = buildDefaultBlocks();
        const byId = Object.fromEntries(defaults.map((b) => [b.id, b]));
        const ordered = ids.map((id) => byId[id]).filter(Boolean);
        const remaining = defaults.filter((b) => !ids.includes(b.id));
        return [...ordered, ...remaining];
      }
    } catch { /* ignore */ }
    return buildDefaultBlocks();
  });

  // Reconstrói se os dados mudarem (ex: router.refresh)
  useEffect(() => {
    setBlocks((prev) => {
      const fresh = buildDefaultBlocks();
      const freshById = Object.fromEntries(fresh.map((b) => [b.id, b]));
      // Mantém a ordem atual, atualiza conteúdo (docs/status)
      const updated = prev.map((b) => freshById[b.id] ?? b);
      const remaining = fresh.filter((b) => !prev.some((p) => p.id === b.id));
      return [...updated, ...remaining];
    });
  }, [buildDefaultBlocks]);

  function saveOrder(ordered: Block[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(ordered.map((b) => b.id)));
    } catch { /* ignore */ }
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const dragIdx = useRef<number | null>(null);
  const overIdx = useRef<number | null>(null);

  function onDragStart(i: number) {
    dragIdx.current = i;
  }

  function onDragEnter(i: number) {
    overIdx.current = i;
    if (dragIdx.current === null || dragIdx.current === i) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx.current!, 1);
      next.splice(i, 0, item);
      dragIdx.current = i;
      return next;
    });
  }

  function onDragEnd() {
    setBlocks((prev) => { saveOrder(prev); return prev; });
    dragIdx.current = null;
    overIdx.current = null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const total = blocks.reduce((s, b) => s + b.docs.length, 0);
  const aprovados = blocks.reduce(
    (s, b) => s + b.docs.filter((d) => d.status === "aprovado").length, 0,
  );

  return (
    <div>
      {/* Header */}
      <div
        className="flex items-start gap-3 px-5 py-3.5 rounded-xl mb-5"
        style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE" }}
      >
        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2E60FF" }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "#1E40AF" }}>
            Etapa 4 — Revisão do Processo
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#3730A3" }}>
            Revise a ordem dos blocos de documentação. Arraste para reorganizar. A ordem definida aqui será usada na geração do PDF.
          </p>
        </div>
      </div>

      {/* Progresso geral */}
      <div className="flex items-center gap-4 mb-5 px-1">
        <span className="text-xs" style={{ color: "#64748B" }}>
          Documentos aprovados:
        </span>
        <span className="text-xs font-semibold" style={{ color: aprovados === total && total > 0 ? "#059669" : "#0F172A" }}>
          {aprovados} / {total}
        </span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: total > 0 ? `${(aprovados / total) * 100}%` : "0%",
              backgroundColor: aprovados === total && total > 0 ? "#10B981" : "#2E60FF",
            }}
          />
        </div>
      </div>

      {/* Lista de blocos (draggable) */}
      <div className="space-y-2">
        {blocks.map((block, i) => {
          const overallStatus = statusDocs(block.docs);
          const TipoIcon =
            block.tipo === "agencia"  ? Building2 :
            block.tipo === "midia"    ? Tv :
            Wrench;
          const tipoLabel =
            block.tipo === "agencia"  ? "Agência" :
            block.tipo === "midia"    ? "Mídia" :
            "Produção";
          const tipoColor =
            block.tipo === "agencia"  ? "#00246D" :
            block.tipo === "midia"    ? "#7C3AED" :
            "#059669";
          const tipoBg =
            block.tipo === "agencia"  ? "#EEF2FF" :
            block.tipo === "midia"    ? "#F5F3FF" :
            "#ECFDF5";

          return (
            <div
              key={block.id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              className="flex items-start gap-3 rounded-xl border bg-white p-4 cursor-grab active:cursor-grabbing select-none"
              style={{
                borderColor: "#E2E8F0",
                opacity: dragIdx.current === i ? 0.5 : 1,
                transition: "opacity 120ms",
              }}
            >
              {/* Posição */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
              >
                {i + 1}
              </div>

              {/* Handle */}
              <GripVertical className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: "#CBD5E1" }} />

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: tipoBg, color: tipoColor }}
                  >
                    <TipoIcon className="w-3 h-3" />
                    {tipoLabel}
                  </span>
                  <span className="font-semibold text-sm truncate" style={{ color: "#0F172A" }}>
                    {block.titulo}
                  </span>
                  {block.cnpj && (
                    <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>
                      {block.cnpj}
                    </span>
                  )}
                </div>

                {block.docs.length === 0 ? (
                  <p className="text-xs" style={{ color: "#94A3B8" }}>Nenhum documento</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {block.docs.map((doc, j) => (
                      <span
                        key={j}
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                          borderColor:
                            doc.status === "aprovado"  ? "#A7F3D0" :
                            doc.status === "reprovado" ? "#FECACA" :
                            doc.status === "enviado"   ? "#FDE68A" :
                            "#E2E8F0",
                          backgroundColor:
                            doc.status === "aprovado"  ? "#F0FDF4" :
                            doc.status === "reprovado" ? "#FFF5F5" :
                            doc.status === "enviado"   ? "#FFFBEB" :
                            "#F8FAFC",
                          color:
                            doc.status === "aprovado"  ? "#059669" :
                            doc.status === "reprovado" ? "#DC2626" :
                            doc.status === "enviado"   ? "#D97706" :
                            "#94A3B8",
                        }}
                      >
                        {doc.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Status geral do bloco */}
              <div className="flex-shrink-0 ml-auto pl-2">
                <StatusBadge status={overallStatus} />
                <p className="text-xs text-right mt-1" style={{ color: "#94A3B8" }}>
                  {block.docs.filter((d) => d.status === "aprovado").length}/{block.docs.length} docs
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {blocks.length === 0 && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}
        >
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Nenhum fornecedor ou documento encontrado.
          </p>
        </div>
      )}

      {/* Dica */}
      <p className="text-xs mt-4 text-center" style={{ color: "#CBD5E1" }}>
        Arraste os blocos para definir a ordem de montagem do processo final
      </p>
    </div>
  );
}
