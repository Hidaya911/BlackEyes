import paperStyles from '../../../style/DocumentPaper.css?inline';

/** Render only the document, without the browser's print decorations. */
export async function downloadPdf(paper: HTMLElement, filename: string) {
  const { default: html2pdf } = await import('html2pdf.js');
  const root = document.createElement('div');
  const style = document.createElement('style');
  // Include the isolated document styles when the PDF renderer clones the paper.
  style.textContent = paperStyles.slice(paperStyles.indexOf('.document-paper')) + `
    .document-paper { font-family: Arial, Helvetica, sans-serif; color: #1b2637;
      font-size: 12px; min-height: 0; max-width: none; margin: 0; padding: 0 8px 12px; }
    .document-paper, .document-paper * { box-sizing: border-box; }
    .paper-color-strip { margin-left: -8px; margin-right: -8px; }
    .paper-parties { grid-template-columns: 1.2fr 1fr; }
    .paper-settlement { grid-template-columns: 1fr 1fr; }
    .paper-footer { flex-direction: row; }
    .paper-footer p { text-align: right; }
    .paper-header img { width: 110px; }
    .paper-document-id h1 { font-size: 29px; }
  `;
  root.append(style, paper.cloneNode(true));
  const options = {
    filename,
    margin: 12,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, windowWidth: 794, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.paper-header', '.paper-parties', '.receipt-amount', '.paper-settlement', '.paper-footer'] },
  };
  await html2pdf().set(options).from(root).save();
}
