"use client";

import { useState, useCallback } from "react";
import { UserPlus, Pencil, Trash2, Mail, Clock, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ConvidarUsuarioModal } from "./ConvidarUsuarioModal";
import { EditarPerfilModal } from "./EditarPerfilModal";
import { DeletarUsuarioModal } from "./DeletarUsuarioModal";

const PERFIL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  gestor:      { label: "Gestor",      color: "#00246D", bg: "#EEF2FF" },
  faturamento: { label: "Faturamento", color: "#7C3AED", bg: "#F5F3FF" },
  midia:       { label: "Mídia",       color: "#2E60FF", bg: "#EEF2FF" },
  producao:    { label: "Produção",    color: "#059669", bg: "#ECFDF5" },
};

type User = {
  id: string;
  email: string;
  nome: string;
  role: string;
  role_label: string;
  confirmed: boolean;
  last_sign_in: string | null;
  created_at: string;
};

export function UsuariosClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const [users, setUsers]           = useState<User[]>(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editando, setEditando]     = useState<User | null>(null);
  const [deletando, setDeletando]   = useState<User | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const json = await res.json();
      setUsers(json.users);
    }
  }, []);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            {users.length} usuário{users.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            Gerencie quem tem acesso e qual perfil cada um possui
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <UserPlus className="w-4 h-4" /> Convidar usuário
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {users.length === 0 ? (
          <div className="py-16 text-center">
            <UserPlus className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
            <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#64748B" }}>Usuário</th>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#64748B" }}>Perfil</th>
                <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "#64748B" }}>Último acesso</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const perfil  = PERFIL_CONFIG[u.role];
                const isSelf  = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {/* Usuário */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: perfil?.color ?? "#94A3B8" }}
                        >
                          {(u.nome || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {u.nome ? (
                            <>
                              <p className="font-medium truncate" style={{ color: "#0F172A" }}>
                                {u.nome}
                                {isSelf && (
                                  <span className="ml-1.5 text-xs font-normal" style={{ color: "#94A3B8" }}>(você)</span>
                                )}
                              </p>
                              <p className="text-xs truncate" style={{ color: "#94A3B8" }}>{u.email}</p>
                            </>
                          ) : (
                            <p className="font-medium truncate" style={{ color: "#0F172A" }}>
                              {u.email}
                              {isSelf && (
                                <span className="ml-1.5 text-xs font-normal" style={{ color: "#94A3B8" }}>(você)</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Perfil */}
                    <td className="px-5 py-3.5">
                      {perfil ? (
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: perfil.bg, color: perfil.color }}
                        >
                          {perfil.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#D97706" }}>
                          <AlertTriangle className="w-3 h-3" /> Sem perfil
                        </span>
                      )}
                      {!u.confirmed && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#FFFBEB", color: "#92400E" }}
                        >
                          <Mail className="w-2.5 h-2.5" /> Convite pendente
                        </span>
                      )}
                    </td>

                    {/* Último acesso */}
                    <td className="px-5 py-3.5">
                      {u.last_sign_in ? (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
                          <Clock className="w-3 h-3" />
                          {formatDate(u.last_sign_in)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "#CBD5E1" }}>Nunca acessou</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditando(u)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Editar perfil"
                        >
                          <Pencil className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => setDeletando(u)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "#CBD5E1" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#CBD5E1")}
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modais */}
      <ConvidarUsuarioModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { setInviteOpen(false); reload(); }}
      />

      {editando && (
        <EditarPerfilModal
          key={editando.id}
          user={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); reload(); }}
        />
      )}

      {deletando && (
        <DeletarUsuarioModal
          key={deletando.id}
          user={deletando}
          onClose={() => setDeletando(null)}
          onDeleted={() => { setDeletando(null); reload(); }}
        />
      )}
    </>
  );
}
