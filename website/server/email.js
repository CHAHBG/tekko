import { request as httpsRequest } from 'https';

const BREVO_API_HOST = 'api.brevo.com';
const BREVO_API_PATH = '/v3/smtp/email';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isBrevoConfigured() {
  return !!process.env.BREVO_API_KEY;
}

function sendViaBrevo({ from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sender: { name: 'TEKKO', email: from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
    const req = httpsRequest({
      hostname: BREVO_API_HOST,
      path: BREVO_API_PATH,
      method: 'POST',
      family: 4, // force IPv4 — uses 178.104.176.213
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (res.statusCode >= 400) reject(new Error(parsed.message || `Brevo ${res.statusCode}`));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 })
    .format(amount)
    .replace(/\u202f|\u00a0/g, '\u0020')
    + ' FCFA';
}

export async function sendOrderConfirmationEmail({ order, totalPrice }) {
  if (!isBrevoConfigured()) {
    console.log('[Email] BREVO_API_KEY not configured, skipping email.');
    return false;
  }

  const customerEmail = order.orderContact?.email || order.customerEmail;
  if (!customerEmail) {
    console.log('[Email] No customer email, skipping.');
    return false;
  }

  const profile = order.profile ?? {};
  const customization = order.customization ?? {};
  const contact = order.orderContact ?? {};
  const pack = order.packageSelection ?? {};
  const orderId = (order.orderId ?? '').slice(0, 8).toUpperCase();

  const cardUrl = order.finalCardUrl || '';
  const deliveryPhone = escapeHtml(contact.phone || profile.phone || '');
  const safeFullName = escapeHtml(profile.fullName || contact.name || 'Client');
  const safePackName = escapeHtml(pack.name || '-');
  const safeMaterial = escapeHtml(customization.material || '-');
  const safeFinish = escapeHtml(customization.finish || '-');
  const safeFoil = escapeHtml(customization.foil || '-');
  const safeRole = escapeHtml(profile.role || '');
  const safeCompany = escapeHtml(profile.company || '');
  const safePhone = escapeHtml(profile.phone || '');
  const safeEmail = escapeHtml(profile.email || '');
  const pdfUrl = `https://tapal.geochifa.com/api/orders/${encodeURIComponent(order.orderId)}/receipt.pdf`;
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:2rem 1rem;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 32px rgba(0,0,0,.08);">

  <!-- HEADER -->
  <tr><td style="background:#1a1a1a;padding:1.6rem 2rem;text-align:center;">
    <img src="https://tekko.geochifa.com/tekko-logo.png" alt="TEKKO" width="120" style="display:block;margin:0 auto .6rem;"/>
    <img src="https://geochifa.com/images/logo-nobg.png" alt="GeoChifâ" width="28" style="display:block;margin:0 auto;opacity:.6;"/>
    <div style="color:rgba(255,255,255,.4);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;margin-top:.3rem;">Confirmation de commande</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:1.8rem 2rem 0;">

    <!-- Greeting -->
    <p style="margin:0 0 .5rem;color:#1a1a1a;font-size:.95rem;font-weight:600;">Bonjour ${safeFullName} 👋</p>
    <p style="margin:0 0 1.5rem;color:#555;font-size:.83rem;line-height:1.65;">
      Votre paiement a bien été reçu et votre commande <strong style="color:#1a1a1a;">#${orderId}</strong> est confirmée.<br/>
      Notre équipe prépare votre carte NFC et vous contactera pour organiser la livraison.
    </p>

    <!-- Order summary -->
    <div style="background:#f7f5f1;border-radius:12px;padding:1.1rem 1.2rem;margin-bottom:1.2rem;">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaa;margin-bottom:.8rem;">Détails de la commande</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:.82rem;border-collapse:collapse;">
        <tr>
          <td style="padding:.35rem 0;color:#888;">Pack</td>
          <td style="padding:.35rem 0;text-align:right;font-weight:700;color:#1a1a1a;">${safePackName} (${pack.quantity || 1} carte${(pack.quantity||1)>1?'s':''})</td>
        </tr>
        <tr>
          <td style="padding:.35rem 0;color:#888;">Matériau</td>
          <td style="padding:.35rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeMaterial}</td>
        </tr>
        <tr>
          <td style="padding:.35rem 0;color:#888;">Finition</td>
          <td style="padding:.35rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeFinish}</td>
        </tr>
        <tr>
          <td style="padding:.35rem 0;color:#888;">Dorure</td>
          <td style="padding:.35rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeFoil}</td>
        </tr>
        <tr><td colspan="2" style="padding:.3rem 0;"><div style="border-top:1.5px dashed #dedad4;"></div></td></tr>
        <tr>
          <td style="padding:.5rem 0 .2rem;color:#1a1a1a;font-weight:700;font-size:.9rem;">Total payé</td>
          <td style="padding:.5rem 0 .2rem;text-align:right;font-weight:900;color:#e85d26;font-size:1rem;">${formatMoney(totalPrice)}</td>
        </tr>
      </table>
    </div>

    <!-- Profile card -->
    <div style="background:#f7f5f1;border-radius:12px;padding:1.1rem 1.2rem;margin-bottom:1.2rem;">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaa;margin-bottom:.8rem;">Profil de la carte</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:.82rem;border-collapse:collapse;">
        ${profile.fullName ? `<tr><td style="padding:.3rem 0;color:#888;width:40%;">Nom</td><td style="padding:.3rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeFullName}</td></tr>` : ''}
        ${profile.role ? `<tr><td style="padding:.3rem 0;color:#888;">Rôle</td><td style="padding:.3rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeRole}</td></tr>` : ''}
        ${profile.company ? `<tr><td style="padding:.3rem 0;color:#888;">Entreprise</td><td style="padding:.3rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeCompany}</td></tr>` : ''}
        ${profile.phone ? `<tr><td style="padding:.3rem 0;color:#888;">Téléphone</td><td style="padding:.3rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safePhone}</td></tr>` : ''}
        ${profile.email ? `<tr><td style="padding:.3rem 0;color:#888;">Email</td><td style="padding:.3rem 0;text-align:right;font-weight:600;color:#1a1a1a;">${safeEmail}</td></tr>` : ''}
      </table>
    </div>

    <!-- Card URL -->
    ${cardUrl && !customization.customDomain ? `
    <div style="background:#eef6ff;border:1.5px solid #b8d4f0;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1.2rem;">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5a9bd5;margin-bottom:.5rem;">Votre carte digitale</div>
      <p style="margin:0 0 .5rem;font-size:.82rem;color:#444;line-height:1.5;">Votre carte digitale est accessible à l'adresse suivante :</p>
      <a href="${escapeHtml(cardUrl)}" style="display:inline-block;color:#e85d26;font-weight:700;font-size:.88rem;word-break:break-all;">${escapeHtml(cardUrl)}</a>
    </div>
    ` : ''}

    <!-- Delivery info -->
    <div style="background:#f0faf4;border:1.5px solid #c5e8d4;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1.2rem;">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6abf8a;margin-bottom:.5rem;">Livraison</div>
      <p style="margin:0;font-size:.82rem;color:#444;line-height:1.6;">
        Votre commande sera livrée sous <strong>${pack.quantity > 1 ? '5 jours ouvrés' : '72 heures'}</strong>.${deliveryPhone ? `<br/>Nous vous contacterons au <strong>${deliveryPhone}</strong> pour convenir des modalités de livraison.` : ''}
      </p>
    </div>

    <!-- PDF Receipt -->
    <div style="text-align:center;margin-bottom:1.8rem;">
      <a href="${escapeHtml(pdfUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;font-size:.82rem;font-weight:700;padding:.7rem 1.6rem;border-radius:10px;text-decoration:none;">
        📄 Télécharger le reçu PDF
      </a>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f7f5f1;border-top:1px solid #ece9e4;padding:1.1rem 2rem;text-align:center;">
    <img src="https://tekko.geochifa.com/tekko-logo.png" alt="TEKKO" width="60" style="display:inline-block;vertical-align:middle;margin-right:.4rem;"/>
    <span style="color:#ccc;font-size:.7rem;vertical-align:middle;">by GeoChifâ · Dakar, Sénégal</span>
    <p style="margin:.5rem 0 0;font-size:.65rem;color:#ccc;">Pour toute question : <a href="mailto:noreply@geochifa.com" style="color:#bbb;">noreply@geochifa.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const fromAddress = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || 'noreply@tekko.sn';

  try {
    await sendViaBrevo({
      from: fromAddress,
      to: customerEmail,
      subject: `Votre commande TEKKO #${orderId} est confirmée ✓`,
      html,
    });
    console.log(`[Email] Confirmation sent to ${customerEmail} for order ${orderId}`);
    return true;
  } catch (err) {
    console.error('[Email] Failed to send:', err.message);
    return false;
  }
}
