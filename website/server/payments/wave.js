import crypto from 'node:crypto';

export function isWaveConfigured(environment = process.env) {
  return Boolean(environment.WAVE_API_KEY);
}

export async function initializeWaveCheckout({ order, totalPrice, overrideSuccessUrl, environment = process.env }) {
  if (!isWaveConfigured(environment)) {
    return { configured: false, reason: 'Wave API key is not configured.' };
  }

  const apiKey = environment.WAVE_API_KEY;
  const signingSecret = environment.WAVE_SIGNING_SECRET;
  const successUrl = overrideSuccessUrl || environment.WAVE_SUCCESS_URL || 'https://tapal.geochifa.com/?payment=success';
  const errorUrl = environment.WAVE_ERROR_URL || 'https://tapal.geochifa.com/?payment=error';

  const body = JSON.stringify({
    amount: String(totalPrice || order.packPrice),
    currency: 'XOF',
    success_url: successUrl,
    error_url: errorUrl,
    client_reference: order.orderId,
  });

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (signingSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = `${timestamp}${body}`;
    const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
    headers['Wave-Signature'] = `t=${timestamp},v1=${signature}`;
  }

  const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Wave] Checkout error:', response.status, errorText);
    return { configured: true, error: `Wave API error: ${response.status}` };
  }

  const session = await response.json();

  return {
    configured: true,
    checkoutId: session.id,
    transactionId: session.transaction_id,
    paymentUrl: session.wave_launch_url,
    raw: session,
  };
}

export function verifyWaveWebhook(rawBody, signatureHeader, environment = process.env) {
  const webhookSecret = environment.WAVE_WEBHOOK_SECRET || environment.WAVE_SIGNING_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const parts = signatureHeader.split(',');
  const timestamp = parts[0]?.split('=')?.[1];
  const signatures = parts.slice(1).map((p) => p.split('=')[1]);

  if (!timestamp || signatures.length === 0) return false;

  const expected = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}${rawBody}`).digest('hex');
  return signatures.includes(expected);
}

export function normalizeWaveWebhookPayload(body) {
  const eventType = body?.type ?? '';
  const data = body?.data ?? {};

  let paymentStatus = 'pending';
  if (eventType === 'checkout.session.completed' && data.payment_status === 'succeeded') {
    paymentStatus = 'paid';
  } else if (eventType === 'checkout.session.payment_failed') {
    paymentStatus = 'failed';
  }

  return {
    clientReference: data.client_reference ?? null,
    checkoutId: data.id ?? null,
    transactionId: data.transaction_id ?? null,
    paymentStatus,
    payload: body,
  };
}
