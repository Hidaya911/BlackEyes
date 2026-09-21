import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Modal } from 'react-bootstrap';
import { FaDownload, FaPrint } from 'react-icons/fa';
import { pressRequest } from '../../../api/press';
import { DocumentPaper, type OrderDocument } from './DocumentPaper';
import paperStyles from '../../../style/DocumentPaper.css?inline';
import '../../../style/OrderDocuments.css';

export function DocumentPreview({ orderId, kind, onClose }: { orderId: number; kind: 'invoice' | 'receipt'; onClose: () => void }) {
  const [document, setDocument] = useState<OrderDocument | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    pressRequest<OrderDocument>(`/orders/${orderId}/documents/${kind}`, { signal: controller.signal }).then(setDocument).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [orderId, kind]);
  async function print() {
    const target = frame.current?.contentWindow;
    if (!target) return;
    try {
      await Promise.all(Array.from(target.document.images).map(img => img.decode()));
      target.focus(); target.print();
    } catch { setError('The logo could not load for printing. Close the preview and try again.'); }
  }
  async function download() {
    const paper = frame.current?.contentDocument?.querySelector<HTMLElement>('.document-paper');
    if (!paper || !document || downloading) return;
    setDownloading(true); setError('');
    try {
      await Promise.all(Array.from(paper.querySelectorAll('img')).map(img => img.decode()));
      const { downloadPdf } = await import('./downloadPdf');
      await downloadPdf(paper, `${document.number}-Blackeyes.pdf`);
    } catch { setError('Unable to download the PDF. Please try again.'); }
    finally { setDownloading(false); }
  }
  const html = document ? '<!DOCTYPE html>' + renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{document.number} · Blackeyes</title><style>{paperStyles}</style></head><body><DocumentPaper document={document} /></body></html>) : '';
  return <Modal show onHide={() => !downloading && onClose()} size="xl" centered dialogClassName="document-preview-dialog" contentClassName="document-preview-modal"><Modal.Header closeButton={!downloading}><div><span className="document-eyebrow">BLACKEYES / DOCUMENT STUDIO</span><Modal.Title>{kind === 'invoice' ? 'Invoice' : 'Payment receipt'} preview</Modal.Title></div></Modal.Header><Modal.Body>{error && <div className="alert alert-danger" role="alert">{error}</div>}{!document && !error && <p role="status">Preparing your document…</p>}{document && <iframe ref={frame} className="document-preview-frame" title={`${kind} for order ${orderId}`} srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} />}</Modal.Body><Modal.Footer><small className="me-auto text-secondary">Download a digital copy directly, or print on A4.</small><button className="btn btn-light" disabled={downloading} onClick={onClose}>Close</button><button className="btn btn-outline-dark" disabled={!ready || downloading} onClick={print}><FaPrint /> Print</button><button className="document-primary" disabled={!ready || downloading} onClick={download}><FaDownload /> {downloading ? 'Preparing PDF…' : 'Download PDF'}</button></Modal.Footer></Modal>;
}
