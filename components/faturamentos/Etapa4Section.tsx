"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Copy, CheckCircle, AlertTriangle, Upload, FileText,
  Loader2, ExternalLink, Trash2, Plus, Pencil, Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────

type FornecedorNf = {
  ffId: string;
  razaoSocial: string;
  cnpj: string | null;
  valor: number;
  valorNf: string | null;
  numeroNf: string | null;
  nfStatus: string | null;
  tipo: "midia" | "producao";
  honorarios: number;
  numeroOsPi: string | null;
};

type Certidao = {
  id: string;
  tipo: string;
  label: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
};

type GlobalCertidao = {
  id: string;
  tipo: string;
  label: string;
  validade: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
};

const TIPOS_CERTIDOES = [
  { tipo: "federal",     label: "Federal — Receita Federal + PGFN" },
  { tipo: "estadual",    label: "Estadual — SEFAZ-AL" },
  { tipo: "municipal",   label: "Municipal — SEMFAZ Maceió" },
  { tipo: "fgts",        label: "FGTS — Caixa Econômica Federal" },
  { tipo: "trabalhista", label: "Trabalhista — CNDT (TST)" },
  { tipo: "falencia",    label: "Certidão Negativa de Falência" },
];

const LIMITE_GISS = 2000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSubpasta(tipo: string): string {
  if (tipo.startsWith("empenho_"))    return "EMPENHOS";
  if (tipo.startsWith("nf_agencia_")) return "NF AGÊNCIA";
  if (tipo === "proposta")    return "PROPOSTA";
  if (tipo === "evidencias")  return "EVIDÊNCIAS";
  if (tipo === "oficio")      return "OFÍCIO";
  return "CERTIDÕES";
}

function formatCnpj(raw: string | null): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatValorGiss(f: FornecedorNf): string {
  if (f.valorNf) {
    const cleaned = f.valorNf.replace(/^R\$\s*/, "").trim();
    return `R$ ${cleaned}`;
  }
  return formatCurrency(f.valor);
}

// ── Gerador de Discriminação GISS ────────────────────────────────────────────

function buildGissBlocos(
  nomeCampanha: string,
  empenho: string | null,
  propostaId: string | null,
  valorCustosInternos: number,
  producao: FornecedorNf[],
  midia: FornecedorNf[],
  osPiLocal: Record<string, string>,
): string[] {
  const totalProd  = producao.reduce((s, f) => s + f.valor, 0);
  const honorsProd = producao.reduce((s, f) => s + f.honorarios, 0);
  const totalMid   = midia.reduce((s, f) => s + f.valor, 0);
  const comissao   = midia.reduce((s, f) => s + f.honorarios, 0);
  const retencao   = Math.round((honorsProd + comissao) * 0.048 * 100) / 100;

  const prodCount = producao.length;
  const midCount  = midia.length;
  const total     = prodCount + midCount;
  if (total === 0) return [];

  function getNumeroOsPi(f: FornecedorNf): string {
    return osPiLocal[f.ffId] ?? f.numeroOsPi ?? "???";
  }

  function getLineText(globalIdx: number): string {
    if (globalIdx < prodCount) {
      const f = producao[globalIdx];
      return `O.S No ${getNumeroOsPi(f)} - ${f.razaoSocial.toUpperCase()} - CNPJ: ${formatCnpj(f.cnpj)} - NF ${f.numeroNf ?? "???"} VALOR ${formatValorGiss(f)}`;
    }
    const f = midia[globalIdx - prodCount];
    return `P.I No ${getNumeroOsPi(f)} - ${f.razaoSocial.toUpperCase()} - CNPJ: ${formatCnpj(f.cnpj)} - NF ${f.numeroNf ?? "???"} VALOR ${formatValorGiss(f)}`;
  }

  function buildBlockText(indices: number[], parteSuffix: string): string {
    const parteStr = parteSuffix ? ` ${parteSuffix}` : "";
    let text = `CAMPANHA: ${nomeCampanha.toUpperCase()}${parteStr}`;
    if (empenho)    text += `\nEMPENHO: ${empenho}`;
    if (propostaId) text += `\nPROPOSTA No ${propostaId}`;
    text += `\nCUSTOS INTERNOS (CRIAÇÃO) - ${formatCurrency(valorCustosInternos)}`;

    const prodInBlock = indices.filter(i => i < prodCount);
    const midInBlock  = indices.filter(i => i >= prodCount);

    const isLastProd = prodInBlock.length > 0 && Math.max(...prodInBlock) === prodCount - 1;
    const isLastMid  = midInBlock.length > 0  && Math.max(...midInBlock)  === total - 1;

    if (prodInBlock.length > 0) {
      text += "\nCUSTOS EXTERNOS (PRODUÇÃO):";
      prodInBlock.forEach(i => { text += `\n${getLineText(i)}`; });
      if (isLastProd) {
        text += `\nTOTAL TERCEIROS: ${formatCurrency(totalProd)} HONORÁRIOS: ${formatCurrency(honorsProd)}`;
      }
    }

    if (midInBlock.length > 0) {
      text += "\nCUSTOS EXTERNOS (MIDIA):";
      midInBlock.forEach(i => { text += `\n${getLineText(i)}`; });
      if (isLastMid) {
        text += `\nTOTAL TERCEIROS: ${formatCurrency(totalMid)} COMISSÃO ${formatCurrency(comissao)} RETENÇÃO DE 4,8% (IR) SOBRE A BASE DE CÁLCULO ${formatCurrency(retencao)}`;
      }
    }

    return text;
  }

  // Tenta caber em bloco único
  const allIndices = Array.from({ length: total }, (_, i) => i);
  const single = buildBlockText(allIndices, "");
  if (single.length <= LIMITE_GISS) return [single];

  // Multi-bloco: greedy, estimando com sufixo de tamanho fixo
  const PLACEHOLDER = "(PARTE 01 DE 99)";
  const assignments: number[][] = [];
  let current: number[] = [];

  for (let i = 0; i < total; i++) {
    const test = [...current, i];
    if (buildBlockText(test, PLACEHOLDER).length > LIMITE_GISS && current.length > 0) {
      assignments.push(current);
      current = [i];
    } else {
      current = test;
    }
  }
  if (current.length > 0) assignments.push(current);

  const numParts = assignments.length;
  return assignments.map((indices, idx) => {
    const suffix = `(PARTE ${String(idx + 1).padStart(2, "0")} DE ${String(numParts).padStart(2, "0")})`;
    return buildBlockText(indices, suffix);
  });
}

// ── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <button
      onClick={copiar}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        backgroundColor: copiado ? "#ECFDF5" : "#EEF2FF",
        color: copiado ? "#059669" : "#2E60FF",
      }}
    >
      {copiado ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiado ? "Copiado!" : "Copiar"}
    </button>
  );
}

// ── OsPiInput ────────────────────────────────────────────────────────────────

function OsPiInput({
  ffId,
  label,
  inicial,
  onSaved,
}: {
  ffId: string;
  label: string;
  inicial: string | null;
  onSaved: (ffId: string, val: string) => void;
}) {
  const [valor, setValor]   = useState(inicial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const lastSaved = useRef(inicial ?? "");

  async function salvar() {
    const trimmed = valor.trim();
    if (trimmed === lastSaved.current) return;
    setSaving(true);
    await fetch("/api/faturamento-fornecedores", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId, numeroOsPi: trimmed }),
    });
    lastSaved.current = trimmed;
    onSaved(ffId, trimmed);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-xs font-mono" style={{ color: "#64748B" }}>{label} Nº</span>
      <div className="relative flex items-center">
        <input
          className="text-xs font-mono rounded border px-2 py-0.5 w-20 outline-none focus:ring-1"
          style={{
            borderColor: valor.trim() ? "#CBD5E1" : "#FCA5A5",
            backgroundColor: valor.trim() ? "white" : "#FFF5F5",
            color: "#0F172A",
          }}
          value={valor}
          onChange={e => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="Nº"
        />
        {saving && <Loader2 className="absolute -right-4 w-3 h-3 animate-spin" style={{ color: "#94A3B8" }} />}
        {saved  && <Check   className="absolute -right-4 w-3 h-3"              style={{ color: "#059669" }} />}
      </div>
    </div>
  );
}

// ── CertidaoSlot ─────────────────────────────────────────────────────────────

