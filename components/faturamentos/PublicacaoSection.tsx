"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  FileArchive, Download, ExternalLink, CheckCircle, XCircle, Clock,
  Building2, Tv, Wrench, Link2, AlertTriangle, Loader2, FileStack,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocStatus = "aprovado" | "reprovado" | "pendente" | "enviado";

interface DocItem {
  label:       string;
  status:      DocStatus;
  arquivo_url: string | null;
  tipo?:       string | null;
}

interface Bloco {
  id:     string;
  tipo:   "agencia" | "producao" | "midia";
  titulo: string;
  cnpj?:  string | null;
  docs:   DocItem[];
}

interface Certidao {
  id:           string;
  tipo:         string;
  label:        string;
  arquivo_url:  string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
}

interface Props {
  faturamentoId:   string;
  nomeCampanha:    string;
  certidoesIniciais: Certidao[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fornecedores:    any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custosInternos:  any[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, string> = {
    aprovado:  "#10B981",
    reprovado: "#EF4444",
    enviado:   "#D97706",
    pendente:  "#CBD5E1",
  };
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: map[status], display: "inline-block" }} />;
}

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = {
    aprovado:  { label: "Aprovado",   bg: "#D1FAE5", color: "#059669", Icon: CheckCircle },
    reprovado: { label: "Reprovado",  bg: "#FEE2E2", color: "#EF4444", Icon: XCircle },
    enviado:   { label: "Em análise", bg: "#FEF3C7", color: "#D97706", Icon: Clock },
    pendente:  { label: "Pendente",   bg: "#F1F5F9", color: "#94A3B8", Icon: Clock },
  }[status];
  const { label, bg, color, Icon } = cfg;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PublicacaoSection({
  faturamentoId, nomeCampanha, certidoesIniciais, fornecedores, custosInternos,
}: Props) {
  const storageKey = `revisao_ordem_${faturamentoId}`;

  // ── Constrói blocos com arquivo_url ────────────────────────────────────────
  const buildBlocos = useCallback((): Bloco[] => {
    const agenciaDocs: DocItem[] = [];

    certidoesIniciais.forEach((c) => {
      agenciaDocs.push({
        label:       c.label,
        status:      c.arquivo_url ? "aprovado" : "pendente",
        arquivo_url: c.arquivo_url,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custosInternos.forEach((ci: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ci.custo_interno_documentos ?? []).forEach((d: any) => {
        agenciaDocs.push({
          label:       `Peça — ${ci.servico}`,
          status:      (d.status ?? "pendente") as DocStatus,
          arquivo_url: d.arquivo_url ?? null,
        });
      });
    });

    const agencia: Bloco = { id: "__agencia__", tipo: "agencia", titulo: "Agência", docs: agenciaDocs };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fornBlocks: Bloco[] = (fornecedores as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ff: any) => ff.associado !== false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ff: any): Bloco => ({
        id:    ff.id as string,
        tipo:  (ff.fornecedor?.tipo ?? ff.tipo_iclips ?? "producao") as "agencia" | "producao" | "midia",
        titulo: ff.fornecedor?.razao_social ?? ff.nome_iclips ?? "Fornecedor",
        cnpj:  ff.fornecedor?.cnpj ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        docs:  (ff.documentos ?? []).map((d: any): DocItem => ({
          label:       d.label ?? d.tipo ?? "Documento",
          status:      (d.status ?? "pendente") as DocStatus,
          arquivo_url: d.arquivo_url ?? null,
          tipo:        d.tipo ?? null,
        })),
      }));

    fornBlocks.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "producao" ? -1 : 1;
      return a.titulo.localeCompare(b.titulo);
    });

    return [agencia, ...fornBlocks];
  }, [certidoesIniciais, custosInternos, fornecedores]);

  // ── Ordem salva no localStorage (Etapa 4) ──────────────────────────────────
  const [blocos, setBlocos] = useState<Bloco[]>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        const defaults = buildBlocos();
        const byId = Object.fromEntries(defaults.map((b) => [b.id, b]));
        const ordered   = ids.map((id) => byId[id]).filter(Boolean) as Bloco[];
        const remaining = defaults.filter((b) => !ids.includes(b.id));
        return [...ordered, ...remaining];
      }
    } catch { /* ignore */ }
    return buildBlocos();
  });

  useEffect(() => {
    setBlocos(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const ids: string[] = JSON.parse(saved);
          const fresh = buildBlocos();
          const byId = Object.fromEntries(fresh.map((b) => [b.id, b]));
          const ordered   = ids.map((id) => byId[id]).filter(Boolean) as Bloco[];
          const remaining = fresh.filter((b) => !ids.includes(b.id));
          return [...ordered, ...remaining];
        }
      } catch { /* ignore */ }
      return buildBlocos();
    });
  }, [buildBlocos, storageKey]);

  // ── Estado de geração ──────────────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [gerando,     setGerando]     = useState(false);
  const [progressoMsg, setProgressoMsg] = useState("");
  const [pdfUrl,      setPdfUrl]      = useState<string | null>(null);
  const [erro,        setErro]        = useState<string | null>(null);
  const [blocoAtivo,  setBlocoAtivo]  = useState<string>("__agencia__");
  const mainRef = useRef<HTMLDivElement>(null);

  // Estatísticas
  const totalDocs     = blocos.reduce((s, b) => s + b.docs.length, 0);
  const totalAprovados = blocos.reduce((s, b) => s + b.docs.filter(d => d.status === "aprovado").length, 0);
  const temPendentes  = totalAprovados < totalDocs;

  // ── Geração do PDF ─────────────────────────────────────────────────────────
  async function gerarPdf() {
    setGerando(true);
    setErro(null);
    setPdfUrl(null);

    try {
      setProgressoMsg("Organizando documentos…");
      const blockOrder = blocos.map(b => b.id);

      setProgressoMsg("Gerando PDF no servidor…");
      const res = await fetch("/api/publicacao/gerar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faturamentoId, blockOrder }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `Erro ${res.status}`);
      }

      setProgressoMsg("Preparando download…");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
      setProgressoMsg("PDF pronto!");

      // Download automático
      const a = document.createElement("a");
      a.href = url;
      a.download = `processo-faturamento.pdf`;
      a.click();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setGerando(false);
    }
  }

  // ── Scroll para bloco ──────────────────────────────────────────────────────
  function scrollParaBloco(id: string) {
    setBlocoAtivo(id);
    const el = document.getElementById(`bloco-pub-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderCorBloco(tipo: "agencia" | "producao" | "midia") {
    if (tipo === "agencia")  return "#2E60FF";
    if (tipo === "midia")    return "#7C3AED";
    return "#059669";
  }

  function renderBgBloco(tipo: "agencia" | "producao" | "midia") {
    if (tipo === "agencia")  return "#EEF2FF";
    if (tipo === "midia")    return "#F5F3FF";
    return "#ECFDF5";
  }

  function renderIconBloco(tipo: "agencia" | "producao" | "midia") {
    if (tipo === "agencia") return Building2;
    if (tipo === "midia")   return Tv;
    return Wrench;
  }

  function tipoLabel(tipo: "agencia" | "producao" | "midia") {
    if (tipo === "agencia") return "Agência";
    if (tipo === "midia")   return "Mídia";
    return "Produção";
  }

  return (
    <div className="flex gap-0 rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0", minHeight: 600 }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 overflow-y-auto border-r"
        style={{ width: 220, borderColor: "#E2E8F0", background: "white" }}
      >
        {/* Cabeçalho sidebar */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "#F1F5F9" }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: "#94A3B8" }}>Sumário</p>
          <p className="text-xs" style={{ color: "#64748B" }}>{totalAprovados}/{totalDocs} aprovados</p>
        </div>

        {/* Blocos */}
        {blocos.map((bloco, i) => {
          const aprovados = bloco.docs.filter(d => d.status === "aprovado").length;
          const cor = renderCorBloco(bloco.tipo);
          const ativo = blocoAtivo === bloco.id;
          const TipoIcon = renderIconBloco(bloco.tipo);

          return (
            <div key={bloco.id} className="border-b" style={{ borderColor: "#F1F5F9" }}>
              {/* Linha do bloco */}
              <button
                onClick={() => scrollParaBloco(bloco.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                style={{
                  borderLeft: ativo ? `3px solid ${cor}` : "3px solid transparent",
                  background: ativo ? `${cor}10` : "transparent",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: cor, color: "white" }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: ativo ? cor : "#334155" }}>
                    {bloco.titulo}
                  </p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>
                    <TipoIcon className="w-2.5 h-2.5 inline mr-0.5" />
                    {aprovados}/{bloco.docs.length}
                  </p>
                </div>
              </button>

              {/* Sub-docs */}
              {ativo && bloco.docs.map((doc, j) => (
                <div key={j} className="flex items-center gap-1.5 px-4 py-1" style={{ paddingLeft: 32 }}>
                  <StatusDot status={doc.status} />
                  <span className="text-xs truncate" style={{ color: "#64748B" }}>{doc.label}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Legenda */}
        <div className="p-3 m-3 rounded-lg" style={{ background: "#F8FAFC" }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>Legenda</p>
          {[
            { cor: "#10B981", label: "Aprovado" },
            { cor: "#D97706", label: "Em análise" },
            { cor: "#EF4444", label: "Reprovado" },
            { cor: "#CBD5E1", label: "Pendente" },
          ].map(({ cor, label }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
              <span className="text-xs" style={{ color: "#64748B" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-1">
            <Link2 className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "#7C3AED" }} />
            <span className="text-xs" style={{ color: "#64748B" }}>Link externo</span>
          </div>
        </div>
      </aside>

      {/* ── Área principal ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: "#E2E8F0", background: "white" }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{nomeCampanha}</p>
            <p className="text-xs" style={{ color: "#64748B" }}>
              {blocos.length} blocos · {totalDocs} documentos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {temPendentes && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#FEF3C7", color: "#D97706" }}>
                <AlertTriangle className="w-3 h-3" />
                {totalDocs - totalAprovados} pendentes
              </span>
            )}
            {!temPendentes && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                <CheckCircle className="w-3 h-3" />
                Todos aprovados
              </span>
            )}
            {pdfUrl && (
              <a href={pdfUrl} download="processo-faturamento.pdf"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: "#E2E8F0", color: "#334155", background: "white" }}
              >
                <Download className="w-3.5 h-3.5" />
                Baixar PDF
              </a>
            )}
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#2E60FF", color: "white" }}
            >
              <FileArchive className="w-4 h-4" />
              Gerar PDF
            </button>
          </div>
        </div>

        {/* Preview label */}
        <div className="px-5 py-2.5 border-b flex-shrink-0" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
            Pré-visualização — ordem final dos documentos no PDF
          </p>
        </div>

        {/* Lista de blocos */}
        <div ref={mainRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {blocos.map((bloco, bi) => {
            const cor   = renderCorBloco(bloco.tipo);
            const bg    = renderBgBloco(bloco.tipo);
            const Icon  = renderIconBloco(bloco.tipo);
            const aprovados = bloco.docs.filter(d => d.status === "aprovado").length;

            return (
              <div
                key={bloco.id}
                id={`bloco-pub-${bloco.id}`}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: "#E2E8F0" }}
              >
                {/* Cabeçalho do bloco */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: bg, borderBottom: `1px solid ${cor}20` }}>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: cor, color: "white" }}
                  >
                    {bi + 1}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${cor}20`, color: cor }}
                    >
                      <Icon className="w-3 h-3" />
                      {tipoLabel(bloco.tipo)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "#0F172A" }}>{bloco.titulo}</span>
                    {bloco.cnpj && (
                      <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{bloco.cnpj}</span>
                    )}
                  </div>
                  <span className="ml-auto text-xs" style={{ color: "#64748B" }}>
                    {aprovados}/{bloco.docs.length} aprovados
                  </span>
                </div>

                {/* Documentos */}
                {bloco.docs.length === 0 ? (
                  <div className="px-4 py-3">
                    <p className="text-xs" style={{ color: "#94A3B8" }}>Nenhum documento</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
                    {bloco.docs.map((doc, di) => {
                      const isLink = !!doc.arquivo_url;

                      return (
                        <div key={di} className="flex items-start gap-3 px-4 py-3" style={{ background: "white" }}>
                          {/* Número */}
                          <span className="text-xs font-bold flex-shrink-0 w-5 text-right mt-0.5" style={{ color: "#CBD5E1" }}>
                            {di + 1}
                          </span>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              {/* Barra colorida se link evidência */}
                              {isLink && doc.tipo === "evidencia" && (
                                <div className="w-1 h-full min-h-[32px] rounded-full flex-shrink-0" style={{ background: "#7C3AED" }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium" style={{ color: "#334155" }}>{doc.label}</p>
                                {isLink && (
                                  <a
                                    href={doc.arquivo_url!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs mt-1"
                                    style={{ color: "#2E60FF", textDecoration: "underline" }}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Abrir no Google Drive
                                  </a>
                                )}
                                {!isLink && (
                                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Sem arquivo</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status + badge link */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {isLink && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: "#EDE9FE", color: "#7C3AED" }}
                              >
                                <Link2 className="w-3 h-3" />
                                Link
                              </span>
                            )}
                            <StatusBadge status={doc.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal de geração ─────────────────────────────────────────────────── */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !gerando) setModalAberto(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                  <FileStack className="w-5 h-5" style={{ color: "#2E60FF" }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#0F172A" }}>
                    {gerando ? "Gerando PDF…" : pdfUrl ? "PDF gerado!" : "Gerar PDF do Processo"}
                  </p>
                  <p className="text-xs" style={{ color: "#64748B" }}>
                    {gerando
                      ? progressoMsg
                      : pdfUrl
                      ? "O arquivo está pronto para download."
                      : `${blocos.length} blocos · ${totalDocs} documentos`}
                  </p>
                </div>
              </div>
            </div>

            {/* Corpo */}
            <div className="px-6 py-4">
              {!gerando && !pdfUrl && (
                <>
                  {/* Checklist pré-geração */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#F0FDF4" }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#16A34A", color: "white" }}>✓</div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#15803D" }}>{totalAprovados} documentos aprovados</p>
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Incluídos no PDF com status aprovado</p>
                      </div>
                    </div>

                    {temPendentes && (
                      <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#FFFBEB" }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#D97706", color: "white" }}>!</div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#D97706" }}>
                            {totalDocs - totalAprovados} documentos pendentes
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Serão incluídos com status pendente</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#EEF2FF" }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2E60FF" }}>
                        <Link2 className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#2E60FF" }}>Links do Google Drive</p>
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Cada documento terá link clicável no PDF</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#F8FAFC" }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#64748B", color: "white" }}>✓</div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#334155" }}>Ordem definida na Revisão</p>
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                          {blocos.map(b => b.tipo === "agencia" ? "Agência" : b.titulo).join(" → ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {gerando && (
                <div className="py-4">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#2E60FF" }} />
                    <p className="text-sm" style={{ color: "#64748B" }}>{progressoMsg}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
                    <div className="h-full rounded-full animate-pulse" style={{ background: "#2E60FF", width: "60%" }} />
                  </div>
                </div>
              )}

              {pdfUrl && !gerando && (
                <div className="py-4 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#DCFCE7" }}>
                    <CheckCircle className="w-8 h-8" style={{ color: "#16A34A" }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#0F172A" }}>PDF gerado com sucesso!</p>
                  <p className="text-xs mb-4" style={{ color: "#64748B" }}>
                    O download foi iniciado automaticamente.
                  </p>
                  <a
                    href={pdfUrl}
                    download="processo-faturamento.pdf"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "#2E60FF", color: "white" }}
                  >
                    <Download className="w-4 h-4" />
                    Baixar novamente
                  </a>
                </div>
              )}

              {erro && !gerando && (
                <div className="p-3 rounded-lg mb-4" style={{ background: "#FEE2E2" }}>
                  <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>Erro ao gerar PDF</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{erro}</p>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: "#E2E8F0" }}>
              {!gerando && !pdfUrl && (
                <>
                  <button
                    onClick={() => setModalAberto(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border"
                    style={{ borderColor: "#E2E8F0", color: "#64748B" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={gerarPdf}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "#2E60FF", color: "white" }}
                  >
                    <FileArchive className="w-4 h-4" />
                    {temPendentes ? "Gerar mesmo assim" : "Gerar PDF"}
                  </button>
                </>
              )}
              {(pdfUrl || erro) && !gerando && (
                <button
                  onClick={() => { setModalAberto(false); setErro(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: "#E2E8F0", color: "#64748B" }}
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
