import type { Worker, Page } from 'tesseract.js';

export interface OCRPass {
  text: string;
  confidence: number;
  words: { text: string; confidence: number; left: number; top: number; width: number; height: number }[];
}

export function recognitionPass(data: Page): OCRPass {
  const words = (data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph =>
    paragraph.lines.flatMap(line => line.words))).filter(word => word.text.trim() && word.confidence >= 0);
  if (words.length > 6000 || data.text.length > 100000) throw new Error('Too much text. Crop the invoice and retry.');
  return {
    text: data.text, confidence: Math.max(0, Math.min(100, data.confidence || 0)),
    words: words.map(word => ({ text: word.text, confidence: Math.max(0, Math.min(100, word.confidence)),
      left: word.bbox.x0, top: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0 })),
  };
}

async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be opened. Try another JPEG, PNG or WebP.'); });
  try {
    if (bitmap.width * bitmap.height > 16_000_000) throw new Error('The image exceeds 16 megapixels. Resize it and retry.');
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > 3000 ? 3000 / longest : longest < 2400 ? Math.min(2, 3200 / longest) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser. Try an updated browser.');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { bitmap.close(); }
}

export async function recognizeInvoice(file: File, signal: AbortSignal, progress?: (message: string) => void): Promise<OCRPass[]> {
  signal.throwIfAborted();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose an invoice image no larger than 8 MB.');
  let worker: Worker | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectFailure!: (error: Error) => void;
  const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
  const abort = () => rejectFailure(new DOMException('Invoice scan cancelled.', 'AbortError'));
  signal.addEventListener('abort', abort, { once: true });
  const stopWorker = () => { const active = worker; worker = undefined; if (active) void active.terminate().catch(() => undefined); };
  const run = async () => {
    progress?.('Preparing invoice image…');
    const canvas = await prepareImage(file);
    try {
      if (stopped) throw new DOMException('Cancelled', 'AbortError');
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      if (stopped) throw new DOMException('Cancelled', 'AbortError');
      const assets = `${import.meta.env.BASE_URL}ocr`;
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${assets}/worker.min.js`, corePath: `${assets}/core`, langPath: `${assets}/lang`,
        workerBlobURL: false,
        logger: message => { if (!stopped) progress?.(message.status === 'recognizing text'
          ? `Reading invoice… ${Math.round(message.progress * 100)}%` : 'Loading invoice reader… First use may take longer.'); },
        errorHandler: () => rejectFailure(new Error('The invoice reader could not load or process the image. Check your connection and retry.')),
      });
      if (stopped) { stopWorker(); throw new DOMException('Cancelled', 'AbortError'); }
      const passes: OCRPass[] = [];
      for (const mode of [PSM.AUTO, PSM.SINGLE_BLOCK]) {
        if (stopped || !worker) throw new DOMException('Cancelled', 'AbortError');
        await worker.setParameters({ tessedit_pageseg_mode: mode });
        const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
        passes.push(recognitionPass(result.data));
      }
      return passes;
    } finally { canvas.width = 0; canvas.height = 0; }
  };
  try {
    timer = setTimeout(() => rejectFailure(new Error('Reading the invoice took too long. Crop the image or try a smaller scan.')), 120000);
    return await Promise.race([run(), failure]);
  } finally {
    stopped = true;
    clearTimeout(timer!);
    signal.removeEventListener('abort', abort);
    stopWorker();
  }
}
