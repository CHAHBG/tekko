import PDFDocument from 'pdfkit';
import { request as httpsRequest } from 'https';

function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 })
    .format(amount)
    .replace(/\u202f|\u00a0/g, '\u0020') // narrow/non-breaking space â†’ regular space (PDFKit Helvetica compat)
    + ' FCFA';
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

export async function generateReceiptPdf({ order, totalPrice }) {
  const profile = order.profile ?? {};
  const customization = order.customization ?? {};
  const contact = order.orderContact ?? {};
  const pack = order.packageSelection ?? {};
  const orderId = (order.orderId ?? '').slice(0, 8).toUpperCase();
  const amount = totalPrice || order.packPrice;

  // Fetch logos in parallel
  const [tekkoLogo, geochifaLogo] = await Promise.all([
    fetchImage('https://tekko.geochifa.com/tekko-logo.png').catch(() => null),
    fetchImage('https://geochifa.com/images/logo-nobg.png').catch(() => null),
  ]);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 20, left: 50, right: 50 },
    info: {
      Title: `ReÃ§u TEKKO #${orderId}`,
      Author: 'TEKKO by GeoChifÃ¢',
      Subject: 'ReÃ§u de commande',
    },
  });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const pw = doc.page.width - 100; // usable page width
  const cx = doc.page.width / 2;

  // â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.rect(0, 0, doc.page.width, 85).fill('#1a1a1a');

  // TEKKO logo (centered)
  if (tekkoLogo) {
    try { doc.image(tekkoLogo, cx - 50, 14, { width: 100 }); } catch { /* skip */ }
  } else {
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#e7c35e');
    doc.text('TEKKO', 0, 22, { align: 'center', width: doc.page.width });
  }

  doc.font('Helvetica').fontSize(7).fillColor('#999999');
  doc.text('REÃ‡U DE COMMANDE', 0, 68, { align: 'center', width: doc.page.width });

  // â”€â”€ ORDER ID + DATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let y = 100;
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  doc.font('Helvetica').fontSize(8).fillColor('#888888');
  doc.text(`Commande #${orderId}`, 50, y);
  doc.text(dateStr, 50, y, { align: 'right', width: pw });
  y += 18;
  drawDashedLine(doc, 50, y, doc.page.width - 50);
  y += 12;

  // â”€â”€ CLIENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
  doc.text('CLIENT', 50, y);
  y += 12;
  const clientName = profile.fullName || contact.name || 'Client';
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a');
  doc.text(clientName, 50, y);
  const clientDetails = [profile.phone || contact.phone, profile.email || contact.email || order.customerEmail].filter(Boolean).join('  Â·  ');
  if (clientDetails) {
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    doc.text(clientDetails, 200, y, { align: 'right', width: pw - 150 });
  }
  y += 18;
  drawDashedLine(doc, 50, y, doc.page.width - 50);
  y += 12;

  // â”€â”€ ORDER DETAILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
  doc.text('DÃ‰TAILS DE LA COMMANDE', 50, y);
  y += 14;

  const rows = [
    ['Pack', `${pack.name || '-'} (${pack.quantity || 1} carte${(pack.quantity || 1) > 1 ? 's' : ''})`],
    ['MatÃ©riau', customization.material || '-'],
    ['Finition', customization.finish || '-'],
    ['Dorure', customization.foil || '-'],
  ];
  if (customization.customDomain) rows.push(['Domaine', customization.customDomain]);
  if (order.couponCode) rows.push(['Coupon', `${order.couponCode} (âˆ’${formatMoney(order.discountAmount || 0)})`]);

  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(8).fillColor('#888888');
    doc.text(label, 50, y);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1a1a1a');
    doc.text(value, 50, y, { align: 'right', width: pw });
    y += 15;
  }
  y += 4;
  drawDashedLine(doc, 50, y, doc.page.width - 50);
  y += 12;

  // â”€â”€ TOTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a');
  doc.text('Total payÃ©', 50, y);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a9d8f');
  doc.text(formatMoney(amount), 50, y - 1, { align: 'right', width: pw });
  y += 20;
  doc.font('Helvetica').fontSize(7).fillColor('#888888');
  doc.text('Paiement confirmÃ© via Wave', 50, y);
  y += 16;
  drawDashedLine(doc, 50, y, doc.page.width - 50);
  y += 12;

  // â”€â”€ CARD URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (order.finalCardUrl && !customization.customDomain) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
    doc.text('VOTRE CARTE DIGITALE', 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(9).fillColor('#1a9d8f');
    doc.text(order.finalCardUrl, 50, y, { link: order.finalCardUrl, underline: true });
    y += 16;
    drawDashedLine(doc, 50, y, doc.page.width - 50);
    y += 12;
  }

  // â”€â”€ PROFILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#aaaaaa');
  doc.text('PROFIL DE LA CARTE', 50, y);
  y += 14;

  const profileRows = [];
  if (profile.fullName) profileRows.push(['Nom', profile.fullName]);
  if (profile.role) profileRows.push(['RÃ´le', profile.role]);
  if (profile.company) profileRows.push(['Entreprise', profile.company]);
  if (profile.phone) profileRows.push(['TÃ©lÃ©phone', profile.phone]);
  if (profile.email) profileRows.push(['Email', profile.email]);

  for (const [label, value] of profileRows) {
    doc.font('Helvetica').fontSize(8).fillColor('#888888');
    doc.text(label, 50, y);
    doc.font('Helvetica').fontSize(8).fillColor('#1a1a1a');
    doc.text(value, 50, y, { align: 'right', width: pw });
    y += 14;
  }

  // â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const footerY = doc.page.height - 70;
  doc.rect(0, footerY, doc.page.width, 70).fill('#f7f5f1');

  const genDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  let footerLogoX = cx;
  if (geochifaLogo) {
    try {
      doc.image(geochifaLogo, cx - 70, footerY + 14, { width: 16 });
      footerLogoX = cx - 48;
    } catch { /* skip */ }
  }
  doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa');
  doc.text('TEKKO by GeoChifÃ¢ Â· Dakar, SÃ©nÃ©gal', footerLogoX, footerY + 18, { width: 200, lineBreak: false });
  doc.text(`Document gÃ©nÃ©rÃ© le ${genDate}`, 0, footerY + 36, { align: 'center', width: doc.page.width, lineBreak: false });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
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
