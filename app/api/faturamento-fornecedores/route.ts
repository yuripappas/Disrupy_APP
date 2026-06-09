import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
