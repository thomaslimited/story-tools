// Full-resolution export of story images to PNG files or a single PDF.
import { PDFDocument } from 'pdf-lib';
import { PAGE_SIZES } from './layouts.js';
import { renderSlide } from './render-slide.js';

export async function renderSlideToBlob(options) {
  const page = PAGE_SIZES[options.project.orientation] || PAGE_SIZES.portrait;
  const canvas = document.createElement('canvas');
  canvas.width = page.w;
  canvas.height = page.h;
  renderSlide(canvas.getContext('2d'), { ...options, selection: null });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không xuất được ảnh'))), 'image/png'),
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Builds a PDF with one page per PNG blob, sized to the image (96 dpi -> 72 pt). */
export async function pngBlobsToPdf(blobs) {
  const pdf = await PDFDocument.create();
  for (const blob of blobs) {
    const png = await pdf.embedPng(await blob.arrayBuffer());
    const w = png.width * 0.75;
    const h = png.height * 0.75;
    pdf.addPage([w, h]).drawImage(png, { x: 0, y: 0, width: w, height: h });
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

/** Safe filename slug that keeps it readable (Vietnamese diacritics stripped). */
export function slugify(text) {
  return (
    (text || 'truyen')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'truyen'
  );
}
