/**
 * POST /api/publicacao/gerar-pdf
 *
 * Gera o PDF consolidado do processo de faturamento.
 * Cria um documento A4 com sumário, seção por bloco e links clicáveis
 * para cada arquivo no Google Drive.
 *
 * Body: {
 *   faturamentoId: string
 *   blockOrder?:   string[]  — IDs dos blocos na ordem definida na Etapa 4
 * }
 *
 * Retorna: application/pdf (binário)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import {
  PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFArray,
} from 'pdf-lib';

// ── Palette ───────────────────────────────────────────────────────────────────

const COR_AZUL_ESCURO  = rgb(0.000, 0.145, 0.431);  // #00246D
const COR_AZUL         = rgb(0.180, 0.376, 1.000);  // #2E60FF
const COR_VERDE        = rgb(0.022, 0.588, 0.412);  // #059669
const COR_ROXO         = rgb(0.486, 0.231, 0.929);  // #7C3AED
const COR_CINZA        = rgb(0.392, 0.455, 0.545);  // #64748B
const COR_CINZA_CLARO  = rgb(0.882, 0.910, 0.941);  // #E2E8F0
const COR_PRETO        = rgb(0.059, 0.090, 0.165);  // #0F172A
const COR_BRANCO       = rgb(1.000, 1.000, 1.000);
const COR_AMARELO      = rgb(0.851, 0.467, 0.024);  // #D97706
const COR_BG_AZUL      = rgb(0.933, 0.945, 1.000);  // #EEF2FF

// A4 em pontos
const A4_W    = 595.28;
const A4_H    = 841.89;
const MARGIN  = 50;
const CONTENT_W = A4_W - MARGIN * 2;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DocItem {
  label:       string;
  status:      string;
  arquivo_url: string | null;
  tipo?:       string | null;
}

interface Bloco {
  id:     string;
  tipo:   'agencia' | 'producao' | 'midia';
  titulo: string;
  cnpj?:  string | null;
  docs:   DocItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type EmbeddedFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

function adicionarLink(
  page: ReturnType<PDFDocument['getPage']>,
  url: string, x: number, y: number, w: number, h: number,
) {
  const { doc } = page;
  const annot = doc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: doc.context.obj([x, y, x + w, y + h]),
    Border: doc.context.obj([0, 0, 0]),
    A: doc.context.obj({
      Type: PDFName.of('Action'),
      S: PDFName.of('URI'),
      URI: PDFString.of(url),
    }),
  });
  const annotRef = doc.context.register(annot);
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existing) {
    existing.push(annotRef);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([annotRef]));
  }
}

function wrapText(text: string, font: EmbeddedFont, size: number, maxW: number): string[] {
  const words  = text.split(' ');
  const lines: string[] = [];
  let current  = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const w    = font.widthOfTextAtSize(test, size);
    if (w > maxW && current) { lines.push(current); current = word; }
    else { current = test; }
  }
  if (current) lines.push(current);
  return lines;
}

function corPorStatus(status: string): ReturnType<typeof rgb> {
  if (status === 'aprovado')  return COR_VERDE;
  if (status === 'reprovado') return rgb(0.937, 0.267, 0.267);
  if (status === 'enviado')   return COR_AMARELO;
  return COR_CINZA;
}

function labelStatus(status: string): string {
  if (status === 'aprovado')  return 'OK';
  if (status === 'reprovado') return 'XX';
  if (status === 'enviado')   return '~~';
  return '..';
}

// ── Gerador ───────────────────────────────────────────────────────────────────

async function gerarPdf(
  blocos:       Bloco[],
  nomeCampanha: string,
  clienteNome:  string,
  dataGeracao:  string,
): Promise<Uint8Array> {
  const pdf         = await PDFDocument.create();
  const fontBold    = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);

  const totalDocs      = blocos.reduce((s, b) => s + b.docs.length, 0);
  const totalAprovados = blocos.reduce(
    (s, b) => s + b.docs.filter(d => d.status === 'aprovado').length, 0,
  );

  // ── 1. Capa ────────────────────────────────────────────────────────────────
  {
    const pg = pdf.addPage([A4_W, A4_H]);

    // Banner superior
    pg.drawRectangle({ x: 0, y: A4_H - 200, width: A4_W, height: 200, color: COR_AZUL_ESCURO });

    pg.drawText('PROCESSO DE FATURAMENTO', {
      x: MARGIN, y: A4_H - 78, size: 20, font: fontBold, color: COR_BRANCO,
    });

    const linhasCamp = wrapText(nomeCampanha.toUpperCase(), fontBold, 14, CONTENT_W);
    linhasCamp.slice(0, 2).forEach((l, i) => {
      pg.drawText(l, { x: MARGIN, y: A4_H - 108 - i * 20, size: 14, font: fontBold, color: COR_BRANCO });
    });

    pg.drawText(clienteNome, {
      x: MARGIN, y: A4_H - 148, size: 10, font: fontRegular, color: rgb(0.7, 0.8, 1),
    });
    pg.drawText(`Gerado em: ${dataGeracao}`, {
      x: MARGIN, y: A4_H - 165, size: 9, font: fontRegular, color: rgb(0.6, 0.7, 0.9),
    });

    // Estatísticas
    const statsY  = A4_H - 258;
    const statW   = (CONTENT_W - 30) / 3;
    const stats   = [
      { label: 'BLOCOS',      valor: String(blocos.length) },
      { label: 'DOCUMENTOS',  valor: String(totalDocs) },
      { label: 'APROVADOS',   valor: String(totalAprovados) },
    ];
    stats.forEach((s, i) => {
      const sx = MARGIN + i * (statW + 15);
      pg.drawRectangle({ x: sx, y: statsY - 40, width: statW, height: 60, color: COR_BG_AZUL, borderColor: COR_CINZA_CLARO, borderWidth: 1 });
      pg.drawText(s.label, { x: sx + 10, y: statsY - 10, size: 8, font: fontRegular, color: COR_CINZA });
      pg.drawText(s.valor, { x: sx + 10, y: statsY - 30, size: 18, font: fontBold, color: COR_AZUL_ESCURO });
    });

    pg.drawLine({ start: { x: MARGIN, y: 65 }, end: { x: A4_W - MARGIN, y: 65 }, thickness: 0.5, color: COR_CINZA_CLARO });
    pg.drawText('Documento gerado automaticamente pelo sistema de faturamento Disrupy.', {
      x: MARGIN, y: 50, size: 8, font: fontRegular, color: COR_CINZA,
    });
  }

  // ── 2. Sumário ─────────────────────────────────────────────────────────────
  {
    const pg = pdf.addPage([A4_W, A4_H]);
    pg.drawRectangle({ x: 0, y: A4_H - 70, width: A4_W, height: 70, color: COR_AZUL });
    pg.drawText('SUMARIO DO PROCESSO', {
      x: MARGIN, y: A4_H - 44, size: 16, font: fontBold, color: COR_BRANCO,
    });

    let y = A4_H - 120;

    blocos.forEach((bloco, idx) => {
      if (y < 80) return;
      const aprovados  = bloco.docs.filter(d => d.status === 'aprovado').length;
      const cor        = bloco.tipo === 'agencia' ? COR_AZUL : bloco.tipo === 'midia' ? COR_ROXO : COR_VERDE;
      const tipoLabel  = bloco.tipo === 'agencia' ? 'Agencia' : bloco.tipo === 'midia' ? 'Midia' : 'Producao';

      pg.drawRectangle({ x: MARGIN, y: y - 22, width: 6, height: 26, color: cor });
      pg.drawText(`${idx + 1}. ${bloco.titulo}`, {
        x: MARGIN + 16, y, size: 11, font: fontBold, color: COR_PRETO,
      });
      pg.drawText(`${tipoLabel}  ${aprovados}/${bloco.docs.length} aprovados`, {
        x: MARGIN + 16, y: y - 14, size: 8, font: fontRegular, color: COR_CINZA,
      });
      if (bloco.cnpj) {
        pg.drawText(bloco.cnpj, { x: A4_W - MARGIN - 130, y: y - 14, size: 8, font: fontRegular, color: COR_CINZA });
      }
      pg.drawText(`Bloco ${idx + 1}`, { x: A4_W - MARGIN - 40, y, size: 9, font: fontRegular, color: COR_CINZA });
      y -= 38;

      bloco.docs.forEach(doc => {
        if (y < 80) return;
        const corDoc = corPorStatus(doc.status);
        pg.drawText(`${labelStatus(doc.status)}  ${doc.label}`, {
          x: MARGIN + 20, y, size: 8, font: fontRegular, color: corDoc,
        });
        y -= 14;
      });

      y -= 12;
      pg.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: A4_W - MARGIN, y: y + 6 }, thickness: 0.3, color: COR_CINZA_CLARO });
      y -= 4;
    });
  }

  // ── 3. Seção por bloco ─────────────────────────────────────────────────────
  for (let bi = 0; bi < blocos.length; bi++) {
    const bloco     = blocos[bi];
    const cor       = bloco.tipo === 'agencia' ? COR_AZUL : bloco.tipo === 'midia' ? COR_ROXO : COR_VERDE;
    const tipoLabel = bloco.tipo === 'agencia' ? 'Agencia' : bloco.tipo === 'midia' ? 'Midia' : 'Producao';

    let pg = pdf.addPage([A4_W, A4_H]);
    let y  = A4_H - 30;

    // Header do bloco
    pg.drawRectangle({ x: 0, y: A4_H - 80, width: A4_W, height: 80, color: cor });
    pg.drawText(`BLOCO ${bi + 1}`, { x: MARGIN, y: A4_H - 28, size: 9, font: fontRegular, color: COR_BRANCO });
    pg.drawText(bloco.titulo.toUpperCase(), { x: MARGIN, y: A4_H - 48, size: 14, font: fontBold, color: COR_BRANCO });
    pg.drawText(tipoLabel, { x: MARGIN, y: A4_H - 65, size: 9, font: fontRegular, color: rgb(0.85, 0.92, 1) });
    if (bloco.cnpj) {
      pg.drawText(bloco.cnpj, { x: A4_W - MARGIN - 150, y: A4_H - 48, size: 9, font: fontRegular, color: COR_BRANCO });
    }

    y = A4_H - 110;

    const aprovados = bloco.docs.filter(d => d.status === 'aprovado').length;
    pg.drawText(`${aprovados} de ${bloco.docs.length} documentos aprovados`, {
      x: MARGIN, y, size: 9, font: fontRegular, color: COR_CINZA,
    });
    y -= 24;

    // Cada documento
    for (let di = 0; di < bloco.docs.length; di++) {
      const doc         = bloco.docs[di];
      const alturaCard  = doc.arquivo_url ? 72 : 46;

      // Nova página se necessário
      if (y < alturaCard + 40) {
        pg = pdf.addPage([A4_W, A4_H]);
        pg.drawRectangle({ x: 0, y: A4_H - 30, width: A4_W, height: 30, color: cor });
        pg.drawText(`${bloco.titulo} (cont.)`, { x: MARGIN, y: A4_H - 20, size: 8, font: fontRegular, color: COR_BRANCO });
        y = A4_H - 50;
      }

      const corBorda = corPorStatus(doc.status);

      // Card do documento
      pg.drawRectangle({
        x: MARGIN, y: y - alturaCard, width: CONTENT_W, height: alturaCard,
        color: COR_BRANCO, borderColor: COR_CINZA_CLARO, borderWidth: 0.5,
      });
      // Barra colorida esquerda
      pg.drawRectangle({ x: MARGIN, y: y - alturaCard, width: 4, height: alturaCard, color: corBorda });

      // Número
      pg.drawText(`${di + 1}`, { x: MARGIN + 12, y: y - 16, size: 8, font: fontRegular, color: COR_CINZA });

      // Status
      const statusText = doc.status === 'aprovado'  ? 'Aprovado'   :
                         doc.status === 'reprovado' ? 'Reprovado'  :
                         doc.status === 'enviado'   ? 'Em analise' :
                         'Pendente';
      pg.drawText(statusText, { x: A4_W - MARGIN - 70, y: y - 16, size: 8, font: fontBold, color: corBorda });

      // Label
      const linhasLabel = wrapText(doc.label, fontBold, 10, CONTENT_W - 120);
      linhasLabel.slice(0, 2).forEach((l, li) => {
        pg.drawText(l, { x: MARGIN + 30, y: y - 16 - li * 14, size: 10, font: fontBold, color: COR_PRETO });
      });

      // Link
      if (doc.arquivo_url) {
        const linkY     = y - alturaCard + 14;
        const linkLabel = 'Acessar no Google Drive';
        pg.drawText(linkLabel, { x: MARGIN + 12, y: linkY, size: 8, font: fontRegular, color: COR_AZUL });
        pg.drawLine({
          start:     { x: MARGIN + 12, y: linkY - 1 },
          end:       { x: MARGIN + 12 + fontRegular.widthOfTextAtSize(linkLabel, 8), y: linkY - 1 },
          thickness: 0.5, color: COR_AZUL,
        });
        adicionarLink(pg as ReturnType<PDFDocument['getPage']>, doc.arquivo_url, MARGIN + 10, linkY - 4, CONTENT_W - 20, 16);

        const urlTrunc = doc.arquivo_url.length > 80 ? doc.arquivo_url.slice(0, 80) + '...' : doc.arquivo_url;
        pg.drawText(urlTrunc, { x: MARGIN + 12, y: linkY - 11, size: 6, font: fontRegular, color: COR_CINZA });
      }

      y -= alturaCard + 8;
    }

    pg.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: A4_W - MARGIN, y: 44 }, thickness: 0.3, color: COR_CINZA_CLARO });
    pg.drawText(`Bloco ${bi + 1} de ${blocos.length}`, {
      x: MARGIN, y: 30, size: 8, font: fontRegular, color: COR_CINZA,
    });
  }

  // ── 4. Paginação ───────────────────────────────────────────────────────────
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: A4_W - MARGIN - 40, y: 20, size: 7, font: fontRegular, color: COR_CINZA,
    });
  });

  return pdf.save();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    faturamentoId: string;
    blockOrder?:   string[] | null;
  };
  const { faturamentoId, blockOrder } = body;

  if (!faturamentoId) {
    return Response.json({ error: 'faturamentoId obrigatorio' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: fat } = await admin
    .from('faturamentos')
    .select(`
      nome_campanha, cliente_nome,
      faturamento_fornecedores (
        id, nome_iclips, associado, tipo_iclips,
        fornecedor:fornecedores ( razao_social, cnpj, tipo ),
        documentos ( id, tipo, label, status, arquivo_url )
      ),
      faturamento_custos_internos (
        id, servico,
        custo_interno_documentos ( id, label, status, arquivo_url )
      )
    `)
    .eq('id', faturamentoId)
    .single();

  if (!fat) {
    return Response.json({ error: 'Faturamento nao encontrado' }, { status: 404 });
  }

  const { data: certidoes } = await admin
    .from('faturamento_certidoes')
    .select('id, tipo, label, arquivo_url')
    .eq('faturamento_id', faturamentoId)
    .order('created_at');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agenciaBlock: Bloco = {
    id:    '__agencia__',
    tipo:  'agencia',
    titulo: 'Agencia',
    docs: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(certidoes ?? []).map((c: any) => ({
        label:       c.label as string,
        status:      c.arquivo_url ? 'aprovado' : 'pendente',
        arquivo_url: (c.arquivo_url ?? null) as string | null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(fat.faturamento_custos_internos ?? []).flatMap((ci: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ci.custo_interno_documentos ?? []).map((d: any) => ({
          label:       `Peca - ${ci.servico}` as string,
          status:      (d.status ?? 'pendente') as string,
          arquivo_url: (d.arquivo_url ?? null) as string | null,
        })),
      ),
    ],
  };

  const fornBlocks: Bloco[] = (fat.faturamento_fornecedores ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((ff: any) => ff.associado !== false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ff: any): Bloco => ({
      id:    ff.id as string,
      tipo:  (ff.fornecedor?.tipo ?? ff.tipo_iclips ?? 'producao') as Bloco['tipo'],
      titulo: (ff.fornecedor?.razao_social ?? ff.nome_iclips ?? 'Fornecedor') as string,
      cnpj:  (ff.fornecedor?.cnpj ?? null) as string | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs:  (ff.documentos ?? []).map((d: any): DocItem => ({
        label:       (d.label ?? d.tipo ?? 'Documento') as string,
        status:      (d.status ?? 'pendente') as string,
        arquivo_url: (d.arquivo_url ?? null) as string | null,
        tipo:        (d.tipo ?? null) as string | null,
      })),
    }));

  const todos = [agenciaBlock, ...fornBlocks];
  let blocos: Bloco[];
  if (blockOrder && blockOrder.length > 0) {
    const byId      = Object.fromEntries(todos.map(b => [b.id, b]));
    const ordered   = blockOrder.map(id => byId[id]).filter(Boolean) as Bloco[];
    const remaining = todos.filter(b => !blockOrder.includes(b.id));
    blocos = [...ordered, ...remaining];
  } else {
    blocos = todos;
  }

  const agora = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const pdfBytes = await gerarPdf(blocos, fat.nome_campanha as string, fat.cliente_nome as string, agora);

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="processo-faturamento.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
