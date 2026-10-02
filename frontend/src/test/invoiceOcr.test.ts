import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Page } from 'tesseract.js';
import { recognizeInvoice } from '../utils/browserInvoiceOcr';
import { parseVendorInvoice } from '../api/invoiceOcr';

const mocks = vi.hoisted(() => ({ createWorker: vi.fn(), recognize: vi.fn(), terminate: vi.fn(), setParameters: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker, OEM: { LSTM_ONLY: 1 }, PSM: { AUTO: '3', SINGLE_BLOCK: '6' } }));
const page = { text: 'Invoice 42\nPaper 10 4.50 45.00', confidence: 95, blocks: [{ paragraphs: [{ lines: [{ words: [
  { text: 'Paper', confidence: 94, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
] }] }] }] } as Page;
const file = () => new File(['image'], 'invoice.png', { type: 'image/png' });

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1000, height: 800, close: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  mocks.terminate.mockResolvedValue(undefined);
  mocks.setParameters.mockResolvedValue(undefined);
  mocks.recognize.mockResolvedValue({ data: page });
  mocks.createWorker.mockResolvedValue(mocks);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('runs both layout modes, preserves word boxes, and releases the worker', async () => {
  const result = await recognizeInvoice(file(), new AbortController().signal);
  expect(result).toHaveLength(2);
  expect(result[0].words[0]).toEqual({ text: 'Paper', confidence: 94, left: 10, top: 20, width: 50, height: 20 });
  expect(mocks.recognize).toHaveBeenCalledTimes(2);
  expect(mocks.createWorker).toHaveBeenCalledWith('eng', 1, expect.objectContaining({ workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang' }));
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it('sends recognition data to the existing backend parser flow without uploading the image', async () => {
  const response = { items: [], suggested_vendor_id: 4 };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal('fetch', fetchMock);
  expect(await parseVendorInvoice(file(), new AbortController().signal)).toEqual(response);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/admin/vendor-invoices/parse-text');
  expect(options.credentials).toBe('same-origin');
  expect(JSON.parse(options.body).passes).toHaveLength(2);
});

it('surfaces backend errors for the review screen', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Please sign in again.' }) }));
  await expect(parseVendorInvoice(file(), new AbortController().signal)).rejects.toThrow('Please sign in again.');
});

it('rejects invalid and oversized images before creating an OCR worker', async () => {
  await expect(recognizeInvoice(new File(['pdf'], 'x.pdf', { type: 'application/pdf' }), new AbortController().signal)).rejects.toThrow('JPEG');
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 5000, height: 5000, close: vi.fn() }));
  await expect(recognizeInvoice(file(), new AbortController().signal)).rejects.toThrow('16 megapixels');
  expect(mocks.createWorker).not.toHaveBeenCalled();
});

it('cancels an active scan and releases its worker', async () => {
  mocks.recognize.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const pending = recognizeInvoice(file(), controller.signal);
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(mocks.recognize).toHaveBeenCalled());
  controller.abort();
  await assertion;
  expect(mocks.terminate).toHaveBeenCalledOnce();
});

it('cleans up a worker that finishes initializing after cancellation', async () => {
  let complete!: (worker: typeof mocks) => void;
  mocks.createWorker.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const controller = new AbortController();
  const pending = recognizeInvoice(file(), controller.signal);
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(mocks.createWorker).toHaveBeenCalled());
  controller.abort();
  await assertion;
  complete(mocks);
  await vi.waitFor(() => expect(mocks.terminate).toHaveBeenCalledOnce());
  expect(mocks.recognize).not.toHaveBeenCalled();
});

it('releases resources when recognition fails', async () => {
  mocks.recognize.mockRejectedValue(new Error('Recognition failed'));
  await expect(recognizeInvoice(file(), new AbortController().signal)).rejects.toThrow('Recognition failed');
  expect(mocks.terminate).toHaveBeenCalledOnce();
});
