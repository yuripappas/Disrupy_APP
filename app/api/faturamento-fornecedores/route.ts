import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// PATCH /api/faturamento-fornecedores
// Associa um fornecedor pendente a um cadastro existente
// Body: { ffId: string, fornecedorId: string }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  if (role !== "gestor" && role !== "faturamento") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { ffId, fornecedorId } = body as { ffId: string; fornecedorId: string };

  if (!ffId || !fornecedorId) {
    return NextResponse.json({ error: "ffId e fornecedorId são obrigatórios" }, { status: 400 });
  }

  // Verifica se o registro existe e está pendente
  const { data: ff, error: ffErr } = await supabase
    .from("faturamento_fornecedores")
    .select("id, associado")
    .eq("id", ffId)
    .single();

  if (ffErr || !ff) {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  // Verifica se o fornecedor existe
  const { data: forn, error: fornErr } = await supabase
    .from("fornecedores")
    .select("id")
    .eq("id", fornecedorId)
    .single();

  if (fornErr || !forn) {
    return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  }

  // Atualiza: associa o fornecedor
  const { error: updateErr } = await supabase
    .from("faturamento_fornecedores")
    .update({
      fornecedor_id: fornecedorId,
      associado: true,
    })
    .eq("id", ffId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PUT /api/faturamento-fornecedores
// Atualiza campos de um faturamento_fornecedor.
// Body: { ffId: string, numeroOsPi?: string, orcamentosInternosHabilitado?: boolean }
export async function PUT(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  if (role !== "gestor" && role !== "faturamento") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { ffId, numeroOsPi, orcamentosInternosHabilitado } = body as {
    ffId: string;
    numeroOsPi?: string;
    orcamentosInternosHabilitado?: boolean;
  };

  if (!ffId) {
    return NextResponse.json({ error: "ffId é obrigatório" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (numeroOsPi !== undefined) updateData.numero_os_pi = numeroOsPi ?? null;
  if (orcamentosInternosHabilitado !== undefined) {
    updateData.orcamentos_internos_habilitado = orcamentosInternosHabilitado;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("faturamento_fornecedores")
    .update(updateData)
    .eq("id", ffId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/faturamento-fornecedores?id=ffId
// Remove um fornecedor de um faturamento (apenas gestores e faturamento)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const role = user.app_metadata?.role;
  if (role !== "gestor" && role !== "faturamento") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Verifica que o registro existe antes de excluir
  const { data: ff } = await admin
    .from("faturamento_fornecedores")
    .select("id, envio_inicial_em")
    .eq("id", id)
    .single();

  if (!ff) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  // Não permite excluir se o link já foi enviado (faturamento em andamento)
  if (ff.envio_inicial_em) {
    return NextResponse.json(
      { error: "Não é possível excluir um fornecedor após o envio do link. Contate um gestor." },
      { status: 409 },
    );
  }

  const { error: delErr } = await admin
    .from("faturamento_fornecedores")
    .delete()
    .eq("id", id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
