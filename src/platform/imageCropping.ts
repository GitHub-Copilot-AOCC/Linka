import type { NormalizedBox } from '@domain/businessCard';

/**
 * Web 實作：用 Canvas API 依正規化座標框（0–1，相對於整張圖片寬高）裁切圖片
 * （見 spec.md §5.5 名片掃描：裁出名片全圖/人像照）。未來 RN 版需提供對應原生實作。
 */
export function cropImageToBox(blob: Blob, box: NormalizedBox, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const sx = Math.round(box.x0 * img.width);
      const sy = Math.round(box.y0 * img.height);
      const sw = Math.round((box.x1 - box.x0) * img.width);
      const sh = Math.round((box.y1 - box.y0) * img.height);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
