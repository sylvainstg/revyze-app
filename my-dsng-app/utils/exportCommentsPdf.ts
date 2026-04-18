import jsPDF from "jspdf";
import { Comment } from "../types";

interface ExportCommentsPdfParams {
  comments: Comment[];
  projectName: string;
  versionName: string;
  category: string;
  fileUrl: string;
  isPdf: boolean;
  pageCount: number;
}

// Render a single PDF page to an offscreen canvas using pdfjs-dist
async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNum: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Load image from URL into an offscreen canvas
async function loadImageToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Crop a thumbnail region around a comment pin
function cropThumbnail(
  canvas: HTMLCanvasElement,
  xPercent: number,
  yPercent: number,
  cropSize = 400,
): string {
  const pxX = (xPercent / 100) * canvas.width;
  const pxY = (yPercent / 100) * canvas.height;

  const sx = Math.max(0, pxX - cropSize / 2);
  const sy = Math.max(0, pxY - cropSize / 2);
  const sw = Math.min(cropSize, canvas.width - sx);
  const sh = Math.min(cropSize, canvas.height - sy);

  const temp = document.createElement("canvas");
  temp.width = sw;
  temp.height = sh;
  const ctx = temp.getContext("2d")!;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return temp.toDataURL("image/jpeg", 0.85);
}

// Draw a numbered pin on a canvas
function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  index: number,
  resolved: boolean,
) {
  const radius = 12;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = resolved ? "#22c55e" : "#6366f1";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index), x, y);
}

// Create a full-page thumbnail with numbered pins
function createAnnotatedPageImage(
  canvas: HTMLCanvasElement,
  pageComments: { comment: Comment; index: number }[],
  maxWidth: number,
): string {
  const scale = maxWidth / canvas.width;
  const w = maxWidth;
  const h = canvas.height * scale;

  const temp = document.createElement("canvas");
  temp.width = w;
  temp.height = h;
  const ctx = temp.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, w, h);

  for (const { comment, index } of pageComments) {
    const px = (comment.x / 100) * w;
    const py = (comment.y / 100) * h;
    drawPin(ctx, px, py, index, comment.resolved);
  }

  return temp.toDataURL("image/jpeg", 0.85);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Wrap text and return lines