function CertidaoSlot({
  faturamentoId,
  tipo,
  label,
  certidao,
  faturamento,
  onSalva,
  onRemovida,
}: {
  faturamentoId: string;
  tipo: string;
  label: string;
  certidao: Certidao | null;
  faturamento: { nomeCampanha: string; jobId: string | null; clienteTipo: string; clienteNome: string };
  onSalva: (c: Certidao) => void;
  onRemovida: (tipo: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    setErro(null);

    const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!scriptUrl) { setErro("Upload não configurado."); setUploading(false); return; }

    try {
      const fileContent = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const ano = new Date().getFullYear();
      const nomeArquivo = `${tipo.toUpperCase()}_${file.name}`;

      const driveRes = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          fileName: nomeArquivo,
          fileContent,
          mimeType: file.type || "application/pdf",
          ano,
          clienteGrupo: faturamento.clienteTipo === "governo_al" ? "GOVERNO DE ALAGOAS" : "",
          clienteNome:  faturamento.clienteNome ?? "SEM_CLIENTE",
          jobId:        faturamento.jobId ?? "FAT",
          campanha:     faturamento.nomeCampanha ?? "SEM_NOME",
          subpasta:     getSubpasta(tipo),
          fornecedorNome: "AGENCIA",
        }),
      });

      if (!driveRes.ok) throw new Error(`Drive error: ${driveRes.status}`);
      const driveData = await driveRes.json() as { ok: boolean; viewUrl?: string; error?: string };
      if (!driveData.ok || !driveData.viewUrl) throw new Error(driveData.error ?? "Sem URL do Drive");

      const saveRes = await fetch("/api/certidoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faturamentoId,
          tipo,
          label,
          viewUrl:  driveData.viewUrl,
          fileName: nomeArquivo,
          fileSize: file.size,
        }),
      });

      if (!saveRes.ok) { const j = await saveRes.json(); throw new Error(j.error ?? "Erro ao salvar"); }
      const { certidao } = await saveRes.json() as { certidao: Certidao };
      onSalva(certidao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemover() {
    if (!certidao || !confirm("Remover este arquivo?")) return;
    await fetch(`/api/certidoes?id=${certidao.id}`, { method: "DELETE" });
    onRemovida(tipo);
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg border"
      style={{
        borderColor: certidao ? "#BBF7D0" : "#E2E8F0",
        backgroundColor: certidao ? "#F0FDF4" : "#F8FAFC",
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <FileText
          className="w-4 h-4 flex-shrink-0"
          style={{ color: certidao ? "#15803D" : "#94A3B8" }}
        />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: certidao ? "#15803D" : "#334155" }}>
            {label}
          </p>
          {certidao?.nome_arquivo && (
            <p className="text-xs truncate" style={{ color: "#64748B" }}>{certidao.nome_arquivo}</p>
          )}
          {certidao?.tamanho_bytes != null && (
            <p className="text-xs" style={{ color: "#94A3B8" }}>{formatBytes(certidao.tamanho_bytes)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {certidao?.arquivo_url && (
          <a
            href={certidao.arquivo_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "#2E60FF" }}
          >
            <ExternalLink className="w-3 h-3" />
            Abrir
          </a>
        )}
        {certidao && (
          <button onClick={handleRemover} className="p-1 rounded hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          </button>
        )}
        {!certidao && (
          <>
            <input
              id={`cert-input-${tipo}`}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
            />
            <label
              htmlFor={`cert-input-${tipo}`}
              onClick={(e) => { if (uploading) e.preventDefault(); }}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: "#EEF2FF",
                color: "#2E60FF",
                opacity: uploading ? 0.6 : 1,
                cursor: uploading ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Enviando…" : "Upload"}
            </label>
          </>
        )}
      </div>
      {erro && (
        <p className="absolute text-xs mt-8" style={{ color: "#DC2626" }}>{erro}</p>
      )}
    </div>
  );
}

// ── Etapa4Section ─────────────────────────────────────────────────────────────

export function Etapa4Section({
  faturamentoId,
  nomeCampanha,
  jobId,
  propostaId,
  empenho,
  clienteTipo,
  clienteNome,
  fornecedoresNf,
  certidoesIniciais,
  valorCustosInternos,
}: {
  faturamentoId: string;
  nomeCampanha: string;
  jobId: string | null;
  propostaId: string | null;
  empenho: string | null;
  clienteTipo: string;
  clienteNome: string;
  fornecedoresNf: FornecedorNf[];
  certidoesIniciais: Certidao[];
  valorCustosInternos: number;
}) {
  const [certidoes, setCertidoes] = useState<Certidao[]>(certidoesIniciais);
  const [osPiLocal, setOsPiLocal] = useState<Record<string, string>>({});

  const [empenhoCount, setEmpenhoCount] = useState(() => {
    const n = certidoesIniciais.filter((c) => c.tipo.startsWith("empenho_")).length;
    return Math.max(1, n);
  });

  const [nfAgenciaCount, setNfAgenciaCount] = useState(() => {
    const n = certidoesIniciais.filter((c) => c.tipo.startsWith("nf_agencia_")).length;
    return Math.max(1, n);
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [perFatRes, globaisRes] = await Promise.all([
          fetch(`/api/certidoes?faturamentoId=${faturamentoId}`),
          fetch("/api/certidoes-globais"),
        ]);

        const perFatData  = await perFatRes.json()  as { certidoes?: Certidao[] };
        const globaisData = await globaisRes.json() as { certidoes?: GlobalCertidao[] };

        const existentes: Certidao[] = perFatData.certidoes ?? certidoesIniciais;
        const globais: GlobalCertidao[] = globaisData.certidoes ?? [];
        const tiposExistentes = new Set(existentes.map((c) => c.tipo));

        const autoPromises = TIPOS_CERTIDOES
          .filter(({ tipo }) => !tiposExistentes.has(tipo))
          .map(({ tipo, label }) => {
            const global = globais.find((g) => g.tipo === tipo && g.arquivo_url);
            if (!global) return Promise.resolve(null);
            return fetch("/api/certidoes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                faturamentoId,
                tipo,
                label,
                viewUrl:  global.arquivo_url,
                fileName: global.nome_arquivo ?? label,
                fileSize: global.tamanho_bytes ?? 0,
              }),
            })
              .then((r) => r.ok ? r.json() : null)
              .then((j: { certidao?: Certidao } | null) => j?.certidao ?? null)
              .catch(() => null);
          });

        const autoResults = await Promise.all(autoPromises);
        const novas = autoResults.filter((c): c is Certidao => c !== null);

        if (!cancelled) {
          const combined = [...existentes, ...novas].reduce<Certidao[]>((acc, c) => {
            if (!acc.find((x) => x.tipo === c.tipo)) acc.push(c);
            return acc;
          }, []);
          setCertidoes(combined);
          const ne = combined.filter((c) => c.tipo.startsWith("empenho_")).length;
          if (ne > 0) setEmpenhoCount((prev) => Math.max(prev, ne));
          const na = combined.filter((c) => c.tipo.startsWith("nf_agencia_")).length;
          if (na > 0) setNfAgenciaCount((prev) => Math.max(prev, na));
        }
      } catch {
        // usa props como fallback
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [faturamentoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCertidaoSalva = useCallback((c: Certidao) => {
    setCertidoes((prev) => [...prev.filter((x) => x.tipo !== c.tipo), c]);
  }, []);

  const handleCertidaoRemovida = useCallback((tipo: string) => {
    setCertidoes((prev) => prev.filter((c) => c.tipo !== tipo));
  }, []);

  const handleOsPiSaved = useCallback((ffId: string, val: string) => {
    setOsPiLocal((prev) => ({ ...prev, [ffId]: val }));
  }, []);

  const producao = fornecedoresNf.filter((f) => f.tipo === "producao");
  const midia    = fornecedoresNf.filter((f) => f.tipo === "midia");

  const nfPendentes = fornecedoresNf.filter(
    (f) => !f.numeroNf || f.nfStatus === "falhou",
  );
  const osPiPendentes = fornecedoresNf.filter(
    (f) => !(osPiLocal[f.ffId] ?? f.numeroOsPi),
  );

  const bloqueadoNf   = nfPendentes.length > 0;
  const bloqueadoOsPi = osPiPendentes.length > 0;
  const bloqueado     = bloqueadoNf || bloqueadoOsPi;

  const blocos = bloqueado ? [] : buildGissBlocos(
    nomeCampanha, empenho, propostaId, valorCustosInternos,
    producao, midia, osPiLocal,
  );

  const certPorTipo        = Object.fromEntries(certidoes.map((c) => [c.tipo, c]));
  const certPendentes      = TIPOS_CERTIDOES.filter((t) => !certPorTipo[t.tipo]).length;
  const empenhoTipos       = Array.from({ length: empenhoCount }, (_, i) => `empenho_${i}`);
  const empenhosPendentes  = empenhoTipos.filter((t) => !certPorTipo[t]).length;
  const nfAgenciaTipos     = Array.from({ length: nfAgenciaCount }, (_, i) => `nf_agencia_${i}`);
  const nfAgenciaPendentes = nfAgenciaTipos.filter((t) => !certPorTipo[t]).length;

  const fat = { nomeCampanha, jobId, clienteTipo, clienteNome };

  return (
    <div className="mt-6">
      {/* Título */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>Etapa 3 — Documentação da Agência</h2>
        <div className="flex items-center gap-2">
          {bloqueadoNf && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              <AlertTriangle className="w-3 h-3" />
              {nfPendentes.length} NF{nfPendentes.length > 1 ? "s" : ""} pendente{nfPendentes.length > 1 ? "s" : ""}
            </span>
          )}
          {!bloqueadoNf && bloqueadoOsPi && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              <Pencil className="w-3 h-3" />
              {osPiPendentes.length} Nº OS/PI faltando
            </span>
          )}
          {!bloqueado && fornecedoresNf.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
              <CheckCircle className="w-3 h-3" />
              Discriminação pronta
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Discriminação GISS ─────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Discriminação para GISS Online</p>
            {!bloqueado && blocos.length > 1 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
                {blocos.length} partes
              </span>
            )}
          </div>

          {/* Sem fornecedores com NF */}
          {fornecedoresNf.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs" style={{ color: "#94A3B8" }}>Nenhum fornecedor com NF neste faturamento.</p>
            </div>
          )}

          {/* Tabela de dados por fornecedor */}
          {fornecedoresNf.length > 0 && (
            <div className="px-5 py-4 border-b" style={{ borderColor: "#E2E8F0" }}>
              <p className="text-xs font-medium mb-3" style={{ color: "#64748B" }}>
                Preencha os números de O.S. / P.I. para gerar a discriminação:
              </p>
              <div className="space-y-2">
                {fornecedoresNf.map((f) => {
                  const nfOk = !!f.numeroNf && f.nfStatus !== "falhou";
                  return (
                    <div key={f.ffId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>

                      <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          backgroundColor: f.tipo === "midia" ? "#EDE9FE" : "#DBEAFE",
                          color:           f.tipo === "midia" ? "#7C3AED" : "#1D4ED8",
                        }}>
                        {f.tipo === "midia" ? "PI" : "OS"}
                      </span>

                      <span className="text-xs font-medium flex-1 truncate" style={{ color: "#0F172A" }}>
                        {f.razaoSocial}
                      </span>

                      <OsPiInput
                        ffId={f.ffId}
                        label={f.tipo === "midia" ? "P.I." : "O.S."}
                        inicial={f.numeroOsPi}
                        onSaved={handleOsPiSaved}
                      />

                      {nfOk ? (
                        <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: "#059669" }}>
                          <CheckCircle className="w-3 h-3" />
                          NF {f.numeroNf}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: "#D97706" }}>
                          <AlertTriangle className="w-3 h-3" />
                          NF pendente
                        </span>
                      )}

                      <span className="text-xs font-mono flex-shrink-0" style={{ color: "#334155" }}>
                        {formatValorGiss(f)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bloqueado — NF pendente */}
          {fornecedoresNf.length > 0 && bloqueadoNf && (
            <div className="px-5 py-5 flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="w-7 h-7" style={{ color: "#F59E0B" }} />
              <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                Aguardando NF{nfPendentes.length > 1 ? "s" : ""} dos fornecedores
              </p>
              <p className="text-xs" style={{ color: "#64748B" }}>
                {nfPendentes.map(f => f.razaoSocial).join(", ")}
              </p>
            </div>
          )}

          {/* Bloqueado — OS/PI pendente */}
          {fornecedoresNf.length > 0 && !bloqueadoNf && bloqueadoOsPi && (
            <div className="px-5 py-5 flex flex-col items-center gap-2 text-center">
              <Pencil className="w-7 h-7" style={{ color: "#F59E0B" }} />
              <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                Preencha os números de O.S. / P.I. acima para gerar a discriminação
              </p>
            </div>
          )}

          {/* Blocos gerados */}
          {!bloqueado && blocos.map((bloco, idx) => (
            <div key={idx} className="px-5 py-4" style={{ borderTop: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {blocos.length > 1 && (
                    <span className="text-xs font-semibold" style={{ color: "#2E60FF" }}>
                      Parte {idx + 1} de {blocos.length}
                    </span>
                  )}
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: bloco.length > LIMITE_GISS * 0.9 ? "#FEF3C7" : "#F1F5F9",
                      color:           bloco.length > LIMITE_GISS * 0.9 ? "#D97706"  : "#64748B",
                    }}
                  >
                    {bloco.length}/{LIMITE_GISS} chars
                  </span>
                </div>
                <CopyButton texto={bloco} />
              </div>
              <pre
                className="text-xs rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed"
                style={{ backgroundColor: "#F1F5F9", color: "#334155" }}
              >
                {bloco}
              </pre>
            </div>
          ))}
        </div>

        {/* ── NF da Agência ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Nota Fiscal da Agência</p>
            {nfAgenciaPendentes > 0 ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                {nfAgenciaPendentes} pendente{nfAgenciaPendentes > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                <CheckCircle className="w-3 h-3" /> Anexada
              </span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {nfAgenciaTipos.map((tipo, idx) => (
              <CertidaoSlot
                key={tipo}
                faturamentoId={faturamentoId}
                tipo={tipo}
                label={`NF da Agência${nfAgenciaCount > 1 ? ` ${idx + 1}` : ""}`}
                certidao={certPorTipo[tipo] ?? null}
                faturamento={fat}
                onSalva={handleCertidaoSalva}
                onRemovida={handleCertidaoRemovida}
              />
            ))}
            <button
              onClick={() => setNfAgenciaCount((n) => n + 1)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50 mt-1"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar NF
            </button>
          </div>
        </div>

        {/* ── Certidões ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Certidões da Agência</p>
            {certPendentes > 0 ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                {certPendentes} pendente{certPendentes > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                <CheckCircle className="w-3 h-3" /> Todas enviadas
              </span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {TIPOS_CERTIDOES.map(({ tipo, label }) => (
              <CertidaoSlot
                key={tipo}
                faturamentoId={faturamentoId}
                tipo={tipo}
                label={label}
                certidao={certPorTipo[tipo] ?? null}
                faturamento={fat}
                onSalva={handleCertidaoSalva}
                onRemovida={handleCertidaoRemovida}
              />
            ))}
          </div>
        </div>

        {/* ── Empenhos ───────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Empenhos</p>
            {empenhosPendentes > 0 ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                {empenhosPendentes} pendente{empenhosPendentes > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                <CheckCircle className="w-3 h-3" /> OK
              </span>
            )}
          </div>
          <div className="p-4 space-y-2">
            {empenhoTipos.map((tipo, idx) => (
              <CertidaoSlot
                key={tipo}
                faturamentoId={faturamentoId}
                tipo={tipo}
                label={`Empenho${empenhoCount > 1 ? ` ${idx + 1}` : ""}`}
                certidao={certPorTipo[tipo] ?? null}
                faturamento={fat}
                onSalva={handleCertidaoSalva}
                onRemovida={handleCertidaoRemovida}
              />
            ))}
            <button
              onClick={() => setEmpenhoCount((n) => n + 1)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50 mt-1"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar empenho
            </button>
          </div>
        </div>

        {/* ── Proposta, Evidências, Ofício ────────────────────────────────────── */}
        {(
          [
            { tipo: "proposta",   label: "Proposta iClips" + (propostaId ? ` — Proposta ${propostaId}` : "") },
            { tipo: "evidencias", label: "Evidências (PDF consolidado dos criativos)" },
            { tipo: "oficio",     label: "Ofício de encaminhamento" },
          ] as { tipo: string; label: string }[]
        ).map(({ tipo, label }) => {
          const ok = !!certPorTipo[tipo];
          return (
            <div key={tipo} className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <p className="text-xs font-semibold" style={{ color: "#334155" }}>
                  {tipo === "proposta" ? "Proposta" : tipo === "evidencias" ? "Evidências" : "Ofício"}
                </p>
                {ok ? (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                    <CheckCircle className="w-3 h-3" /> Anexado
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
                    Pendente
                  </span>
                )}
              </div>
              <div className="p-4">
                <CertidaoSlot
                  faturamentoId={faturamentoId}
                  tipo={tipo}
                  label={label}
                  certidao={certPorTipo[tipo] ?? null}
                  faturamento={fat}
                  onSalva={handleCertidaoSalva}
                  onRemovida={handleCertidaoRemovida}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
