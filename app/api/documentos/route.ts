import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/documentos — aprovar ou reprovar um documento
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const role = user.app_metadata?.role as string;
  if (role !== "gestor" && role !== "faturamento") {
    return NextResponse.json({ error: "Sem permissão. Apenas Gestor e Faturamento podem revisar documentos." }, { status: 403 });
  }

  const { documentoId, acao, motivo } = await req.json();

  if (!documentoId || !acao) {
    return NextResponse.json({ error: "documentoId e acao são obrigatórios" }, { status: 400 });
  }
  if (acao !== "aprovar" && acao !== "reprovar") {
    return NextResponse.json({ error: "acao deve ser 'aprovar' ou 'reprovar'" }, { status: 400 });
  }
  if (acao === "reprovar" && !motivo?.trim()) {
    return NextResponse.json({ error: "Motivo é obrigatório para reprovar" }, { status: 400 });
  }

  const updates =
    acao === "aprovar"
      ? {
          status: "aprovado",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          reprovacao_motivo: null,
        }
      : {
          status: "reprovado",
          reprovacao_motivo: motivo.trim(),
          aprovado_por: null,
          aprovado_em: null,
        };

  const { error } = await supabase
    .from("documentos")
    .update(updates)
    .eq("id", documentoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
