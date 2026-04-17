function mapPaymentStatus(rawStatus) {
  const normalizedStatus = String(rawStatus ?? '').trim().toUpperCase();

  if (['ACCEPTED', 'SUCCESS', 'COMPLETED', 'PAID', '00'].includes(normalizedStatus)) {
    return 'paid';
  }

  if (['REFUSED', 'FAILED', 'CANCELLED', 'CANCELED', 'ERROR'].includes(normalizedStatus)) {
    return 'failed';
  }

  if (['PENDING', 'WAITING', 'CREATED', 'INIT'].includes(normalizedStatus)) {
    return 'pending';
  }

  return 'unknown';
}

function sanitizeDescription(text) {
  return String(text ?? '')
    .replace(/[#$&_\/]/g, ' ')
    .trim()
    .slice(0, 120);
}

function makeCustomerSurname(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(1).join(' ') || parts[0] || 'Tapal';
}

export function isCinetPayConfigured(environment = process.env) {
  return Boolean(
    environment.CINETPAY_API_KEY &&
      environment.CINETPAY_SITE_ID &&
      environment.CINETPAY_NOTIFY_URL &&
      environment.CINETPAY_RETURN_URL &&
      environment.CINETPAY_CANCEL_URL,
  );
}

export async function initializeCinetPayCheckout({ order, environment = process.env }) {
  if (!isCinetPayConfigured(environment)) {
    return {
      configured: false,
      reason: 'CinetPay environment variables are missing.',
    };
  }

  const transactionId = `TAPAL${Date.now()}${order.orderId.slice(0, 4).toUpperCase()}`;
  const payload = {
    apikey: environment.CINETPAY_API_KEY,
    site_id: environment.CINETPAY_SITE_ID,
    transaction_id: transactionId,
    amount: Number(order.packPrice),
    currency: order.currency,
    description: sanitizeDescription(`Tapal ${order.packageSelection.name ?? order.packKey} package`),
    notify_url: environment.CINETPAY_NOTIFY_URL,
    return_url: environment.CINETPAY_RETURN_URL,
    channels: 'ALL',
    lang: 'fr',
    metadata: order.orderId,
    customer_id: order.orderId,
    customer_name: order.orderContact.name ?? order.customerName,
    customer_surname: makeCustomerSurname(order.profile.fullName ?? order.customerName),
    customer_phone_number: order.orderContact.phone ?? order.customerPhone,
    customer_email: order.orderContact.email ?? order.customerEmail,
    customer_address: order.orderContact.deliveryAddress ?? 'Dakar',
    customer_city: order.orderContact.deliveryCity ?? 'Dakar',
    customer_country: 'SN',
    customer_state: 'SN',
    customer_zip_code: order.orderContact.postalCode ?? '11000',
    invoice_data: {
      Pack: order.packageSelection.name ?? order.packKey,
      Client: order.profile.fullName ?? order.customerName,
      Slug: order.slug,
    },
  };

  const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Tapal/1.0 (+https://tapal.geochifa.com)',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok || result.code !== '201' || !result.data?.payment_url) {
    throw new Error(result.description || result.message || 'CinetPay checkout initialization failed.');
  }

  return {
    configured: true,
    transactionId,
    paymentUrl: result.data.payment_url,
    raw: result,
  };
}

export function normalizeCinetPayWebhookPayload(body) {
  const paymentReference =
    body.transaction_id ?? body.cpm_trans_id ?? body.payment_token ?? body.reference ?? '';
  const paymentStatus = mapPaymentStatus(
    body.cpm_trans_status ?? body.status ?? body.payment_status ?? body.code,
  );

  return {
    paymentReference,
    paymentStatus,
    payload: body,
  };
}