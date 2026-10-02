// Browser-side loading of frame images and the bubble font, shared by the editor, preview and export.
import { panelImageUrl } from '../api.js';

const cache = new Map(); // url -> Promise<HTMLImageElement>

export function loadImage(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          cache.delete(url);
          reject(new Error(`Không tải được ảnh ${url}`));
        };
        img.src = url;
      }),
    );
  }
  return cache.get(url);
}

/** Map of selectedImage filename -> loaded image. Missing files are skipped (renderer shows a placeholder). */
export async function loadFrameImages(projectId, frames) {
  const map = new Map();
  await Promise.all(
    frames
      .filter((f) => f.selectedImage)
      .map(async (f) => {
        try {
          map.set(f.selectedImage, await loadImage(panelImageUrl(projectId, f.selectedImage)));
        } catch {
          // Placeholder is drawn instead.
        }
      }),
  );
  return map;
}

// Sample text forces the browser to download both the Latin and Vietnamese font subsets before canvas drawing.
const FONT_SAMPLE = 'Aa Ăă Ââ Đđ Êê Ôô Ơơ Ưư ạ ả ã ấ ầ ẩ ẫ ậ ắ ằ ẳ ẵ ặ ẹ ẻ ẽ ế ề ể ễ ệ ỉ ị ọ ỏ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ụ ủ ứ ừ ử ữ ự ỳ ỵ ỷ ỹ 0123456789';
let fontsPromise;

export function ensureFonts() {
  fontsPromise ??= Promise.all(
    ['500', '600'].map((w) => document.fonts.load(`${w} 34px "Be Vietnam Pro"`, FONT_SAMPLE)),
  ).catch(() => {});
  return fontsPromise;
}
