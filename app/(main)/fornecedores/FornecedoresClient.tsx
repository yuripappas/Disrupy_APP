"use client";

import { useState } from "react";
import {
  Plus, Mail, MessageCircle, Phone, MapPin, Search,
  ExternalLink, Pencil, AlertTriangle, User, Check, X, Loader2,
} from "lucide-react";
import { NovoFornecedorModal } from "@/components/fornecedores/NovoFornecedorModal";
import { EditarFornecedorModal } from "@/components/fornecedores/EditarFornecedorModal";

function formatWhatsApp(num: string) {
  const n = (num || "").replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return num;
}

type Fornecedor = {
  id: string; razao_social: string; cnpj?: string; tipo: "midia" | "producao";
  contato_nome?: string; contato_whatsapp?: string; contato_email?: string;
  telefone?: string; email?: string; endereco?: string; cidade?: string; uf?: string;
  site?: string; ativo: boolean;
};

type ContactFields = {
  contato_nome: string | null;
  contato_whatsapp: string | null;
  contato_email: string | null;
};

// ── Linha da tabela com inline edit de contatos ──────────────────────────────

function FornecedorRow({
  fornecedor,
  rowIndex,
  total,
  onFullEdit,
  onContactUpdated,
}: {
  fornecedor: Fornecedor;
  rowIndex: number;
  total: number;
  onFullEdit: (f: Fornecedor) => void;
  onContactUpdated: (id: string, fields: ContactFields) => void;
}) {
  const [editContato, setEditContato] = useState(false);
  const [salvando,    setSalvando]    = useState(false);
  const [erro,        setErro]        = useState<string | null>(null);
  const [form, setForm] = useState<{ contato_nome: string; contato_whatsapp: string; contato_email: string }>({
    contato_nome:     fornecedor.contato_nome     ?? "",
    contato_whatsapp: fornecedor.contato_whatsapp ?? "",
    contato_email:    fornecedor.contato_email    ?? "",
  });

  const semWa    = !fornecedor.contato_whatsapp;
  const semEmail = !fornecedor.contato_email;
  const semNome  = !fornecedor.contato_nome;
  const incompleto = semWa || semEmail || semNome;

  const emailPrincipal    = fornecedor.contato_email || fornecedor.email;
  const telefonePrincipal = fornecedor.contato_whatsapp || fornecedor.telefone;
  const isWhatsApp        = !!fornecedor.contato_whatsapp;

  function abrirEdicaoContato() {
    setForm({
      contato_nome:     fornecedor.contato_nome     ?? "",
      contato_whatsapp: fornecedor.contato_whatsapp ?? "",
      contato_email:    fornecedor.contato_email    ?? "",
    });
    setErro(null);
    setEditContato(true);
  }

  async function salvarContato() {
    setSalvando(true);
    setErro(null);
    const payload: ContactFields = {
      contato_nome:     form.contato_nome.trim()     || null,
      contato_whatsapp: form.contato_whatsapp.trim() || null,
      contato_email:    form.contato_email.trim()    || null,
    };
    const res  = await fetch(`/api/fornecedores/${fornecedor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSalvando(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao salvar"); return; }
    onContactUpdated(fornecedor.id, {
      contato_nome:     data.fornecedor.contato_nome,
      contato_whatsapp: data.fornecedor.contato_whatsapp,
      contato_email:    data.fornecedor.contato_email,
    });
    setEditContato(false);
  }

  const hasBorder = rowIndex < total - 1;
  const rowBg     = incompleto && !editContato ? "#FFFBEB"
                  : rowIndex % 2 === 0 ? "white" : "#FAFAFA";

  return (
    <>
      {/* Linha principal */}
      <tr style={{
        borderBottom: hasBorder && !editContato ? "1px solid #F1F5F9" : "none",
        backgroundColor: rowBg,
      }}>
        {/* Nome / CNPJ */}
        <td className="px-4 py-3">
          <div className="font-medium" style={{ color: "#0F172A" }}>{fornecedor.razao_social}</div>
          {fornecedor.cnpj && (
            <div className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{fornecedor.cnpj}</div>
          )}
          {fornecedor.site && (
            <a
              href={fornecedor.site.startsWith("http") ? fornecedor.site : `https://${fornecedor.site}`}
              target="_blank"
              className="flex items-center gap-1 text-xs mt-0.5 hover:underline"
              style={{ color: "#64748B" }}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="truncate max-w-[160px]">{fornecedor.site.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
        </td>

        {/* Localização */}
        <td className="px-4 py-3">
          {(fornecedor.cidade || fornecedor.uf) ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: "#64748B" }}>
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {[fornecedor.cidade, fornecedor.uf].filter(Boolean).join(" · ")}
            </div>
          ) : (
            <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
          )}
        </td>

        {/* Contato */}
        <td className="px-4 py-3">
          {fornecedor.contato_nome ? (
            <span className="text-xs" style={{ color: "#334155" }}>{fornecedor.contato_nome}</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#F1F5F9", color: "#94A3B8" }}>
              Sem nome
            </span>
          )}
        </td>

        {/* E-mail */}
        <td className="px-4 py-3">
          {emailPrincipal ? (
            <a href={`mailto:${emailPrincipal}`}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: "#2E60FF" }}>
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[200px]">{emailPrincipal}</span>
            </a>
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
              <AlertTriangle className="w-3 h-3" /> Sem e-mail
            </span>
          )}
        </td>

        {/* Telefone / WhatsApp */}
        <td className="px-4 py-3">
          {telefonePrincipal ? (
            isWhatsApp ? (
              <a href={`https://wa.me/55${fornecedor.contato_whatsapp!.replace(/\D/g, "")}`}
                target="_blank"
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: "#059669" }}>
                <MessageCircle className="w-3 h-3" />
                {formatWhatsApp(telefonePrincipal)}
              </a>
            ) : (
              <span className="flex items-center gap-1 text-xs" style={{ color: "#64748B" }}>
                <Phone className="w-3 h-3" />{telefonePrincipal}
              </span>
            )
          ) : (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              <AlertTriangle className="w-3 h-3" /> Sem WhatsApp
            </span>
          )}
        </td>

        {/* Ações */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-1 justify-end">
            {incompleto && !editContato && (
              <button
                onClick={abrirEdicaoContato}
                title="Corrigir contatos"
                className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <User className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
              </button>
            )}
            <button
              onClick={() => onFullEdit(fornecedor)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Editar fornecedor"
            >
              <Pencil className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
            </button>
          </div>
        </td>
      </tr>

      {/* Formulário inline de edição de contatos */}
      {editContato && (
        <tr style={{
          backgroundColor: "#FFFBEB",
          borderBottom: hasBorder ? "1px solid #F1F5F9" : "none",
        }}>
          <td colSpan={6} className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>Nome do contato</span>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                  <User className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                  <input
                    type="text"
                    value={form.contato_nome}
                    onChange={(e) => setForm((f) => ({ ...f, contato_nome: e.target.value }))}
                    placeholder="João Silva"
                    className="flex-1 text-xs outline-none bg-transparent"
                    style={{ color: "#0F172A" }}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>WhatsApp</span>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                  <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                  <input
                    type="tel"
                    value={form.contato_whatsapp}
                    onChange={(e) => setForm((f) => ({ ...f, contato_whatsapp: e.target.value }))}
                    placeholder="5582999999999"
                    className="flex-1 text-xs font-mono outline-none bg-transparent"
                    style={{ color: "#0F172A" }}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>E-mail do contato</span>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                  <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                  <input
                    type="email"
                    value={form.contato_email}
                    onChange={(e) => setForm((f) => ({ ...f, contato_email: e.target.value }))}
                    placeholder="contato@empresa.com"
                    className="flex-1 text-xs outline-none bg-transparent"
                    style={{ color: "#0F172A" }}
                  />
                </div>
              </label>
            </div>

            {erro && <p className="text-xs mt-2" style={{ color: "#DC2626" }}>⚠ {erro}</p>}

            <div className="flex gap-2 mt-3">
              <button
                onClick={salvarContato}
                disabled={salvando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: salvando ? "#94A3B8" : "#2E60FF" }}
              >
                {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() => { setEditContato(false); setErro(null); }}
                disabled={salvando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Tabela com sort (incompletos primeiro) ────────────────────────────────────

function FornecedorTable({
  fornecedores,
  onFullEdit,
  onContactUpdated,
}: {
  fornecedores: Fornecedor[];
  onFullEdit: (f: Fornecedor) => void;
  onContactUpdated: (id: string, fields: ContactFields) => void;
}) {
  const sorted = [...fornecedores].sort((a, b) => {
    const aInc = !a.contato_whatsapp || !a.contato_email || !a.contato_nome ? 0 : 1;
    const bInc = !b.contato_whatsapp || !b.contato_email || !b.contato_nome ? 0 : 1;
    return aInc - bInc;
  });

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Nome / CNPJ</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Localização</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Contato</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>E-mail</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Telefone / WhatsApp</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <FornecedorRow
              key={f.id}
              fornecedor={f}
              rowIndex={i}
              total={sorted.length}
              onFullEdit={onFullEdit}
              onContactUpdated={onContactUpdated}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cabeçalho de grupo com badges de alertas ─────────────────────────────────

function GrupoHeader({
  label, color, tipoLabel, items,
}: {
  label: string; color: string; tipoLabel: string; items: Fornecedor[];
}) {
  const semWa    = items.filter((f) => !f.contato_whatsapp).length;
  const semEmail = items.filter((f) => !f.contato_email).length;
  const semNome  = items.filter((f) => !f.contato_nome).length;

  return (
    <div className="flex items-center gap-3 mb-2 flex-wrap">
      <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
        style={{ backgroundColor: color }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: "#94A3B8" }}>{items.length} {tipoLabel}</span>
      {semWa > 0 && (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
          <AlertTriangle className="w-3 h-3" />{semWa} sem WhatsApp
        </span>
      )}
      {semEmail > 0 && (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
          <AlertTriangle className="w-3 h-3" />{semEmail} sem e-mail
        </span>
      )}
      {semNome > 0 && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}>
          {semNome} sem nome
        </span>
      )}
      <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FornecedoresClient({ fornecedores: inicial }: { fornecedores: Fornecedor[] }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(inicial);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editando,     setEditando]     = useState<Fornecedor | null>(null);
  const [busca,        setBusca]        = useState("");
  const [tipoFiltro,   setTipoFiltro]   = useState<"todos" | "midia" | "producao">("todos");

  function handleSaved(updated: Fornecedor) {
    if (!updated.ativo) {
      setFornecedores((prev) => prev.filter((f) => f.id !== updated.id));
    } else {
      setFornecedores((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    }
    setEditando(null);
  }

  function handleContactUpdated(id: string, fields: ContactFields) {
    setFornecedores((prev) => prev.map((f) =>
      f.id === id
        ? {
            ...f,
            contato_nome:     fields.contato_nome     ?? undefined,
            contato_whatsapp: fields.contato_whatsapp ?? undefined,
            contato_email:    fields.contato_email    ?? undefined,
          }
        : f,
    ));
  }

  const filtrados = fornecedores.filter((f) => {
    const matchTipo  = tipoFiltro === "todos" || f.tipo === tipoFiltro;
    const q          = busca.toLowerCase();
    const matchBusca = !q
      || f.razao_social.toLowerCase().includes(q)
      || (f.cnpj             ?? "").includes(q)
      || (f.cidade           ?? "").toLowerCase().includes(q)
      || (f.contato_nome     ?? "").toLowerCase().includes(q)
      || (f.contato_email    ?? "").toLowerCase().includes(q)
      || (f.email            ?? "").toLowerCase().includes(q);
    return matchTipo && matchBusca;
  });

  const midia    = filtrados.filter((f) => f.tipo === "midia");
  const producao = filtrados.filter((f) => f.tipo === "producao");

  // Alertas calculados sobre a lista completa (independente do filtro)
  const totalBloqueados = fornecedores.filter((f) => !f.contato_whatsapp || !f.contato_email).length;
  const totalSemWa      = fornecedores.filter((f) => !f.contato_whatsapp).length;
  const totalSemEmail   = fornecedores.filter((f) => !f.contato_email).length;

  return (
    <div className="p-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Fornecedores</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {fornecedores.filter((f) => f.tipo === "midia").length} de mídia ·{" "}
            {fornecedores.filter((f) => f.tipo === "producao").length} de produção
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      {/* Banner de alertas */}
      {totalBloqueados > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-5"
          style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
              {totalBloqueados}{" "}
              {totalBloqueados === 1 ? "fornecedor bloqueado" : "fornecedores bloqueados"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#B91C1C" }}>
              Sem WhatsApp ou e-mail cadastrado — mensagens automáticas não serão enviadas.
              {totalSemWa    > 0 && ` · ${totalSemWa} sem WhatsApp`}
              {totalSemEmail > 0 && ` · ${totalSemEmail} sem e-mail`}
              {" "}Clique no ícone{" "}
              <User className="w-3 h-3 inline" style={{ color: "#D97706" }} />
              {" "}para corrigir rapidamente.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none focus:border-blue-400"
            style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", color: "#334155" }}
          />
        </div>
        {(["todos", "midia", "producao"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipoFiltro(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor:       tipoFiltro === t ? "#2E60FF" : "#E2E8F0",
              backgroundColor:   tipoFiltro === t ? "#EEF2FF" : "white",
              color:             tipoFiltro === t ? "#2E60FF" : "#64748B",
            }}
          >
            {t === "todos" ? "Todos" : t === "midia" ? "Mídia" : "Produção"}
          </button>
        ))}
        {busca && (
          <p className="text-xs ml-1" style={{ color: "#94A3B8" }}>{filtrados.length} resultado(s)</p>
        )}
      </div>

      {/* Conteúdo */}
      {fornecedores.length === 0 ? (
        <div className="text-center py-20" style={{ color: "#94A3B8" }}>
          <p className="text-lg font-medium mb-2">Nenhum fornecedor cadastrado</p>
          <p className="text-sm">Clique em &quot;Novo Fornecedor&quot; para adicionar o primeiro.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20" style={{ color: "#94A3B8" }}>
          <p className="text-sm">Nenhum fornecedor encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <>
          {midia.length > 0 && (
            <div className="mb-6">
              <GrupoHeader label="Mídia"    color="#00246D" tipoLabel="veículos"    items={midia} />
              <FornecedorTable
                fornecedores={midia}
                onFullEdit={setEditando}
                onContactUpdated={handleContactUpdated}
              />
            </div>
          )}
          {producao.length > 0 && (
            <div>
              <GrupoHeader label="Produção" color="#7C3AED" tipoLabel="fornecedores" items={producao} />
              <FornecedorTable
                fornecedores={producao}
                onFullEdit={setEditando}
                onContactUpdated={handleContactUpdated}
              />
            </div>
          )}
        </>
      )}

      <NovoFornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditarFornecedorModal
        key={editando?.id ?? ""}
        fornecedor={editando}
        onClose={() => setEditando(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
