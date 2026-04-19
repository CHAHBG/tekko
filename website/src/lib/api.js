export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${apiBaseUrl}${endpoint}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const msg = typeof payload === 'object' && payload !== null && payload.error
      ? payload.error
      : (typeof payload === 'string' ? payload : 'Request failed.');
    const err = new Error(msg);
    err.status = response.status;
    if (typeof payload === 'object' && payload !== null && payload.error) {
      err.code = payload.error;
    }
    throw err;
  }

  return payload;
}

export function submitOrder(formData) {
  return request('/orders', {
    method: 'POST',
    body: formData,
  });
}

export function submitCleEnMainOrder(data) {
  return request('/cle-en-main', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function startCheckout(orderId) {
  return request(`/orders/${orderId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export function fetchAdminOrders(token) {
  return request('/admin/orders', {
    headers: {
      'x-admin-token': token,
    },
  });
}

export function updateAdminOrder(orderId, updates, token) {
  return request(`/admin/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(updates),
  });
}

export function updateAdminCard(orderId, cardData, token) {
  return request(`/admin/orders/${orderId}/card`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(cardData),
  });
}

export function fetchPublicCard(slug) {
  return request(`/cards/${slug}`);
}

export function fetchOrderPortal(orderId, token) {
  const q = new URLSearchParams({ token: String(token) });
  return request(`/orders/${encodeURIComponent(orderId)}/portal?${q}`);
}

export function fetchCardAnalytics(orderId, token, days = 30) {
  const q = new URLSearchParams({ token: String(token), days: String(days) });
  return request(`/orders/${encodeURIComponent(orderId)}/card-analytics?${q}`);
}

export function fetchInventory() {
  return request('/inventory');
}

export function setInventoryItem(type, key, inStock, token) {
  return request(`/admin/inventory/${type}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({ inStock }),
  });
}

export function adminLogin(email, password) {
  return request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function checkDomain(domain) {
  return request(`/domain/check?domain=${encodeURIComponent(domain)}`);
}

export function validateCoupon(code) {
  return request(`/coupons/validate?code=${encodeURIComponent(code)}`);
}

export function fetchAdminCoupons(token) {
  return request('/admin/coupons', { headers: { 'x-admin-token': token } });
}

export function createAdminCoupon(data, token) {
  return request('/admin/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(data),
  });
}

export function deleteAdminCoupon(code, token) {
  return request(`/admin/coupons/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': token },
  });
}

export function submitCeremony(data) {
  return request('/ceremonies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function fetchAdminCeremonies(token) {
  return request('/admin/ceremonies', { headers: { 'x-admin-token': token } });
}

export function updateAdminCeremony(id, updates, token) {
  return request(`/admin/ceremonies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(updates),
  });
}

export function generateAdminInvoice(data, token) {
  return request('/admin/invoices/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(data),
  });
}

export function regeneratePaymentLink(orderId, token) {
  return request(`/admin/orders/${orderId}/payment-link`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
  });
}

export function applyAdminCoupon(orderId, code, token) {
  return request(`/admin/orders/${orderId}/coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ code }),
  });
}

export function uploadAdminAssets(orderId, { avatarFile, logoFile }, token) {
  const form = new FormData();
  if (avatarFile) form.append('avatarFile', avatarFile);
  if (logoFile) form.append('logoFile', logoFile);
  return request(`/admin/orders/${orderId}/upload-asset`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: form,
  });
}

export function fetchAdminAnalytics(period, token) {
  return request(`/admin/analytics?period=${encodeURIComponent(period)}`, {
    headers: { 'x-admin-token': token },
  });
}

export function fetchAdminAnalyticsVisits(token, limit) {
  return request(`/admin/analytics/visits?limit=${limit ?? 100}`, {
    headers: { 'x-admin-token': token },
  });
}

// ── Voice assistant ──────────────────────────────────────────────
export function voiceExtract(data) {
  return request('/voice/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function voiceDesignSuggest(data) {
  return request('/voice/design-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function voiceValidate(orderId) {
  return request(`/voice/validate/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function voiceTranscribeWolof(audioBlob, lang = 'wo') {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('lang', lang);
  return request('/voice/transcribe-wolof', {
    method: 'POST',
    body: formData,
  });
}