function wrapText(text: string, maxWidth: number, doc: jsPDF): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (doc.getTextWidth(testLine) > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function exportCommentsPdf(
  params: ExportCommentsPdfParams,
): Promise<void> {
  const { comments, projectName, versionName, category, fileUrl, isPdf, pageCount } = params;

  // Filter out deleted comments
  const activeComments = comments.filter((c) => !c.deleted);
  if (activeComments.length === 0) return;

  // Group comments by page
  const commentsByPage = new Map<number, Comment[]>();
  for (const c of activeComments) {
    const page = c.pageNumber || 1;
    if (!commentsByPage.has(page)) commentsByPage.set(page, []);
    commentsByPage.get(page)!.push(c);
  }

  // Load source document
  let pdfDoc: any = null;
  const pageCanvases = new Map<number, HTMLCanvasElement>();

  if (isPdf) {
    // Dynamic import pdfjs-dist for offscreen rendering
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

    // Fetch PDF via proxy if needed
    let fetchUrl = fileUrl;
    if (
      fileUrl.includes("firebasestorage.googleapis.com") ||
      fileUrl.includes("firebasestorage.app")
    ) {
      const url = new URL(fileUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+)$/);
      if (pathMatch) {
        fetchUrl = `https://us-central1-dsng-app.cloudfunctions.net/getPDF?path=${pathMatch[1]}`;
      }
    }

    const response = await fetch(fetchUrl);
    const arrayBuffer = await response.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Render pages that have comments
    for (const pageNum of commentsByPage.keys()) {
      const canvas = await renderPdfPageToCanvas(pdfDoc, pageNum);
      pageCanvases.set(pageNum, canvas);
    }
  } else {
    // Image: single page
    const canvas = await loadImageToCanvas(fileUrl);
    pageCanvases.set(1, canvas);
  }

  // Create PDF document (A4)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;
  let isFirstPage = true;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  }

  // ---- Header ----
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(projectName, margin, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${versionName} — ${category}`, margin, 19);

  doc.setFontSize(8);
  doc.text(
    `Exported ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
    pageWidth - margin,
    19,
    { align: "right" },
  );

  doc.setTextColor(0, 0, 0);
  y = 35;

  // Global comment counter
  let globalIndex = 0;

  // ---- Process each page ----
  const sortedPages = Array.from(commentsByPage.keys()).sort((a, b) => a - b);

  for (const pageNum of sortedPages) {
    const pageComments = commentsByPage.get(pageNum)!;
    const canvas = pageCanvases.get(pageNum);
    if (!canvas) continue;

    if (!isFirstPage) {
      doc.addPage();
      y = margin;
    } else {
      isFirstPage = false;
    }

    // Page section header
    ensureSpace(10);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(99, 102, 241);
    doc.text(
      isPdf ? `Page ${pageNum}` : "Image",
      margin,
      y,
    );
    y += 2;

    // Thin separator line
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Annotated full-page thumbnail
    const indexed = pageComments.map((c, i) => ({
      comment: c,
      index: globalIndex + i + 1,
    }));

    const annotatedImage = createAnnotatedPageImage(canvas, indexed, 800);
    const thumbMaxWidth = contentWidth * 0.65;
    const imgAspect = canvas.height / canvas.width;
    const thumbHeight = thumbMaxWidth * imgAspect;
    const maxThumbHeight = 80; // mm
    const finalThumbHeight = Math.min(thumbHeight, maxThumbHeight);
    const finalThumbWidth =
      thumbHeight > maxThumbHeight
        ? thumbMaxWidth * (maxThumbHeight / thumbHeight)
        : thumbMaxWidth;

    ensureSpace(finalThumbHeight + 10);
    const thumbX = margin + (contentWidth - finalThumbWidth) / 2;
    doc.addImage(
      annotatedImage,
      "JPEG",
      thumbX,
      y,
      finalThumbWidth,
      finalThumbHeight,
    );
    y += finalThumbHeight + 8;

    // ---- Render each comment ----
    for (let i = 0; i < pageComments.length; i++) {
      const comment = pageComments[i];
      globalIndex++;
      const commentIndex = globalIndex;

      // Estimate space needed: thumbnail + text
      const estimatedHeight = 45;
      ensureSpace(estimatedHeight);

      // Comment thumbnail (crop)
      const cropData = cropThumbnail(canvas, comment.x, comment.y, 400);
      const cropW = 30; // mm
      const cropH = 30;

      // Background card
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, y - 2, contentWidth, 0.1, 2, 2, "F"); // placeholder, we'll draw after

      // Crop thumbnail
      doc.addImage(cropData, "JPEG", margin, y, cropW, cropH);

      // Comment number badge
      doc.setFillColor(
        comment.resolved ? 34 : 99,
        comment.resolved ? 197 : 102,
        comment.resolved ? 94 : 241,
      );
      doc.circle(margin + 3, y + 3, 3.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(String(commentIndex), margin + 3, y + 3.5, { align: "center" });

      // Comment metadata
      const textX = margin + cropW + 5;
      const textMaxW = contentWidth - cropW - 5;

      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const authorLabel = comment.authorName || comment.author;
      doc.text(authorLabel, textX, y + 4);

      // Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(formatDate(comment.timestamp), textX + doc.getTextWidth(authorLabel + "  "), y + 4);

      // Status badge
      const badgeText = comment.resolved ? "Resolved" : "Active";
      const badgeX = pageWidth - margin - doc.getTextWidth(badgeText) - 4;
      doc.setFillColor(
        comment.resolved ? 220 : 238,
        comment.resolved ? 252 : 242,
        comment.resolved ? 231 : 255,
      );
      doc.roundedRect(badgeX - 1, y + 0.5, doc.getTextWidth(badgeText) + 4, 5, 1, 1, "F");
      doc.setTextColor(comment.resolved ? 22 : 79, comment.resolved ? 163 : 70, comment.resolved ? 74 : 229);
      doc.setFontSize(7);
      doc.text(badgeText, badgeX + 1, y + 4);

      // Comment text
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      let textY = y + 10;
      const lines = wrapText(comment.text, textMaxW, doc);
      for (const line of lines) {
        doc.text(line, textX, textY);
        textY += 4;
      }

      // AI Analysis (if present)
      if (comment.aiAnalysis) {
        doc.setFontSize(7);
        doc.setTextColor(124, 58, 237); // violet-600
        doc.setFont("helvetica", "italic");
        const aiLines = wrapText(`AI: ${comment.aiAnalysis}`, textMaxW, doc);
        for (const line of aiLines.slice(0, 2)) {
          doc.text(line, textX, textY);
          textY += 3.5;
        }
      }

      // Replies
      if (comment.replies && comment.replies.length > 0) {
        doc.setFontSize(7);
        for (const reply of comment.replies) {
          doc.setTextColor(100, 116, 139); // slate-500
          doc.setFont("helvetica", "bold");
          const replyAuthor = reply.authorName || reply.author;
          doc.text(`↳ ${replyAuthor}:`, textX + 2, textY);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          const replyLines = wrapText(reply.text, textMaxW - 10, doc);
          const authorW = doc.getTextWidth(`↳ ${replyAuthor}: `);
          // First line inline
          if (replyLines.length > 0) {
            doc.text(replyLines[0], textX + 2 + authorW, textY);
            textY += 3.5;
          }
          for (let r = 1; r < replyLines.length; r++) {
            doc.text(replyLines[r], textX + 4, textY);
            textY += 3.5;
          }
        }
      }

      const cardHeight = Math.max(cropH, textY - y) + 4;

      // Draw card background behind content (draw first, content on top - but jsPDF is immediate so we redraw)
      // We skip card bg for simplicity, the layout is clean enough

      // Separator
      y += cardHeight + 2;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.line(margin + cropW + 5, y, pageWidth - margin, y);
      y += 5;
    }
  }

  // Open the PDF in a new tab instead of downloading
  window.open(doc.output("bloburl"), "_blank");
}
