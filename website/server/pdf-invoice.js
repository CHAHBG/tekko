import PDFDocument from 'pdfkit';
import { request as httpsRequest } from 'https';

function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' FCFA';
}

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    httpsRequest(url, { family: 4 }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject).end();
  });
}

function drawDashedLine(doc, x1, y, x2) {
  const dashLen = 4;
  const gapLen = 3;
  let x = x1;
  doc.strokeColor('#ddd8d0').lineWidth(0.8);
  while (x < x2) {
    const end = Math.min(x + dashLen, x2);
    doc.moveTo(x, y).lineTo(end, y).stroke();
    x = end + gapLen;
  }
}

/**
 * Generate an invoice / proforma PDF.
 * @param {Object} opts
 * @param {string} opts.invoiceId      â€” e.g. "INV-0001"
 * @param {string} opts.clientName
 * @param {string} opts.clientPhone
 * @param {string} opts.clientEmail
 * @param {Array}  opts.items          â€” [{ description, quantity, unitPrice }]
 * @param {number} opts.total          â€” computed total
 * @param {string} [opts.paymentUrl]   â€” Wave payment link
 * @param {string} [opts.notes]        â€” optional notes
 */
export async function generateInvoicePdf({ invoiceId, clientName, clientPhone, clientEmail, items, total, paymentUrl, notes }) {
  const [tekkoLogo, geochifaLogo] = await Promise.all([
    fetchImage('https://tekko.geochifa.com/tekko-logo.png').catch(() => null),
    fetchImage('https://geochifa.com/images/logo-nobg.png').catch(() => null),
  ]);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: {
      Title: `Facture TEKKO ${invoiceId}`,
      Author: 'TEKKO by GeoChifÃ¢',
      Subject: 'Facture proforma',
    },
  });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const pw = doc.page.width - 100;
  const cx = doc.page.width / 2;
  const rightX = doc.page.width - 50;

  // â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.rect(0, 0, doc.page.width, 85).fill('#1a1a1a');

  if (tekkoLogo) {
    try { doc.image(tekkoLogo, cx - 50, 14, { width: 100 }); } catch { /* skip */ }
  } else {
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#e7c35e');
    doc.text('TEKKO', 0, 22, { align: 'center', width: doc.page.width });
  }

  doc.font('Helvetica').fontSize(7).fillColor('#999999');
  doc.text('FACTURE PROFORMA', 0, 68, { align: 'center', width: doc.page.width });

  // â”€â”€ INVOICE ID + DATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let y = 100;
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a');
  doc.text(`Facture ${invoiceId}`, 50, y);
  doc.font('Helvetica').fontSize(8).fillColor('#888888');
  doc.text(dateStr, 50, y, { align: 'right', width: pw });
  y += 20;
  drawDashedLine(doc, 50, y, rightX);
  y += 14;

  // â”€â”€ CLIENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
  doc.text('FACTURÃ‰ Ã€', 50, y);
  y += 12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
  doc.text(clientName, 50, y);
  y += 14;
  const details = [clientPhone, clientEmail].filter(Boolean).join('  Â·  ');
  if (details) {
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    doc.text(details, 50, y);
    y += 14;
  }
  y += 4;
  drawDashedLine(doc, 50, y, rightX);
  y += 14;

  // â”€â”€ TABLE HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
  doc.text('DESCRIPTION', 50, y);
  doc.text('QTÃ‰', 320, y, { width: 40, align: 'center' });
  doc.text('PRIX UNIT.', 370, y, { width: 80, align: 'right' });
  doc.text('TOTAL', rightX - 80, y, { width: 80, align: 'right' });
  y += 14;
  drawDashedLine(doc, 50, y, rightX);
  y += 10;

  // â”€â”€ LINE ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for (const item of items) {
    const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);
    doc.font('Helvetica').fontSize(8.5).fillColor('#1a1a1a');
    doc.text(item.description || 'â€”', 50, y, { width: 260 });
    doc.text(String(item.quantity || 1), 320, y, { width: 40, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    doc.text(formatMoney(item.unitPrice || 0), 370, y, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1a1a1a');
    doc.text(formatMoney(lineTotal), rightX - 80, y, { width: 80, align: 'right' });
    y += 18;
  }
  y += 4;
  drawDashedLine(doc, 50, y, rightX);
  y += 14;

  // â”€â”€ TOTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
  doc.text('Total Ã  payer', 50, y);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1a9d8f');
  doc.text(formatMoney(total), 50, y - 1, { align: 'right', width: pw });
  y += 24;

  // â”€â”€ PAYMENT LINK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (paymentUrl) {
    drawDashedLine(doc, 50, y, rightX);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
    doc.text('PAIEMENT', 50, y);
    y += 12;

    // Orange payment button
    const btnW = 220;
    const btnH = 30;
    const btnX = cx - btnW / 2;
    doc.roundedRect(btnX, y, btnW, btnH, 6).fill('#1a9d8f');
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
    doc.text('Payer avec Wave â†’', btnX, y + 9, { width: btnW, align: 'center', link: paymentUrl });
    y += btnH + 10;

    doc.font('Helvetica').fontSize(7.5).fillColor('#888888');
    doc.text('Ou copiez ce lien :', 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(7).fillColor('#1a9d8f');
    doc.text(paymentUrl, 50, y, { link: paymentUrl, underline: true, width: pw });
    y += 16;
  }

  // â”€â”€ NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (notes) {
    drawDashedLine(doc, 50, y, rightX);
    y += 14;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
    doc.text('NOTES', 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    doc.text(notes, 50, y, { width: pw });
    y += 20;
  }

  // â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const footerY = doc.page.height - 60;
  doc.rect(0, footerY, doc.page.width, 60).fill('#f7f5f1');

  let footerLogoX = cx;
  if (geochifaLogo) {
    try {
      doc.image(geochifaLogo, cx - 70, footerY + 12, { width: 16 });
      footerLogoX = cx - 48;
    } catch { /* skip */ }
  }
  doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa');
  doc.text('TEKKO by GeoChifÃ¢ Â· Dakar, SÃ©nÃ©gal', footerLogoX, footerY + 16, { width: 200 });
  doc.text(`Document gÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 0, footerY + 32, { align: 'center', width: doc.page.width });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
