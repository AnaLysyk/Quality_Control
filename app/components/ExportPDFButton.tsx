"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const LAB_COLOR_PATTERN = /(?:lab|lch|okl(?:ab|ch))\(/i;

function sanitizeClonedDocument(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  doc.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const computed = view.getComputedStyle(element);
    if (!computed) return;

    ["backgroundColor", "borderColor", "color"].forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value && LAB_COLOR_PATTERN.test(value)) {
        const replacement = property === "color" ? "#f8fafc" : "#0D1117";
        element.style.setProperty(property, replacement, "important");
      }
    });

    const backgroundImage = computed.getPropertyValue("background-image");
    if (backgroundImage && LAB_COLOR_PATTERN.test(backgroundImage)) {
      element.style.setProperty("background-image", "none", "important");
    }
  });
}

interface ExportPDFButtonProps {
  fileName: string;
}

export default function ExportPDFButton({ fileName }: ExportPDFButtonProps) {
  async function handleExport() {
    const area = document.getElementById("export-area");
    if (!area) return;

    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(area, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#0D1117",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        removeContainer: true,
        windowWidth: document.documentElement.scrollWidth,
        onclone: (clonedDoc) => sanitizeClonedDocument(clonedDoc),
      });

      const padding = 3;
      const paddedCanvas = document.createElement("canvas");
      paddedCanvas.width = canvas.width + padding * 2;
      paddedCanvas.height = canvas.height + padding * 2;
      const ctx = paddedCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0D1117";
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        ctx.drawImage(canvas, padding, padding);
      }

      const imgData = paddedCanvas.toDataURL("image/png");
      const width = paddedCanvas.width;
      const height = paddedCanvas.height;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [width, height],
        compress: true,
      });

      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF", error);
      alert("Não foi possível gerar o PDF. Veja o console para mais detalhes.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="bg-[#7CD343] hover:bg-[#9BF45B] text-black font-semibold px-6 py-3 rounded-lg shadow-md transition"
    >
      Exportar PDF
    </button>
  );
}
