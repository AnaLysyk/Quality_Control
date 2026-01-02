"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const UNSUPPORTED_COLOR_PATTERN = /okl(?:ab|ch)|\blab\(|\blch\(|color-mix\(/i;
const UNSUPPORTED_COLOR_FUNCTION = /(oklch?|color-mix|lab|lch)\([^)]*\)/gi;

function sanitizeClonedDocument(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  const textColorFallback = "#f8fafc";
  const surfaceFallback = "#0D1117";

  doc.querySelectorAll<HTMLStyleElement>("style").forEach((styleEl) => {
    if (!styleEl.textContent) return;
    const cleaned = styleEl.textContent.replace(UNSUPPORTED_COLOR_FUNCTION, surfaceFallback);
    styleEl.textContent = cleaned;
  });

  const colorProps = [
    "color",
    "background",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "fill",
    "stroke",
    "caretColor",
    "accentColor",
    "columnRuleColor",
  ];

  const shadowProps = ["boxShadow", "textShadow"];

  doc.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const computed = view.getComputedStyle(element);
    if (!computed) return;

    colorProps.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value && UNSUPPORTED_COLOR_PATTERN.test(value)) {
        const replacement = property === "color" ? textColorFallback : surfaceFallback;
        element.style.setProperty(property, replacement, "important");
      }
    });

    shadowProps.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value && UNSUPPORTED_COLOR_PATTERN.test(value)) {
        element.style.setProperty(property, "none", "important");
      }
    });

    const backgroundImage = computed.getPropertyValue("background-image");
    if (backgroundImage && UNSUPPORTED_COLOR_PATTERN.test(backgroundImage)) {
      element.style.setProperty("background-image", "none", "important");
    }

    for (let i = 0; i < computed.length; i += 1) {
      const prop = computed[i];
      const value = computed.getPropertyValue(prop);
      if (!value || !UNSUPPORTED_COLOR_PATTERN.test(value)) continue;

      if (prop.startsWith("--")) {
        element.style.setProperty(prop, surfaceFallback, "important");
        continue;
      }

      const fallback = prop.toLowerCase().includes("color") ? textColorFallback : surfaceFallback;
      element.style.setProperty(prop, fallback, "important");
    }
  });
}

interface ExportPDFButtonProps {
  fileName: string;
  targetId?: string;
}

export default function ExportPDFButton({ fileName, targetId = "pdf-summary" }: ExportPDFButtonProps) {
  async function handleExport() {
    const area = document.getElementById(targetId);
    if (!area) return;

    const rect = area.getBoundingClientRect();
    const targetWidth = Math.ceil(rect.width || area.scrollWidth);
    const targetHeight = Math.ceil(rect.height || area.scrollHeight);
    const previousOverflow = area.style.overflow;
    area.style.overflow = "visible";

    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(area, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: targetWidth,
        height: targetHeight,
        windowWidth: Math.max(targetWidth, document.documentElement.clientWidth),
        windowHeight: Math.max(targetHeight, document.documentElement.clientHeight),
        removeContainer: true,
        onclone: (clonedDoc) => sanitizeClonedDocument(clonedDoc),
      });

      const padding = 3;
      const paddedCanvas = document.createElement("canvas");
      paddedCanvas.width = canvas.width + padding * 2;
      paddedCanvas.height = canvas.height + padding * 2;
      const ctx = paddedCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        ctx.drawImage(canvas, padding, padding);
      }

      const imgData = paddedCanvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [210, 297],
        compress: true,
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const imgRatio = paddedCanvas.width / paddedCanvas.height;
      let drawW = maxW;
      let drawH = drawW / imgRatio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * imgRatio;
      }
      const offsetX = (pageW - drawW) / 2;
      const offsetY = (pageH - drawH) / 2;
      pdf.addImage(imgData, "PNG", offsetX, offsetY, drawW, drawH);
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF", error);
      alert("Não foi possível gerar o PDF. Veja o console para mais detalhes.");
    } finally {
      area.style.overflow = previousOverflow;
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center justify-center rounded-full bg-white text-[#0b1a3c] border border-white/60 px-3 py-2 hover:shadow-md hover:scale-[1.02] transition focus:outline-none"
      aria-label="Exportar PDF"
      title="Baixar PDF desta release"
    >
      <span className="text-lg font-bold leading-none">{String.fromCharCode(0x2193)}</span>
    </button>
  );
}

