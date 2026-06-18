/**
 * POST /api/publicacao/gerar-pdf
 *
 * Gera o PDF consolidado do processo de faturamento.
 * Baixa cada arquivo do Google Drive e mescla as páginas em sequência,
 * na ordem definida na Etapa 4 (Revisão do Processo).
 *
 * Para documentos cujo link não é um PDF baixável (evidências externas),
 * insere uma página de capa com o título e o link clicável.
 *
 * Body: { faturamentoId: string; blockOrder?: string[] }
 * Retorna: application/pdf (binário)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFArray } from 'pdf-lib';

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

// ── Google Drive helpers ──────────────────────────────────────────────────────

function extractDriveFileId(url: string): string | null {
  // Suporta:
  //   https://drive.google.com/file/d/{id}/view
  //   https://drive.google.com/open?id={id}
  //   https://drive.usercontent.google.com/...?id={id}
  const matchPath  = url.match(/\/file\/d\/([^\/\?&#]+)/);
  if (matchPath) return matchPath[1];
  const matchParam = url.match(/[?&]id=([^&&#]+)/);
  if (matchParam) return matchParam[1];
  return null;
}

async function downloadPdfFromUrl(url: string): Promise<Uint8Array | null> {
  // Google Drive: usa URL de download direto (confirm=t pula aviso de arquivo grande)
  // Supabase Storage / qualquer outra URL: faz fetch direto
  const fileId = extractDriveFileId(url);
  const downloadUrl = fileId
    ? `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
    : url;

  try {
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);

    // Valida assinatura PDF (%PDF-) — URLs externas não-PDF retornam null
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
      return null;
    }

    return bytes;
  } catch {
    return null;
  }
}

// ── Página de capa (para links externos ou downloads que falharam) ─────────────

type EmbeddedFont = Awaited<ReturnType<PDFDocument['embedFont']>>;

function adicionarLink(
  page: ReturnType<PDFDocument['getPage']>,
  url: string, x: number, y: number, w: number, h: number,
) {
  const { doc } = page;
  const annot = doc.context.obj({
    Type:    PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect:    doc.context.obj([x, y, x + w, y + h]),
    Border:  doc.context.obj([0, 0, 0]),
    A: doc.context.obj({
      Type: PDFName.of('Action'),
      S:    PDFName.of('URI'),
      URI:  PDFString.of(url),
    }),
  });
  const ref      = doc.context.register(annot);
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existing) {
    existing.push(ref);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
  }
}

async function criarPaginaCapa(
  pdf:          PDFDocument,
  fontBold:     EmbeddedFont,
  fontRegular:  EmbeddedFont,
  label:        string,
  url:          string | null,
  blocoTitulo:  string,
  blocoTipo:    string,
) {
  const A4_W = 595.28;
  const A4_H = 841.89;
  const M    = 72;
  const CW   = A4_W - M * 2;

  const COR_CINZA      = rgb(0.39, 0.46, 0.55);
  const COR_CINZA_CLARO = rgb(0.88, 0.91, 0.94);
  const COR_AZUL       = rgb(0.18, 0.38, 1.0);
  const COR_PRETO      = rgb(0.06, 0.09, 0.17);

  const pg = pdf.addPage([A4_W, A4_H]);

  // Linha superior decorativa
  pg.drawRectangle({ x: M, y: A4_H - M - 4, width: CW, height: 4, color: COR_AZUL });

  // Bloco de origem (pequeno)
  pg.drawText(`${blocoTipo.toUpperCase()}  ·  ${blocoTitulo.toUpperCase()}`, {
    x: M, y: A4_H - M - 28, size: 8, font: fontRegular, color: COR_CINZA,
  });

  // Label principal
  const palavras = label.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const test = atual ? `${atual} ${p}` : p;
    if (fontBold.widthOfTextAtSize(test, 20) > CW && atual) { linhas.push(atual); atual = p; }
    else { atual = test; }
  }
  if (atual) linhas.push(atual);

  const labelY = A4_H / 2 + 20 + (linhas.length - 1) * 14;
  linhas.forEach((l, i) => {
    pg.drawText(l, { x: M, y: labelY - i * 28, size: 20, font: fontBold, color: COR_PRETO });
  });

  pg.drawLine({ start: { x: M, y: A4_H / 2 - 10 }, end: { x: M + CW, y: A4_H / 2 - 10 }, thickness: 0.5, color: COR_CINZA_CLARO });

  if (url) {
    pg.drawText('Acesse o documento em:', {
      x: M, y: A4_H / 2 - 36, size: 10, font: fontRegular, color: COR_CINZA,
    });

    const linkLabel = url.length > 80 ? url.slice(0, 80) + '...' : url;
    const linkY     = A4_H / 2 - 56;
    pg.drawText(linkLabel, { x: M, y: linkY, size: 9, font: fontRegular, color: COR_AZUL });
    pg.drawLine({
      start: { x: M, y: linkY - 1 },
      end:   { x: M + fontRegular.widthOfTextAtSize(linkLabel, 9), y: linkY - 1 },
      thickness: 0.5, color: COR_AZUL,
    });
    adicionarLink(pg as ReturnType<PDFDocument['getPage']>, url, M, linkY - 4, CW, 16);

    pg.drawText('Clique no link acima para acessar o arquivo original.', {
      x: M, y: linkY - 22, size: 8, font: fontRegular, color: COR_CINZA,
    });
  } else {
    pg.drawText('Documento nao disponivel — arquivo nao anexado.', {
      x: M, y: A4_H / 2 - 36, size: 10, font: fontRegular, color: COR_CINZA,
    });
  }

  // Rodapé
  pg.drawLine({ start: { x: M, y: M + 16 }, end: { x: M + CW, y: M + 16 }, thickness: 0.3, color: COR_CINZA_CLARO });
  pg.drawText('Disrupy Comunicacao Brasil Ltda · sistema de faturamento', {
    x: M, y: M, size: 7, font: fontRegular, color: COR_CINZA,
  });
}

// ── Gerador principal ─────────────────────────────────────────────────────────

async function gerarPdfMesclado(blocos: Bloco[]): Promise<Uint8Array> {
  const pdf         = await PDFDocument.create();
  const fontBold    = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);

  for (const bloco of blocos) {
    const tipoLabel = bloco.tipo === 'agencia' ? 'Agencia' : bloco.tipo === 'midia' ? 'Midia' : 'Producao';

    for (const doc of bloco.docs) {
      if (!doc.arquivo_url) {
        // Sem arquivo: capa de placeholder
        await criarPaginaCapa(pdf, fontBold, fontRegular, doc.label, null, bloco.titulo, tipoLabel);
        continue;
      }

      // Tenta baixar o PDF (Drive, Supabase Storage, ou qualquer URL de arquivo)
      const pdfBytes = await downloadPdfFromUrl(doc.arquivo_url);

      if (!pdfBytes) {
        // Download falhou ou URL não aponta para PDF (evidência externa): capa com link
        await criarPaginaCapa(pdf, fontBold, fontRegular, doc.label, doc.arquivo_url, bloco.titulo, tipoLabel);
        continue;
      }

      // Mescla páginas do PDF baixado no documento principal
      try {
        const extPdf   = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const indices  = extPdf.getPageIndices();
        const copied   = await pdf.copyPages(extPdf, indices);
        copied.forEach(p => pdf.addPage(p));
      } catch {
        // PDF corrompido ou protegido: capa com link como fallback
        await criarPaginaCapa(pdf, fontBold, fontRegular, doc.label, doc.arquivo_url, bloco.titulo, tipoLabel);
      }
    }
  }

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

  // Busca os dados do faturamento
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

  // ── Monta blocos ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agenciaBlock: Bloco = {
    id:    '__agencia__',
    tipo:  'agencia',
    titulo: 'Agencia',
    docs: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(certidoes ?? []).map((c: any): DocItem => ({
        label:       c.label as string,
        status:      c.arquivo_url ? 'aprovado' : 'pendente',
        arquivo_url: (c.arquivo_url ?? null) as string | null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(fat.faturamento_custos_internos ?? []).flatMap((ci: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ci.custo_interno_documentos ?? []).map((d: any): DocItem => ({
          label:       `${ci.servico}`,
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

  // ── Aplica ordem da Etapa 4 ───────────────────────────────────────────────

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

  // ── Gera e retorna o PDF ──────────────────────────────────────────────────

  const pdfBytes = await gerarPdfMesclado(blocos);

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="processo-faturamento.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

// Aumenta o tempo máximo de execução para suportar download de múltiplos arquivos
export const maxDuration = 60; // segundos (requer plano Vercel Pro ou superior)
