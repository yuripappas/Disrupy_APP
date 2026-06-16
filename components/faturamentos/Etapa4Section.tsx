"use client";

import { useState, useCallback, useRef } from "react";
import {
  Copy, CheckCircle, AlertTriangle, Upload, FileText,
  Loader2, X, ExternalLink, Trash2, Plus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────

type FornecedorNf = {
  ffId: string;
  razaoSocial: string;
  cnpj: string | null;
  /** Valor base do fornecedor (sem honorários) — usado para cálculos */
  valor: number;
  /** Valor Líquido extraído da NFS-e em PDF — usado para exibição na discriminação */
  valorNf: string | null;
  numeroNf: string | null;
  nfStatus: string | null;
};

type Certidao = {
  id: string;
  tipo: string;
  label: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
};

// Tipos de certidões que a agência precisa anexar em cada faturamento
const TIPOS_CERTIDOES = [
  { tipo: "federal",     label: "Federal — Receita Federal + PGFN" },
  { tipo: "estadual",    label: "Estadual — SEFAZ-AL" },
  { tipo: "municipal",   label: "Municipal — SEMFAZ Maceió" },
  { tipo: "fgts",        label: "FGTS — Caixa Econômica Federal" },
  { tipo: "trabalhista", label: "Trabalhista — CNDT (TST)" },
  { tipo: "falencia",    label: "Certidão Negativa de Falência" },
];

const LIMITE_GISS = 2000;

// Subpastas no Drive por tipo de documento
function getSubpasta(tipo: string): string {
  if (tipo.startsWith("empenho_")) return "EMPENHOS";
  if (tipo === "proposta")    return "PROPOSTA";
  if (tipo === "evidencias")  return "EVIDÊNCIAS";
  if (tipo === "oficio")      return "OFÍCIO";
  return "CERTIDÕES";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function buildLinha(f: FornecedorNf): string {
  const nf       = `NFS-e ${f.numeroNf ?? "???"}`;
  const nome     = f.razaoSocial.toUpperCase();
  const cnpj     = f.cnpj ? `CNPJ: ${formatCnpj(f.cnpj)}` : "";
  const valorStr = f.valorNf ?? formatCurrency(f.valor).replace("R$ ", "").trim();
  const valor    = `R$ ${valorStr}`;
  return [nf, nome, cnpj, valor].filter(Boolean).join(" | ");
}

// Divide os fornecedores em blocos respeitando o limite de 2000 chars do GISS.
// Cada bloco contém apenas as linhas de NFS-e — sem cabeçalho nem rodapé.
function gerarNfseBlocos(
  fornecedores: FornecedorNf[],
): { texto: string; subtotal: number }[] {
  if (fornecedores.length === 0) return [];

  const linhas = fornecedores.map(buildLinha);
  const blocos: { texto: string; subtotal: number }[] = [];
  let grupo: number[] = [];

  function fecharBloco() {
    if (grupo.length === 0) return;
    const subtotal = grupo.reduce((s, i) => s + fornecedores[i].valor, 0);
    const texto    = grupo.map((i) => linhas[i]).join("\n");
    blocos.push({ texto, subtotal });
    grupo = [];
  }

  for (let i = 0; i < fornecedores.length; i++) {
    const candidato = [...grupo, i];
    const texto     = candidato.map((j) => linhas[j]).join("\n");

    if (texto.length > LIMITE_GISS && grupo.length > 0) {
      fecharBloco();
      grupo = [i];
    } else {
      grupo = candidato;
    }
  }
  fecharBloco();

  return blocos;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    setErro(null);

    const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!scriptUrl) { setErro("Upload não configurado."); setUploading(false); return; }

    try {
      // Base64
      const fileContent = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const ano = new Date().getFullYear();
      const nomeArquivo = `CERT_${tipo.toUpperCase()}_${file.name}`;

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
          jobId:        faturamento.jobId ?? `FAT`,
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
    if (!certidao || !confirm("Remover esta certidão?")) return;
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
            <input ref={inputRef} id={`cert-input-${tipo}`} type="file"
              accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
            <label
              htmlFor={`cert-input-${tipo}`}
              onClick={(e) => { if (uploading) e.preventDefault(); }}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: "#EEF2FF", color: "#2E60FF", opacity: uploading ? 0.6 : 1, cursor: uploading ? "not-allowed" : "pointer" }}
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
  clienteTipo,
  clienteNome,
  fornecedoresNf,
  certidoesIniciais,
}: {
  faturamentoId: string;
  nomeCampanha: string;
  jobId: string | null;
  propostaId: string | null;
  clienteTipo: string;
  clienteNome: string;
  fornecedoresNf: FornecedorNf[];
  certidoesIniciais: Certidao[];
}) {
  const [certidoes, setCertidoes] = useState<Certidao[]>(certidoesIniciais);

  // Conta quantos slots de empenho existem (mínimo 1)
  const [empenhoCount, setEmpenhoCount] = useState(() => {
    const n = certidoesIniciais.filter((c) => c.tipo.startsWith("empenho_")).length;
    return Math.max(1, n);
  });

  const handleCertidaoSalva = useCallback((c: Certidao) => {
    setCertidoes((prev) => {
      // Para tipos únicos substitui; para empenhos apenas adiciona/atualiza pelo id
      const sem = prev.filter((x) => x.tipo !== c.tipo);
      return [...sem, c];
    });
  }, []);

  const handleCertidaoRemovida = useCallback((tipo: string) => {
    setCertidoes((prev) => prev.filter((c) => c.tipo !== tipo));
  }, []);

  // Fornecedores com NF doc mas sem número (bloqueadores)
  const nfPendentes = fornecedoresNf.filter(
    (f) => !f.numeroNf || f.nfStatus === "falhou",
  );
  const bloqueado = nfPendentes.length > 0;

  const blocos = bloqueado ? [] : gerarNfseBlocos(fornecedoresNf);

  const totalGeral  = fornecedoresNf.reduce((s, f) => s + f.valor, 0);
  const certPorTipo = Object.fromEntries(certidoes.map((c) => [c.tipo, c]));
  const certPendentes = TIPOS_CERTIDOES.filter((t) => !certPorTipo[t.tipo]).length;

  const empenhoTipos = Array.from({ length: empenhoCount }, (_, i) => `empenho_${i}`);
  const empenhosPendentes = empenhoTipos.filter((t) => !certPorTipo[t]).length;

  const fat = { nomeCampanha, jobId, clienteTipo, clienteNome };

  return (
    <div className="mt-6">
      {/* Título */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>Etapa 4 — Documentação da Agência</h2>
        <div className="flex items-center gap-2">
          {bloqueado && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
            >
              <AlertTriangle className="w-3 h-3" />
              {nfPendentes.length} NF{nfPendentes.length > 1 ? "s" : ""} faltando
            </span>
          )}
          {!bloqueado && fornecedoresNf.length > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#ECFDF5", color: "#059669" }}
            >
              <CheckCircle className="w-3 h-3" />
              Discriminação pronta
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Discriminação ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Discriminação para GISS Online</p>
            {!bloqueado && blocos.length > 1 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
                {blocos.length} NFS-e
              </span>
            )}
          </div>

          {/* Bloqueado */}
          {bloqueado && (
            <div className="px-5 py-6 flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="w-8 h-8" style={{ color: "#F59E0B" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                  Aguardando número{nfPendentes.length > 1 ? "s" : ""} de NF
                </p>
                <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                  {nfPendentes.length} fornecedor{nfPendentes.length > 1 ? "es precisam" : " precisa"} de número de NF para gerar a discriminação.
                  Verifique os documentos acima e insira manualmente se necessário.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {nfPendentes.map((f) => (
                  <span key={f.ffId}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                    {f.razaoSocial}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sem fornecedores */}
          {!bloqueado && fornecedoresNf.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs" style={{ color: "#94A3B8" }}>Nenhum fornecedor com NF neste faturamento.</p>
            </div>
          )}

          {/* Blocos de NFS-e */}
          {!bloqueado && blocos.map((bloco, idx) => (
            <div
              key={idx}
              className="px-5 py-4"
              style={{ borderTop: idx > 0 ? "1px solid #E2E8F0" : undefined }}
            >
              {blocos.length > 1 && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold" style={{ color: "#2E60FF" }}>
                    NFS-e {idx + 1} de {blocos.length}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold" style={{ color: "#334155" }}>
                      {formatCurrency(bloco.subtotal)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: bloco.texto.length > LIMITE_GISS * 0.9 ? "#FEF3C7" : "#F1F5F9",
                        color: bloco.texto.length > LIMITE_GISS * 0.9 ? "#D97706" : "#64748B",
                      }}
                    >
                      {bloco.texto.length}/{LIMITE_GISS} chars
                    </span>
                    <CopyButton texto={bloco.texto} />
                  </div>
                </div>
              )}
              {blocos.length === 1 && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "#334155" }}>
                      Total: {formatCurrency(totalGeral)}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: bloco.texto.length > LIMITE_GISS * 0.9 ? "#FEF3C7" : "#F1F5F9",
                        color: bloco.texto.length > LIMITE_GISS * 0.9 ? "#D97706" : "#64748B",
                      }}
                    >
                      {bloco.texto.length}/{LIMITE_GISS} chars
                    </span>
                  </div>
                  <CopyButton texto={bloco.texto} />
                </div>
              )}
              <pre
                className="text-xs rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed"
                style={{ backgroundColor: "#F1F5F9", color: "#334155" }}
              >
                {bloco.texto}
              </pre>
            </div>
          ))}
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
                label={`Empenho ${empenhoCount > 1 ? idx + 1 : ""}`}
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
