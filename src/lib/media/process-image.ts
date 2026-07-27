// 브라우저 전용 이미지 처리(어드민 업로드 UI에서 사용).
// 긴 변 2400px 상한(축소만) + WebP 0.9 인코딩 + EXIF orientation 을 픽셀에 굽고 메타데이터 제거.
// 큰 축소는 단계적 반감으로 선명도 유지, 비율은 단일 배율이라 유지된다.

const MAX_EDGE = 2400;
const QUALITY = 0.9;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawTo(source: CanvasImageSource, width: number, height: number): Canvas {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d') as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

// 목표 크기의 2배보다 크면 절반씩 줄여가며 앨리어싱 최소화.
function drawScaled(source: ImageBitmap, targetWidth: number, targetHeight: number): Canvas {
  let current: CanvasImageSource = source;
  let currentWidth = source.width;
  let currentHeight = source.height;
  while (currentWidth > targetWidth * 2 && currentHeight > targetHeight * 2) {
    const nextWidth = Math.max(targetWidth, Math.round(currentWidth / 2));
    const nextHeight = Math.max(targetHeight, Math.round(currentHeight / 2));
    current = drawTo(current, nextWidth, nextHeight);
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }
  return drawTo(current, targetWidth, targetHeight);
}

async function toWebP(canvas: Canvas, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/webp', quality });
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
      'image/webp',
      quality,
    );
  });
}

export async function processImage(file: File): Promise<ProcessedImage> {
  // imageOrientation:'from-image' → 회전 태그를 픽셀에 반영해 디코드(재인코딩 시 눕는 사고 방지).
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = drawScaled(bitmap, width, height);
  bitmap.close();
  const blob = await toWebP(canvas, QUALITY);
  return { blob, width, height };
}
