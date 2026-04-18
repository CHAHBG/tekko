import geoip from 'geoip-lite';
import UAParser from 'ua-parser-js';
import { createHash } from 'node:crypto';

// Country names in French (Africa-focused + major countries)
const COUNTRY_NAMES = {
  // West Africa
  SN: 'Sénégal', CI: "Côte d'Ivoire", ML: 'Mali', BF: 'Burkina Faso',
  GN: 'Guinée', GH: 'Ghana', NG: 'Nigéria', CM: 'Cameroun',
  TG: 'Togo', BJ: 'Bénin', NE: 'Niger', MR: 'Mauritanie',
  SL: 'Sierra Leone', LR: 'Libéria', GM: 'Gambie', GW: 'Guinée-Bissau',
  CV: 'Cap-Vert',
  // North Africa
  MA: 'Maroc', TN: 'Tunisie', DZ: 'Algérie', EG: 'Égypte', LY: 'Libye',
  // Central & East Africa
  CD: 'RD Congo', CG: 'Congo', GA: 'Gabon', AO: 'Angola',
  KE: 'Kenya', ET: 'Éthiopie', TZ: 'Tanzanie', UG: 'Ouganda',
  RW: 'Rwanda', BI: 'Burundi', MZ: 'Mozambique', MG: 'Madagascar',
  // Southern Africa
  ZA: 'Afrique du Sud', ZW: 'Zimbabwe', ZM: 'Zambie',
  // Islands / Coastal
  RE: 'Réunion', MU: 'Maurice', DJ: 'Djibouti',
  // Europe
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg',
  GB: 'Royaume-Uni', DE: 'Allemagne', IT: 'Italie', ES: 'Espagne',
  PT: 'Portugal', NL: 'Pays-Bas', SE: 'Suède', NO: 'Norvège',
  DK: 'Danemark', FI: 'Finlande', PL: 'Pologne', RU: 'Russie',
  // Americas
  US: 'États-Unis', CA: 'Canada', BR: 'Brésil', MX: 'Mexique',
  // Asia-Pacific
  CN: 'Chine', JP: 'Japon', IN: 'Inde', AU: 'Australie',
  // Middle East
  SA: 'Arabie Saoudite', AE: 'Émirats Arabes Unis', QA: 'Qatar', TR: 'Turquie',
};

/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji.
 * Each letter maps to a regional indicator symbol Unicode character.
 */
export function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + code.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + code.toUpperCase().charCodeAt(1) - 65,
    );
  } catch {
    return '🌍';
  }
}

function normalizeIp(ip) {
  if (!ip) return '';
  // Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4)
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function extractIp(request) {
  // Trust X-Forwarded-For (set by Nginx reverse proxy), take leftmost = real client IP
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers['x-real-ip'] || request.socket?.remoteAddress || '';
}

function hashIp(ip, salt) {
  return createHash('sha256')
    .update(ip + (salt || 'tekko-analytics-default-salt'))
    .digest('hex')
    .slice(0, 20);
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

function classifyKind(path) {
  if (path.startsWith('/c/')) return 'card';
  if (path.startsWith('/ceremonies')) return 'ceremony';
  return 'page';
}

function extractSlug(path) {
  if (path.startsWith('/c/')) return path.slice(3).split('/')[0] || null;
  return null;
}

function resolveCountry(code) {
  if (!code) return '';
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

function normalizeReferrer(ref, host) {
  if (!ref) return '';
  try {
    const u = new URL(ref);
    const hostname = u.hostname.replace(/^www\./, '');
    const currentHost = (host || '').split(':')[0].replace(/^www\./, '');
    // Same-origin referrers are internal navigation — treat as direct
    if (
      currentHost &&
      (hostname === currentHost ||
        hostname.endsWith('.' + currentHost) ||
        currentHost.endsWith('.' + hostname))
    ) {
      return '';
    }
    return hostname;
  } catch {
    // Not a valid absolute URL; store the raw value trimmed to 100 chars
    return ref.slice(0, 100);
  }
}

/**
 * Build a full visit event payload from an Express request.
 * @param {object} request  - Express request object
 * @param {object} extra    - Client-provided overrides: { path, referrer, screen }
 * @returns {object} visit payload ready to be persisted
 */
export function buildVisitPayload(request, extra = {}) {
  const rawIp = normalizeIp(extractIp(request));
  const ipSalt = process.env.IP_HASH_SALT || 'tekko-analytics-default-salt';
  const ipHash = hashIp(rawIp, ipSalt);

  const ua = request.headers['user-agent'] || '';
  const uaResult = new UAParser(ua).getResult();
  // ua-parser-js: device.type is 'mobile'|'tablet'|'smarttv'|... or undefined for desktop
  const deviceType = uaResult.device.type || 'desktop';

  const path =
    extra.path && String(extra.path).startsWith('/')
      ? String(extra.path)
      : request.path || '/';
  const slug = extractSlug(path);
  const kind = classifyKind(path);
  const host = request.headers['host'] || '';

  // Geo lookup — skip for private/loopback IPs (local dev environment)
  let geo = null;
  if (rawIp && !isPrivateIp(rawIp)) {
    geo = geoip.lookup(rawIp);
  }

  const countryCode = geo?.country || '';

  // Prefer client-sent document.referrer over the HTTP Referer header.
  // The HTTP Referer of a fetch() call points to the page making the request,
  // not the page that sent the user to the current page.
  const rawReferrer =
    extra.referrer !== undefined
      ? String(extra.referrer)
      : request.headers['referer'] || '';
  const referrer = normalizeReferrer(rawReferrer, host);

  return {
    visitedAt: new Date().toISOString(),
    kind,
    path,
    slug,
    host,
    referrer,
    userAgent: ua,
    browser: uaResult.browser.name || '',
    browserVersion: uaResult.browser.major || '',
    os: uaResult.os.name || '',
    osVersion: uaResult.os.version || '',
    deviceType,
    ipRaw: rawIp,
    ipHash,
    countryCode,
    country: resolveCountry(countryCode),
    region: geo?.region || '',
    city: geo?.city || '',
    latitude: geo?.ll?.[0] ?? null,
    longitude: geo?.ll?.[1] ?? null,
    language:
      (request.headers['accept-language'] || '').split(',')[0].split('-')[0] || '',
    screen: extra.screen ? String(extra.screen).slice(0, 20) : '',
  };
}
