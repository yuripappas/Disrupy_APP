import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Admin client using service role key — server-side only
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Guard: only gestors can call these endpoints
async function requireGestor() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "gestor") {
    return null;
  }
  return user;
}

const ROLE_LABELS: Record<string, string> = {
  gestor:      "Gestor",
  midia:       "Mídia",
  producao:    "Produção",
  faturamento: "Faturamento",
};

// ── GET /api/admin/users — list all users ─────────────────────────────────────
export async function GET() {
  const caller = await requireGestor();
  if (!caller) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id:           u.id,
    email:        u.email ?? "",
    nome:         (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? "",
    role:         (u.app_metadata?.role as string) ?? "",
    role_label:   ROLE_LABELS[(u.app_metadata?.role as string) ?? ""] ?? "—",
    confirmed:    !!u.email_confirmed_at,
    last_sign_in: u.last_sign_in_at ?? null,
    created_at:   u.created_at,
  }));

  return NextResponse.json({ users });
}

// ── POST /api/admin/users — invite user ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await requireGestor();
  if (!caller) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: "email e role são obrigatórios" }, { status: 400 });
  if (!ROLE_LABELS[role]) return NextResponse.json({ error: "Role inválido" }, { status: 400 });

  const admin = adminClient();

  // Invite by email — Supabase sends the invite link automatically
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {},
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Set the role in app_metadata right after invite
  const { error: metaErr } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });

  return NextResponse.json({ success: true, userId: data.user.id });
}

// ── PATCH /api/admin/users — update role ─────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const caller = await requireGestor();
  if (!caller) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId || !role) return NextResponse.json({ error: "userId e role são obrigatórios" }, { status: 400 });
  if (!ROLE_LABELS[role]) return NextResponse.json({ error: "Role inválido" }, { status: 400 });

  // Prevent gestor from removing their own gestor role
  if (caller.id === userId && role !== "gestor") {
    return NextResponse.json({ error: "Você não pode remover seu próprio acesso de gestor" }, { status: 400 });
  }

  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
