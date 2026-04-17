import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { startCheckout, submitOrder, fetchInventory, validateCoupon, checkDomain } from '../lib/api';
import {
  analyzePrompt,
  buildOrderBrief,
  buildWhatsAppUrl,
  calculateTotalPrice,
  composeCardUrl,
  createSlug,
  defaultAssets,
  defaultCustomization,
  defaultOrderContact,
  defaultProfile,
  foilCatalog,
  formatMoney,
  getAssetDisplayUrl,
  getInitials,
  materialCatalog,
  orderContactFields,
  packCatalog,
  profileFields,
  serializeAsset,
  themeCatalog,
} from '../lib/catalog';

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.85L.073 23.928a.5.5 0 0 0 .611.611l6.181-1.462A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.032-1.384l-.36-.214-3.732.882.897-3.63-.236-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}>
      <path d="M2 12c1.5-3 4-5 6-5s3.5 2 5.5 2 4-2 6-2c1 0 1.8.4 2.5 1M2 17c1.5-3 4-5 6-5s3.5 2 5.5 2 4-2 6-2c1 0 1.8.4 2.5 1" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

const fontStyleMap = {
  moderne:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  elegant:   "Georgia, 'Times New Roman', serif",
  technique: "'Courier New', Courier, monospace",
  arrondi:   "'Trebuchet MS', 'Comic Sans MS', Nunito, Arial, sans-serif",
  roboto:    "'Roboto', sans-serif",
  sf:        "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
  segoe:     "'Segoe UI', Calibri, Arial, sans-serif",
};

function loadGoogleMaps() {
  if (window._googleMapsPromise) return window._googleMapsPromise;
  if (window.google?.maps?.places) return Promise.resolve();
  window._googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&language=fr`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { window._googleMapsPromise = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(script);
  });
  return window._googleMapsPromise;
}

function LocationPicker({ value, onChange }) {
  const inputRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [mapsReady, setMapsReady] = useState(() => !!window.google?.maps?.places);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapsReady || !inputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const label = inputRef.current?.value || place.formatted_address || place.name || '';
      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();
      setSelected({ lat, lng, label });
      onChange(label);
    });
    return () => {
      window.google?.maps?.event.removeListener(listener);
    };
  }, [mapsReady, onChange]);

  const staticMapUrl = selected?.lat != null
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${selected.lat},${selected.lng}&zoom=15&size=480x180&scale=2&markers=color:red%7C${selected.lat},${selected.lng}&key=${GOOGLE_MAPS_KEY}`
    : null;

  return (
    <div className="location-picker">
      <div className="location-search-row">
        <div className="location-input-wrap">
          <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          <input
            ref={inputRef}
            type="text"
            className="location-input"
            defaultValue={value || ''}
            placeholder="Rechercher un lieu, une entreprise..."
            onBlur={(e) => { if (e.target.value && e.target.value !== value) onChange(e.target.value); }}
          />
        </div>
      </div>
      {staticMapUrl && (
        <div className="location-map-wrap">
          <img src={staticMapUrl} alt="Carte" className="location-map-static" />
          <div className="location-map-label">{selected.label}</div>
        </div>
      )}
    </div>
  );
}

function DomainChecker({ value, onChange, onResult }) {
  const [input, setInput] = useState(value || '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setInput(value || '');
  }, [value]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function runCheck(domain) {
    const cleaned = domain.trim().toLowerCase().replace(/^[.\s]+/, '');
    if (!cleaned || !/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/.test(cleaned)) {
      setResult(null);
      onChange(cleaned);
      onResult(null);
      return;
    }
    setChecking(true);
    checkDomain(cleaned)
      .then((r) => { setResult(r); onChange(cleaned); onResult(r); })
      .catch(() => { const err = { error: 'Verification impossible.' }; setResult(err); onResult(err); })
      .finally(() => setChecking(false));
  }

  function handleInput(e) {
    const val = e.target.value.replace(/^[.\s]+/, '');
    setInput(val);
    setResult(null);
    onChange(val.trim().toLowerCase().replace(/^[.\s]+/, ''));
    onResult(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runCheck(val), 700);
  }

  const statusClass = result?.error ? 'warn' : result?.available === true ? 'ok' : result?.available === false ? 'taken' : 'warn';

  return (
    <div className="domain-checker">
      <div className="domain-input-wrap">
        <span className="domain-prefix">www.</span>
        <input
          type="text"
          className="domain-input"
          value={input}
          placeholder="monentreprise.com"
          onChange={handleInput}
        />
        {checking && <span className="domain-spinner" />}
      </div>
      {result && !checking && (
        <div className={`domain-result domain-result-${statusClass}`}>
          {result.error
            ? `${result.error}`
            : result.available === true
              ? `Disponible - ${result.price.toLocaleString('fr-FR')} FCFA/an${result.coveredByUs ? ' (inclus par TEKKO)' : ` - dont ${result.userShareFcfa.toLocaleString('fr-FR')} FCFA a votre charge`}`
              : result.available === false
                ? 'Ce domaine est deja pris. Essayez un autre.'
                : 'Impossible de verifier la disponibilite.'}
        </div>
      )}
    </div>
  );
}

/**
 * Gesture-based image repositioning for preview containers.
 * Attach returned callback ref to any container wrapping a gesture-controlled image.
 * - Mouse: drag to reposition, scroll wheel to zoom
 * - Trackpad: two-finger scroll to zoom, drag to reposition
 * - Mobile: single-finger drag to reposition, pinch to zoom
 */
function useGestureAttach(assetKey, assetsRef, adjustRef) {
  const s = useRef({ drag: null, pinch: null, cleanup: null });
  return useCallback((el) => {
    // cleanup previous element's listeners
    s.current.cleanup?.();
    s.current.cleanup = null;
    if (!el) return;

    const c = s.current;
    const A = () => (assetsRef.current ?? {})[assetKey] ?? {};
    const adj = (f, v) => adjustRef.current?.(assetKey, f, v);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const wheel = (e) => {
      e.preventDefault();
      adj('zoom', clamp((A().zoom ?? 1) - e.deltaY * 0.004, 0.6, 2.4));
    };

    const mdown = (e) => {
      if (e.button !== 0) return;
      const a = A(); const r = el.getBoundingClientRect();
      c.drag = { x: e.clientX, y: e.clientY, px: a.positionX ?? 50, py: a.positionY ?? 50, w: r.width, h: r.height };
      el.classList.add('gesture--active');
    };
    const mmove = (e) => {
      if (!c.drag) return;
      const d = c.drag;
      adj('positionX', clamp(d.px + (e.clientX - d.x) * 100 / d.w, 0, 100));
      adj('positionY', clamp(d.py + (e.clientY - d.y) * 100 / d.h, 0, 100));
    };
    const mup = () => { c.drag = null; el.classList.remove('gesture--active'); };

    const tstart = (e) => {
      const t = e.touches;
      if (t.length === 2) {
        e.preventDefault();
        c.pinch = { d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), z: A().zoom ?? 1 };
        c.drag = null;
      } else if (t.length === 1) {
        const a = A(); const r = el.getBoundingClientRect();
        c.drag = { x: t[0].clientX, y: t[0].clientY, px: a.positionX ?? 50, py: a.positionY ?? 50, w: r.width, h: r.height };
      }
    };
    const tmove = (e) => {
      const t = e.touches;
      if (t.length === 2 && c.pinch) {
        e.preventDefault();
        const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        adj('zoom', clamp(c.pinch.z * d / c.pinch.d, 0.6, 2.4));
      } else if (t.length === 1 && c.drag) {
        e.preventDefault();
        const dr = c.drag;
        adj('positionX', clamp(dr.px + (t[0].clientX - dr.x) * 100 / dr.w, 0, 100));
        adj('positionY', clamp(dr.py + (t[0].clientY - dr.y) * 100 / dr.h, 0, 100));
      }
    };
    const tend = () => { c.drag = null; c.pinch = null; el.classList.remove('gesture--active'); };

    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('mousedown', mdown);
    window.addEventListener('mousemove', mmove);
    window.addEventListener('mouseup', mup);
    el.addEventListener('touchstart', tstart, { passive: false });
    el.addEventListener('touchmove', tmove, { passive: false });
    el.addEventListener('touchend', tend);

    c.cleanup = () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('mousedown', mdown);
      window.removeEventListener('mousemove', mmove);
      window.removeEventListener('mouseup', mup);
      el.removeEventListener('touchstart', tstart);
      el.removeEventListener('touchmove', tmove);
      el.removeEventListener('touchend', tend);
      el.classList.remove('gesture--active');
    };
  }, []); // stable — reads from refs, no deps needed
}

function AssetField({ title, asset, onFileChange, onRemoteChange, onAdjust, rotationEnabled = false }) {
  const hasImage = asset.sourceType !== 'none';
  return (
    <div className="asset-block">
      <p className="asset-title">{title}</p>
      <div className="asset-source-grid">
        <label className="field span-full upload-field">
          <span>Image depuis l'appareil <em className="upload-hint">(max 8 Mo — JPG, PNG, WebP)</em></span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
        </label>
        <label className="field span-full">
          <span>Ou lien image (URL)</span>
          <input
            type="url"
            value={asset.remoteUrl}
            placeholder="https://example.com/image.jpg"
            onChange={(event) => onRemoteChange(event.target.value)}
          />
        </label>
      </div>
      {hasImage && (
        <div className="adjuster-grid">
          <label className="field">
            <span>Zoom</span>
            <input type="range" min="0.6" max="2.4" step="0.01" value={asset.zoom}
              onChange={(event) => onAdjust('zoom', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Horizontal</span>
            <input type="range" min="0" max="100" step="1" value={asset.positionX}
              onChange={(event) => onAdjust('positionX', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Vertical</span>
            <input type="range" min="0" max="100" step="1" value={asset.positionY}
              onChange={(event) => onAdjust('positionY', Number(event.target.value))} />
          </label>
          {rotationEnabled ? (
            <label className="field">
              <span>Rotation</span>
              <input type="range" min="-35" max="35" step="1" value={asset.rotation}
                onChange={(event) => onAdjust('rotation', Number(event.target.value))} />
            </label>
          ) : null}
          <label className="field">
            <span>Opacité</span>
            <input type="range" min="0.3" max="1" step="0.01" value={asset.opacity}
              onChange={(event) => onAdjust('opacity', Number(event.target.value))} />
          </label>
          <p className="adjuster-gesture-hint">↔ Glisser · Molette/Pincer: Zoom dans l'aperçu</p>
        </div>
      )}
    </div>
  );
}

export function BuilderView() {
  const [profile, setProfile] = useState(defaultProfile);
  const [orderContact, setOrderContact] = useState(defaultOrderContact);
  const [customization, setCustomization] = useState(defaultCustomization);
  const [assets, setAssets] = useState(defaultAssets);
  const [selectedPackKey, setSelectedPackKey] = useState('pro');
  const [autoStyle, setAutoStyle] = useState(false);
  const [bambaMode, setBambaMode] = useState(false);
  const [previewTab, setPreviewTab] = useState('digital');
  const [cardLayout, setCardLayout] = useState('classic');
  const [mobileView, setMobileView] = useState('form');
  const mobileScrollPos = useRef(0);
  const [customRefFile, setCustomRefFile] = useState(null);
  const [customRefPreview, setCustomRefPreview] = useState('');
  const [copyState, setCopyState] = useState('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const [submitState, setSubmitState] = useState({ status: 'idle', message: '', order: null, paymentUrl: '' });
  const [showValidation, setShowValidation] = useState(false);
  const [inventory, setInventory] = useState({});
  const [activeSection, setActiveSection] = useState('profile');
  const [savedOrderId, setSavedOrderId] = useState(null);
  const [savedFinalCardUrl, setSavedFinalCardUrl] = useState('');
  const [savedPreviewQrUrl, setSavedPreviewQrUrl] = useState('');

  // ── DOMAIN ───────────────────────────────────────────────────────
  const [wantCustomDomain, setWantCustomDomain] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [domainResult, setDomainResult] = useState(null);

  // ── COUPON ───────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountType, discountValue }
  const [couponStatus, setCouponStatus] = useState({ state: 'idle', message: '' }); // idle | loading | ok | error

  // Track which delivery fields the user has manually edited
  const deliveryDirty = useRef({ name: false, email: false, phone: false, deliveryCity: false });

  // Section refs for auto-switching preview
  const sectionRefs = useRef({});
  const setSectionRef = useCallback((key) => (el) => { sectionRefs.current[key] = el; }, []);
  const userSwitchedPreview = useRef(false);

  // Auto-switch preview based on visible form section
  useEffect(() => {
    const entries = {};
    const physicalSections = ['physical'];
    const digitalSections = ['profile', 'images', 'style'];
    const allSections = ['profile', 'images', 'style', 'physical', 'delivery', 'summary', 'payment'];

    const observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((e) => { entries[e.target.dataset.section] = e.isIntersecting; });
        // Track active section for step indicator
        const visible = allSections.filter((k) => entries[k]);
        if (visible.length > 0) setActiveSection(visible[0]);
        if (userSwitchedPreview.current) return;
        const anyPhysical = physicalSections.some((k) => entries[k]);
        const anyDigital = digitalSections.some((k) => entries[k]);
        if (anyPhysical && !anyDigital) {
          setPreviewTab('physical');
        } else if (anyDigital && !anyPhysical) {
          setPreviewTab('digital');
        }
      },
      { threshold: 0.15 },
    );

    // Observe after a tick to let DOM settle
    const timer = setTimeout(() => {
      Object.entries(sectionRefs.current).forEach(([key, el]) => {
        if (el) { el.dataset.section = key; observer.observe(el); }
      });
    }, 200);

    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [bambaMode]);

  const assetRef = useRef(assets);
  const deferredPrompt = useDeferredValue(customization.stylePrompt);
  const promptSuggestion = analyzePrompt(deferredPrompt);
  const activeThemeKey = autoStyle ? promptSuggestion.themeKey : customization.themeKey;
  const activeTheme = themeCatalog[activeThemeKey];
  const activeAccent = autoStyle ? promptSuggestion.accent : customization.accent;
  const packageSelection = packCatalog[selectedPackKey];

  const totalPrice = useMemo(
    () => calculateTotalPrice({ packageSelection, material: customization.material, foil: customization.foil }),
    [customization.foil, customization.material, packageSelection],
  );

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === 'percent') {
      return Math.round(totalPrice * appliedCoupon.discountValue / 100);
    }
    return Math.min(appliedCoupon.discountValue, totalPrice);
  }, [appliedCoupon, totalPrice]);

  const normalizedCustomDomain = customDomain.trim().toLowerCase();
  const domainMatchesSelection = domainResult?.domain === normalizedCustomDomain;
  const domainSurcharge = wantCustomDomain && domainMatchesSelection && domainResult?.available === true
    ? (domainResult.userShareFcfa ?? 0)
    : 0;
  const finalPrice = totalPrice - discountAmount + domainSurcharge;
  const [previewToken] = useState(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  });
  const slug = useMemo(
    () => {
      const base = createSlug(profile.fullName.split(' ')[0]) || 'tekko-card';
      return `${base}-${previewToken}`;
    },
    [profile.fullName, previewToken],
  );
  const finalCardUrl = composeCardUrl(slug);
  const initials = getInitials(profile.fullName);
  const avatarUrl = getAssetDisplayUrl(assets.avatar);

  // Always-current refs for gesture handlers (set synchronously during render)
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const adjustAssetRef = useRef(null);

  // Gesture callback refs — one per asset type, applied to preview containers
  const avatarGestureRef = useGestureAttach('avatar', assetsRef, adjustAssetRef);
  const artworkGestureRef = useGestureAttach('artwork', assetsRef, adjustAssetRef);
  const coverGestureRef = useGestureAttach('cover', assetsRef, adjustAssetRef);
  const artworkUrl = getAssetDisplayUrl(assets.artwork);
  const logoUrl = getAssetDisplayUrl(assets.logo);
  const materialPreview = materialCatalog[customization.material];
  const foilColor = foilCatalog[customization.foil];
  const orderCustomization = useMemo(() => ({
    ...customization,
    themeKey: activeThemeKey,
    accent: activeAccent,
    autoStyle,
    publicCardUrl: finalCardUrl,
    cardLayout,
    customDomain: wantCustomDomain ? normalizedCustomDomain : null,
    domainCoveredByUs: wantCustomDomain && domainMatchesSelection ? (domainResult?.coveredByUs ?? null) : null,
    domainUserShareFcfa: domainSurcharge,
    domainPrice: wantCustomDomain && domainMatchesSelection ? (domainResult?.price ?? null) : null,
    domainTld: wantCustomDomain && domainMatchesSelection ? (domainResult?.tld ?? null) : null,
    totalPrice: finalPrice,
  }), [
    activeAccent,
    activeThemeKey,
    autoStyle,
    cardLayout,
    customization,
    domainMatchesSelection,
    domainResult?.coveredByUs,
    domainSurcharge,
    finalPrice,
    finalCardUrl,
    normalizedCustomDomain,
    wantCustomDomain,
  ]);
  const isDomainSubmitBlocked = wantCustomDomain && (
    !normalizedCustomDomain
    || !domainMatchesSelection
    || !domainResult
    || Boolean(domainResult.error)
    || domainResult.available !== true
  );
  const domainValidationMessage = useMemo(() => {
    if (!wantCustomDomain) return '';
    if (!normalizedCustomDomain) return '';
    if (!domainMatchesSelection || !domainResult) return 'Verifiez la disponibilite du domaine avant paiement.';
    if (domainResult.error) return domainResult.error;
    if (domainResult.available === false) return 'Choisissez un domaine disponible avant paiement.';
    return '';
  }, [domainMatchesSelection, domainResult, normalizedCustomDomain, wantCustomDomain]);

  const orderBrief = useMemo(
    () => buildOrderBrief({ profile, orderContact, customization: orderCustomization, activeTheme, packageSelection, finalCardUrl, assets, totalPrice: finalPrice }),
    [activeTheme, assets, finalCardUrl, finalPrice, orderContact, orderCustomization, packageSelection, profile],
  );
  const whatsAppUrl = useMemo(() => buildWhatsAppUrl(orderBrief), [orderBrief]);

  const bambaBrief = useMemo(() => {
    const lines = [
      `*Commande Cle en main - Tapal*`,
      ``,
      `Nom : ${profile.fullName}`,
      `WhatsApp : ${profile.phone}`,
      `Pack : ${packageSelection.name} - ${formatMoney(finalPrice)}`,
      ...(discountAmount > 0 ? [`Coupon : ${appliedCoupon?.code ?? ''} (-${formatMoney(discountAmount)})`] : []),
      ...(wantCustomDomain && normalizedCustomDomain
        ? [`Domaine : ${normalizedCustomDomain}${domainSurcharge > 0 ? ` (+${formatMoney(domainSurcharge)})` : ' (inclus)'}`]
        : []),
      `Qte : ${packageSelection.quantity} carte(s)`,
    ];
    if (orderContact.deliveryCity) lines.push(`Ville : ${orderContact.deliveryCity}`);
    lines.push(``, `Merci de me rappeler pour finaliser le design !`);
    return lines.join('\n');
  }, [appliedCoupon, discountAmount, domainSurcharge, finalPrice, normalizedCustomDomain, orderContact.deliveryCity, packageSelection, profile.fullName, profile.phone, wantCustomDomain]);
  const bambaWhatsAppUrl = useMemo(() => buildWhatsAppUrl(bambaBrief), [bambaBrief]);

  assetRef.current = assets;

  const [previewQrUrl, setPreviewQrUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(finalCardUrl, { margin: 1, width: 280, color: { dark: '#102331', light: '#0000' } })
      .then((url) => { if (active) setQrCodeDataUrl(url); })
      .catch(() => { if (active) setQrCodeDataUrl(''); });
    QRCode.toDataURL(finalCardUrl, { margin: 1, width: 200, color: { dark: '#1a1a1a', light: '#ffffff' } })
      .then((url) => { if (active) setPreviewQrUrl(url); })
      .catch(() => { if (active) setPreviewQrUrl(''); });
    return () => { active = false; };
  }, [finalCardUrl]);

  useEffect(() => {
    fetchInventory()
      .then((d) => setInventory(d.inventory ?? {}))
      .catch(() => setInventory({}));
  }, []);

  useEffect(() => {
    return () => {
      Object.values(assetRef.current).forEach((a) => {
        if (a?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(a.previewUrl);
      });
      if (customRefPreview?.startsWith('blob:')) URL.revokeObjectURL(customRefPreview);
    };
  }, []);

  // Auto-sync profile → delivery fields when not manually overridden
  useEffect(() => {
    setOrderContact((prev) => {
      const next = { ...prev };
      if (!deliveryDirty.current.name && profile.fullName) next.name = profile.fullName;
      if (!deliveryDirty.current.email && profile.email) next.email = profile.email;
      if (!deliveryDirty.current.phone && profile.phone) next.phone = profile.phone;
      if (!deliveryDirty.current.deliveryCity && profile.location) {
        // Extract first meaningful segment as city
        const city = profile.location.split(',')[0].trim();
        if (city) next.deliveryCity = city;
      }
      return next;
    });
  }, [profile.fullName, profile.email, profile.phone, profile.location]);

  const updateProfile = (key, value) => setProfile((c) => ({ ...c, [key]: value }));
  const updateOrderContact = (key, value) => {
    deliveryDirty.current[key] = true;
    setOrderContact((c) => ({ ...c, [key]: value }));
  };
  const updateCustomization = (key, value) => setCustomization((c) => ({ ...c, [key]: value }));

  function updateAsset(assetKey, next) {
    setAssets((c) => ({ ...c, [assetKey]: next }));
  }

  function handleAssetFile(assetKey, file) {
    const cur = assets[assetKey];
    if (cur.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(cur.previewUrl);
    if (!file) {
      updateAsset(assetKey, { ...cur, sourceType: cur.remoteUrl ? 'url' : 'none', file: null, previewUrl: cur.remoteUrl });
      return;
    }
    updateAsset(assetKey, { ...cur, sourceType: 'file', file, previewUrl: URL.createObjectURL(file), remoteUrl: '' });
  }

  function handleAssetRemote(assetKey, remoteUrl) {
    const cur = assets[assetKey];
    if (cur.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(cur.previewUrl);
    updateAsset(assetKey, { ...cur, remoteUrl, sourceType: remoteUrl ? 'url' : 'none', previewUrl: remoteUrl, file: null });
  }

  const adjustAsset = (assetKey, field, value) =>
    updateAsset(assetKey, { ...assets[assetKey], [field]: value });
  adjustAssetRef.current = adjustAsset;

  function applyPromptToCard() {
    setCustomization((c) => ({ ...c, material: promptSuggestion.material, finish: promptSuggestion.finish, foil: promptSuggestion.foil }));
  }

  async function copyBrief() {
    await navigator.clipboard.writeText(orderBrief);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1800);
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponStatus({ state: 'loading', message: '' });
    try {
      const result = await validateCoupon(code);
      setAppliedCoupon(result.coupon);
      setCouponStatus({ state: 'ok', message: `Coupon "${result.coupon.code}" appliqué.` });
    } catch (error) {
      setAppliedCoupon(null);
      setCouponStatus({ state: 'error', message: error.message ?? 'Code invalide.' });
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponStatus({ state: 'idle', message: '' });
  }

  async function handleValidate(event) {
    event.preventDefault();
    const missing = [];
    if (!profile.fullName.trim()) missing.push('Nom complet (étape Profil)');
    if (!profile.phone.trim()) missing.push('Téléphone (étape Profil)');
    if (!orderContact.name.trim()) missing.push('Nom du contact (étape Livraison)');
    if (!orderContact.phone.trim()) missing.push('WhatsApp (étape Livraison)');
    if (!orderContact.deliveryCity.trim()) missing.push('Ville de livraison (étape Livraison)');
    if (missing.length > 0) {
      setSubmitState({
        status: 'error',
        message: `Champs obligatoires manquants : ${missing.join(', ')}`,
        order: null,
        paymentUrl: '',
      });
      setShowValidation(false);
      return;
    }
    if (isDomainSubmitBlocked) {
      setSubmitState({
        status: 'error',
        message: domainValidationMessage || 'Verifiez un domaine disponible avant paiement.',
        order: null,
        paymentUrl: '',
      });
      setShowValidation(false);
      return;
    }

    // Save order as draft so the preview link works immediately (10-min window)
    setSubmitState({ status: 'saving', message: 'Préparation de l\'aperçu...', order: null, paymentUrl: '' });
    try {
      const payload = {
        profile: { ...profile, slug },
        orderContact,
        customization: orderCustomization,
        packageSelection,
        totalPrice,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        finalPrice,
        discountAmount,
        assets: { avatar: serializeAsset(assets.avatar), artwork: serializeAsset(assets.artwork), cover: serializeAsset(assets.cover), logo: serializeAsset(assets.logo) },
      };
      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      if (assets.avatar.file) formData.append('avatarFile', assets.avatar.file);
      if (assets.artwork.file) formData.append('artworkFile', assets.artwork.file);
      if (assets.cover.file) formData.append('coverFile', assets.cover.file);
      if (assets.logo.file) formData.append('logoFile', assets.logo.file);
      if (customRefFile) formData.append('customRefFile', customRefFile);
      const orderResponse = await submitOrder(formData);
      setSavedOrderId(orderResponse.order.orderId);
      const actualCardUrl = orderResponse.order.finalCardUrl || finalCardUrl;
      setSavedFinalCardUrl(actualCardUrl);
      // Generate QR from actual server URL
      QRCode.toDataURL(actualCardUrl, { margin: 1, width: 200, color: { dark: '#1a1a1a', light: '#ffffff' } })
        .then((url) => setSavedPreviewQrUrl(url))
        .catch(() => setSavedPreviewQrUrl(''));
      setSubmitState({ status: 'idle', message: '', order: null, paymentUrl: '' });
      setShowValidation(true);
    } catch (error) {
      setSubmitState({ status: 'error', message: error.message, order: null, paymentUrl: '' });
    }
  }

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    setShowValidation(false);
    setSubmitState({ status: 'saving', message: 'Enregistrement...', order: null, paymentUrl: '' });
    try {
      let orderId = savedOrderId;

      if (!orderId) {
        // Fallback: save order if somehow not already saved
        const payload = {
          profile: { ...profile, slug },
          orderContact,
          customization: orderCustomization,
          packageSelection,
          totalPrice,
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          finalPrice,
          discountAmount,
          assets: { avatar: serializeAsset(assets.avatar), artwork: serializeAsset(assets.artwork), cover: serializeAsset(assets.cover), logo: serializeAsset(assets.logo) },
        };
        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));
        if (assets.avatar.file) formData.append('avatarFile', assets.avatar.file);
        if (assets.artwork.file) formData.append('artworkFile', assets.artwork.file);
        if (assets.cover.file) formData.append('coverFile', assets.cover.file);
        if (assets.logo.file) formData.append('logoFile', assets.logo.file);
        if (customRefFile) formData.append('customRefFile', customRefFile);
        const orderResponse = await submitOrder(formData);
        orderId = orderResponse.order.orderId;
      }

      const checkoutResponse = await startCheckout(orderId, finalPrice);

      if (checkoutResponse.paymentConfigured && checkoutResponse.paymentUrl) {
        setSubmitState({
          status: 'checkout-ready',
          message: 'Redirection vers Wave...',
          order: checkoutResponse.order,
          paymentUrl: checkoutResponse.paymentUrl,
        });
        window.location.href = checkoutResponse.paymentUrl;
        return;
      }

      setSubmitState({
        status: checkoutResponse.paymentConfigured ? 'checkout-ready' : 'saved',
        message: checkoutResponse.paymentConfigured
          ? 'Commande enregistr\u00e9e. Ouvrez la page de paiement.'
          : 'Commande enregistr\u00e9e \u2014 paiement non disponible.',
        order: checkoutResponse.order,
        paymentUrl: checkoutResponse.paymentUrl ?? '',
      });
    } catch (error) {
      setSubmitState({ status: 'error', message: error.message, order: null, paymentUrl: '' });
    }
  }

  const cardVars = {
    '--card-base': materialPreview.base,
    '--card-edge': materialPreview.edge,
    '--card-ink': materialPreview.ink,
    '--card-accent': activeAccent,
    '--card-foil': foilColor,
  };
  const phoneVars = {
    '--accent': activeAccent,
    '--preview-surface': customization.bgColor || activeTheme.surface,
    '--preview-highlight': activeTheme.highlight,
    '--preview-text': customization.textColor || activeTheme.text,
    '--preview-panel': activeTheme.panel,
    '--preview-font': fontStyleMap[customization.fontStyle] || fontStyleMap.moderne,
  };

  return (
    <div className="app-root">

      {/* ── TOPBAR ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-pill">Tapal</span>
          <span className="brand-label">Studio</span>
        </div>
        <div className="mode-tabs">
          <button type="button" className={`mode-tab${!bambaMode ? ' active' : ''}`} onClick={() => setBambaMode(false)}>
            Studio
          </button>
          <button type="button" className={`mode-tab mode-tab-cle${bambaMode ? ' active' : ''}`} onClick={() => setBambaMode(true)}>
            Clé en main
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ────────────────────────────────────────────── */}
      <div className={`studio-layout${mobileView === 'preview' ? ' show-preview' : ''}`}>

        {/* LEFT — FORM PANE */}
        <aside className="form-pane">
          <form className="form-scroll" onSubmit={handleSubmit}>

            {/* ═══ CLÉ EN MAIN MODE ════════════════════════════════ */}
            {bambaMode ? (
              <>
                <div className="cle-banner">
                  <div className="cle-banner-icon">⚡</div>
                  <div>
                    <h2>Service Clé en main</h2>
                    <p>Donnez votre nom et WhatsApp. Notre studio crée tout et vous contacte pour validation.</p>
                    <div className="delay-badge">⏱ Délai supplémentaire&nbsp;: 2–5 jours ouvrés</div>
                  </div>
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <span className="step-dot">1</span>
                    <h3>Vos informations</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field span-full">
                      <span>Nom complet</span>
                      <input type="text" value={profile.fullName} placeholder="Awa Ndiaye"
                        onChange={(e) => updateProfile('fullName', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>WhatsApp</span>
                      <input type="tel" value={profile.phone} placeholder="+221 77 000 00 00"
                        onChange={(e) => updateProfile('phone', e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Ville</span>
                      <input type="text" value={orderContact.deliveryCity} placeholder="Dakar"
                        onChange={(e) => updateOrderContact('deliveryCity', e.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <span className="step-dot">2</span>
                    <h3>Choisissez votre pack</h3>
                  </div>
                  <div className="pack-list">
                    {Object.values(packCatalog).map((pack) => (
                      <button key={pack.key} type="button"
                        className={`pack-row${selectedPackKey === pack.key ? ' active' : ''}${pack.discountBadge ? ' pack-row-deal' : ''}`}
                        onClick={() => {
                          setSelectedPackKey(pack.key);
                          if (pack.key === 'starter') {
                            setWantCustomDomain(false);
                            setCustomDomain('');
                            setDomainResult(null);
                          }
                        }}>
                        <div className="pack-row-info">
                          <strong>{pack.name}{pack.discountBadge && <span className="pack-discount-badge">{pack.discountBadge}</span>}</strong>
                          <small>{pack.caption}</small>
                        </div>
                        <div className="pack-row-price-wrap">
                          <span className="pack-row-price">{formatMoney(pack.price)}</span>
                        </div>
                        <span className="pack-row-check">{selectedPackKey === pack.key ? '✓' : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <span className="step-dot">3</span>
                    <h3>Votre résumé de commande</h3>
                  </div>
                  <pre className="brief-preview">{bambaBrief}</pre>
                  <a className="whatsapp-btn" href={bambaWhatsAppUrl} target="_blank" rel="noreferrer">
                    <WhatsAppIcon />
                    Envoyer via WhatsApp
                  </a>
                </div>
              </>

            ) : (
              /* ═══ STUDIO MODE ════════════════════════════════════ */
              <>
                {/* Mobile step nav */}
                <nav className="step-nav">
                  {[
                    { key: 'profile', num: '1', label: 'Profil' },
                    { key: 'images', num: '2', label: 'Images' },
                    { key: 'style', num: '3', label: 'Style' },
                    { key: 'physical', num: '4', label: 'Carte' },
                    { key: 'delivery', num: '5', label: 'Livraison' },
                    { key: 'summary', num: '6', label: 'Résumé' },
                    { key: 'payment', num: '7', label: 'Payer' },
                  ].map((s) => (
                    <button key={s.key} type="button"
                      className={`step-nav-item${activeSection === s.key ? ' active' : ''}`}
                      onClick={() => { sectionRefs.current[s.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                      <span className="step-nav-num">{s.num}</span>
                      <span className="step-nav-label">{s.label}</span>
                    </button>
                  ))}
                </nav>

                {/* 1. Profil digital */}
                <div className="form-card" ref={setSectionRef('profile')}>
                  <div className="form-card-header">
                    <span className="step-dot">1</span>
                    <h3>Profil digital</h3>
                  </div>
                  <div className="form-grid">
                    {profileFields.filter((f) => f.key !== 'location').map((field) => (
                      <label className="field" key={field.key}>
                        <span>{field.label}</span>
                        <input type={field.type} value={profile[field.key]}
                          onChange={(e) => updateProfile(field.key, e.target.value)} />
                      </label>
                    ))}
                    <label className="field span-full">
                      <span>Bio</span>
                      <textarea rows="2" value={profile.bio} onChange={(e) => updateProfile('bio', e.target.value)} />
                    </label>
                  </div>
                  <div style={{ marginTop: '.75rem' }}>
                    <p className="field-label-sm">Localisation / Lieu de travail</p>
                    <LocationPicker
                      value={profile.location}
                      onChange={(v) => updateProfile('location', v)}
                    />
                  </div>
                </div>

                {/* 2. Images */}
                <div className="form-card" ref={setSectionRef('images')}>
                  <div className="form-card-header">
                    <span className="step-dot">2</span>
                    <h3>Images</h3>
                  </div>
                  <AssetField title="Photo de profil (carte digitale)"
                    asset={assets.avatar}
                    onFileChange={(e) => handleAssetFile('avatar', e.target.files?.[0] ?? null)}
                    onRemoteChange={(v) => handleAssetRemote('avatar', v)}
                    onAdjust={(f, v) => adjustAsset('avatar', f, v)} />
                  <AssetField title="Visuel recto (carte NFC physique)"
                    asset={assets.artwork}
                    onFileChange={(e) => handleAssetFile('artwork', e.target.files?.[0] ?? null)}
                    onRemoteChange={(v) => handleAssetRemote('artwork', v)}
                    onAdjust={(f, v) => adjustAsset('artwork', f, v)}
                    rotationEnabled />
                  <AssetField title="Logo de l'entreprise (optionnel)"
                    asset={assets.logo}
                    onFileChange={(e) => handleAssetFile('logo', e.target.files?.[0] ?? null)}
                    onRemoteChange={(v) => handleAssetRemote('logo', v)}
                    onAdjust={(f, v) => adjustAsset('logo', f, v)} />
                </div>

                {/* 3. Style digital */}
                <div className="form-card" ref={setSectionRef('style')}>
                  <div className="form-card-header">
                    <span className="step-dot">3</span>
                    <h3>Style digital</h3>
                  </div>
                  <div className="form-grid controls-grid">
                    <div className="field span-full">
                      <span className="field-label-sm">Couleur d'accent</span>
                      <label className={`accent-picker-label${autoStyle ? ' accent-picker-locked' : ''}`}>
                        <span className="accent-swatch-lg" style={{ background: activeAccent }} />
                        <span className="accent-hex">{activeAccent.toUpperCase()}</span>
                        <span className="accent-pick-hint">Choisir →</span>
                        <input type="color"
                          value={autoStyle ? promptSuggestion.accent : customization.accent}
                          disabled={autoStyle}
                          onChange={(e) => updateCustomization('accent', e.target.value)} />
                      </label>
                    </div>

                    {/* Text color */}
                    <div className="field">
                      <span className="field-label-sm">Couleur du texte</span>
                      <label className="accent-picker-label">
                        <span className="accent-swatch-lg" style={{ background: customization.textColor || '#e8ddd0', border: customization.textColor ? 'none' : '2px dashed #555' }} />
                        <span className="accent-hex">{customization.textColor ? customization.textColor.toUpperCase() : 'Auto'}</span>
                        {customization.textColor && (
                          <button type="button" className="color-reset-btn" onClick={() => updateCustomization('textColor', '')}>✕</button>
                        )}
                        <input type="color"
                          value={customization.textColor || '#e8ddd0'}
                          onChange={(e) => updateCustomization('textColor', e.target.value)} />
                      </label>
                    </div>

                    {/* Background color */}
                    <div className="field">
                      <span className="field-label-sm">Couleur de fond</span>
                      <label className="accent-picker-label">
                        <span className="accent-swatch-lg" style={{ background: customization.bgColor || '#0c1b2b', border: customization.bgColor ? 'none' : '2px dashed #555' }} />
                        <span className="accent-hex">{customization.bgColor ? customization.bgColor.toUpperCase() : 'Auto'}</span>
                        {customization.bgColor && (
                          <button type="button" className="color-reset-btn" onClick={() => updateCustomization('bgColor', '')}>✕</button>
                        )}
                        <input type="color"
                          value={customization.bgColor || '#0c1b2b'}
                          onChange={(e) => updateCustomization('bgColor', e.target.value)} />
                      </label>
                    </div>

                    {/* Font style */}
                    <div className="field span-full">
                      <span className="field-label-sm">Style de texte</span>
                      <div className="font-style-picker">
                        {[
                          { key: 'moderne',   label: 'Moderne',   sample: 'Aa' },
                          { key: 'elegant',   label: 'Élégant',   sample: 'Aa' },
                          { key: 'technique', label: 'Technique', sample: 'Aa' },
                          { key: 'arrondi',   label: 'Arrondi',   sample: 'Aa' },
                          { key: 'roboto',    label: 'Google',    sample: 'Aa' },
                          { key: 'sf',        label: 'Apple',     sample: 'Aa' },
                          { key: 'segoe',     label: 'Microsoft', sample: 'Aa' },
                        ].map((f) => (
                          <button key={f.key} type="button"
                            className={`font-chip${customization.fontStyle === f.key ? ' active' : ''}`}
                            data-font={f.key}
                            onClick={() => updateCustomization('fontStyle', f.key)}>
                            <span className="font-sample">{f.sample}</span>
                            <span>{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="field span-full">
                      <span>Label carte</span>
                      <input type="text" value={customization.cardLabel}
                        onChange={(e) => updateCustomization('cardLabel', e.target.value)} />
                    </label>
                  </div>
                  <div>
                    <p className="field-label-sm">Mise en page de la carte digitale</p>
                    <div className="layout-picker">
                      {[
                        { key: 'classic', label: 'Classique', thumb: 'cl' },
                        { key: 'banner', label: 'Bannière', thumb: 'bn' },
                        { key: 'split', label: 'Bicolonne', thumb: 'sp' },
                        { key: 'minimal', label: 'Minimal', thumb: 'mn' },
                        { key: 'custom', label: 'Sur mesure', thumb: 'cu' },
                      ].map((l) => (
                        <button key={l.key} type="button"
                          className={`layout-chip${cardLayout === l.key ? ' active' : ''}${l.key === 'custom' ? ' layout-chip-custom' : ''}`}
                          onClick={() => setCardLayout(l.key)}>
                          <span className={`layout-thumb lt-${l.thumb}`} />
                          <span>{l.label}</span>
                        </button>
                      ))}
                    </div>

                    {cardLayout === 'custom' && (
                      <div className="custom-layout-panel">
                        <div className="custom-layout-banner">
                          <span>✨ Notre studio créera un layout unique selon vos instructions.</span>
                        </div>
                        <label className="field">
                          <span>Décrivez le layout souhaité</span>
                          <textarea rows="4"
                            value={customization.customLayoutDescription ?? ''}
                            placeholder="Ex : Photo en plein fond avec nom en bas, couleurs turquoise et blanc, style minimaliste luxe..."
                            onChange={(e) => updateCustomization('customLayoutDescription', e.target.value)} />
                        </label>
                        <label className="field">
                          <span>URL de référence (optionnel)</span>
                          <input type="url"
                            value={customization.customLayoutRefUrl ?? ''}
                            placeholder="https://exemple.com/design-ref"
                            onChange={(e) => updateCustomization('customLayoutRefUrl', e.target.value)} />
                        </label>
                        <label className="field upload-field">
                          <span>Image de référence (optionnel)</span>
                          <input type="file" accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              if (customRefPreview?.startsWith('blob:')) URL.revokeObjectURL(customRefPreview);
                              setCustomRefFile(file);
                              setCustomRefPreview(file ? URL.createObjectURL(file) : '');
                            }} />
                        </label>
                        {customRefPreview && (
                          <div className="custom-ref-preview">
                            <span>Aperçu référence</span>
                            <img src={customRefPreview} alt="Référence design" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── COVER IMAGE ───────────────────────────────── */}
                  <div className="cover-field-section">
                    <p className="field-label-sm">Image de couverture</p>
                    <p className="cover-field-hint">Visible en haut de la carte digitale (surtout en mode Bannière).</p>
                    <div className="asset-source-grid">
                      <label className="field span-full upload-field">
                        <span>Depuis l'appareil</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleAssetFile('cover', e.target.files?.[0] ?? null)} />
                      </label>
                      <label className="field span-full">
                        <span>Ou lien image (URL)</span>
                        <input type="url" value={assets.cover.remoteUrl} placeholder="https://example.com/cover.jpg"
                          onChange={(e) => handleAssetRemote('cover', e.target.value)} />
                      </label>
                    </div>
                    {assets.cover.previewUrl && (
                      <div className="cover-preview-wrap">
                        <img className="cover-preview-img" src={assets.cover.previewUrl} alt="cover" />
                        <button type="button" className="cover-remove-btn"
                          onClick={() => handleAssetFile('cover', null)}>✕ Supprimer</button>
                      </div>
                    )}
                  </div>

                  <div className="animation-section">
                    <div className="animation-toggle-row">
                      <div>
                        <p className="animation-title">✨ Animations</p>
                        <p className="animation-subtitle">Transitions et effets sur la carte digitale</p>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox"
                          checked={customization.animationEnabled ?? false}
                          onChange={(e) => updateCustomization('animationEnabled', e.target.checked)} />
                        <span className="toggle-track" />
                      </label>
                    </div>
                    {customization.animationEnabled && (
                      <label className="field">
                        <span>Décrivez l'animation souhaitée</span>
                        <textarea rows="3"
                          value={customization.animationDescription ?? ''}
                          placeholder="Ex : Apparition progressive de chaque section, fond avec particules flottantes, nom avec effet shimmer doré..."
                          onChange={(e) => updateCustomization('animationDescription', e.target.value)} />
                      </label>
                    )}
                  </div>
                </div>

                {/* 4. Carte NFC physique */}
                <div className="form-card" ref={setSectionRef('physical')}>
                  <div className="form-card-header">
                    <span className="step-dot">4</span>
                    <h3>Carte NFC physique</h3>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Matériau</span>
                      <select value={customization.material} onChange={(e) => updateCustomization('material', e.target.value)}>
                        {Object.keys(materialCatalog).map((m) => {
                          const outOfStock = inventory[`material:${m}`]?.inStock === false;
                          return (
                            <option key={m} value={m} disabled={outOfStock}>
                              {m}{outOfStock ? ' — épuisé' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="field">
                      <span>Finition</span>
                      <select value={customization.finish} onChange={(e) => updateCustomization('finish', e.target.value)}>
                        <option>Matte</option><option>Soft matte</option><option>Satin</option><option>Gloss</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Dorure</span>
                      <select value={customization.foil} onChange={(e) => updateCustomization('foil', e.target.value)}>
                        {Object.keys(foilCatalog).map((f) => {
                          const outOfStock = inventory[`foil:${f}`]?.inStock === false;
                          return (
                            <option key={f} value={f} disabled={outOfStock}>
                              {f}{outOfStock ? ' — épuisé' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="field">
                      <span>Message au verso</span>
                      <input type="text" value={customization.backsideMessage}
                        onChange={(e) => updateCustomization('backsideMessage', e.target.value)} />
                    </label>
                  </div>
                  <div className="toggle-row">
                    <label className="toggle-pill">
                      <input type="checkbox" checked={customization.includeQr} onChange={(e) => updateCustomization('includeQr', e.target.checked)} />
                      <span>QR code au verso</span>
                    </label>
                    <label className="toggle-pill">
                      <input type="checkbox" checked={customization.includeLogo} onChange={(e) => updateCustomization('includeLogo', e.target.checked)} />
                      <span>Logo au recto</span>
                    </label>
                  </div>
                </div>

                {/* 5. Livraison */}
                <div className="form-card" ref={setSectionRef('delivery')}>
                  <div className="form-card-header">
                    <span className="step-dot">5</span>
                    <h3>Informations de livraison</h3>
                  </div>
                  <div className="form-grid">
                    {orderContactFields.map((field) => (
                      <label className="field" key={field.key}>
                        <span>{field.label}</span>
                        <input type={field.type} value={orderContact[field.key]}
                          onChange={(e) => updateOrderContact(field.key, e.target.value)} />
                      </label>
                    ))}
                    <label className="field span-full">
                      <span>Instructions de livraison</span>
                      <textarea rows="2" value={orderContact.deliveryNotes}
                        onChange={(e) => updateOrderContact('deliveryNotes', e.target.value)} />
                    </label>
                  </div>
                  {(() => {
                    const loc = `${orderContact.deliveryCity || ''} ${orderContact.deliveryAddress || ''} ${profile.location || ''}`.toLowerCase();
                    if (!loc.trim()) return null;
                    const snTerms = ['sénégal','senegal','dakar','thiès','thies','saint-louis','ziguinchor','mbour','kaolack','diourbel','louga','tambacounda','kolda','sédhiou','sedhiou','matam','kaffrine','kédougou','kedougou','fatick','touba','rufisque','pikine','guédiawaye',' sn,', ',sn'];
                    const isSn = snTerms.some((t) => loc.includes(t));
                    return (
                      <div className={`delivery-estimate${isSn ? ' delivery-estimate-local' : ' delivery-estimate-intl'}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {isSn
                          ? 'Livraison estimée au Sénégal : 2 à 5 jours ouvrés'
                          : 'Livraison hors Sénégal : 1 semaine à 1 mois selon la destination'}
                      </div>
                    );
                  })()}
                </div>

                {/* 6. Récapitulatif */}
                <div className="form-card" ref={setSectionRef('summary')}>
                  <div className="form-card-header">
                    <span className="step-dot">6</span>
                    <h3>Récapitulatif</h3>
                  </div>
                  <div className="receipt-ticket">
                    <div className="receipt-header">
                      <span className="receipt-brand">TEKKO</span>
                      <span className="receipt-subtitle">Bon de commande</span>
                    </div>
                    <div className="receipt-divider" />
                    <div className="receipt-row"><span>Client</span><strong>{orderContact.name || profile.fullName || '—'}</strong></div>
                    <div className="receipt-row"><span>Email</span><strong>{orderContact.email || '—'}</strong></div>
                    <div className="receipt-row"><span>WhatsApp</span><strong>{orderContact.phone || '—'}</strong></div>
                    <div className="receipt-row"><span>Ville</span><strong>{orderContact.deliveryCity || '—'}</strong></div>
                    <div className="receipt-divider" />
                    <div className="receipt-row"><span>Matériau</span><strong>{customization.material}</strong></div>
                    <div className="receipt-row"><span>Finition</span><strong>{customization.finish}</strong></div>
                    <div className="receipt-row"><span>Dorure</span><strong>{customization.foil}</strong></div>
                    {customization.includeQr && <div className="receipt-row"><span>QR code</span><strong>Oui</strong></div>}
                    {customization.includeLogo && <div className="receipt-row"><span>Logo</span><strong>Oui</strong></div>}
                    {wantCustomDomain && normalizedCustomDomain && (
                      <div className="receipt-row"><span>Domaine</span><strong>{normalizedCustomDomain}</strong></div>
                    )}
                    <div className="receipt-tear" />
                  </div>
                </div>

                {/* 7. Pack et paiement */}
                <div className="form-card" ref={setSectionRef('payment')}>
                  <div className="form-card-header">
                    <span className="step-dot">7</span>
                    <h3>Pack et paiement</h3>
                  </div>
                  <div className="pack-list">
                    {Object.values(packCatalog).map((pack) => (
                      <button key={pack.key} type="button"
                        className={`pack-row${selectedPackKey === pack.key ? ' active' : ''}${pack.discountBadge ? ' pack-row-deal' : ''}`}
                        onClick={() => {
                          setSelectedPackKey(pack.key);
                          if (pack.key === 'starter') {
                            setWantCustomDomain(false);
                            setCustomDomain('');
                            setDomainResult(null);
                          }
                        }}>
                        <div className="pack-row-info">
                          <strong>{pack.name}{pack.discountBadge && <span className="pack-discount-badge">{pack.discountBadge}</span>}</strong>
                          <small>{pack.caption}</small>
                        </div>
                        <div className="pack-row-price-wrap">
                          <span className="pack-row-price">{formatMoney(pack.price)}</span>
                        </div>
                        <span className="pack-row-check">{selectedPackKey === pack.key ? '✓' : ''}</span>
                      </button>
                    ))}
                  </div>
                  {selectedPackKey !== 'starter' && <div className="domain-option-section">
                    <label className="toggle-pill">
                      <input
                        type="checkbox"
                        checked={wantCustomDomain}
                        onChange={(e) => {
                          setWantCustomDomain(e.target.checked);
                          if (!e.target.checked) {
                            setCustomDomain('');
                            setDomainResult(null);
                          }
                        }}
                      />
                      <span>Je veux un nom de domaine personnalise</span>
                    </label>
                    {wantCustomDomain && (
                      <div className="domain-checker-wrap">
                        <p className="domain-note">Entrez le domaine souhaite. TEKKO couvre jusqu'a 6 000 FCFA/an. Au-dela, la difference est a votre charge.</p>
                        <DomainChecker
                          value={customDomain}
                          onChange={setCustomDomain}
                          onResult={setDomainResult}
                        />
                        {domainValidationMessage && (
                          <div className="domain-help domain-help-warn">{domainValidationMessage}</div>
                        )}
                      </div>
                    )}
                  </div>}
                  <div className="price-table" style={{ marginTop: '0.85rem' }}>
                    <div className="price-row"><span>Pack {packageSelection.name}</span><strong>{formatMoney(packageSelection.price)}</strong></div>
                    {customization.material === 'Brushed metal' && (
                      <div className="price-row"><span>+ Métal brossé</span><strong>{formatMoney(20000)}</strong></div>
                    )}
                    {customization.foil !== 'No foil' && (
                      <div className="price-row"><span>+ Dorure {customization.foil.replace(' foil', '')}</span><strong>{formatMoney(5000)}</strong></div>
                    )}
                    {discountAmount > 0 && (
                      <div className="price-row price-row-discount">
                        <span>🏷 Coupon {appliedCoupon.code}</span>
                        <strong>-{formatMoney(discountAmount)}</strong>
                      </div>
                    )}
                    {wantCustomDomain && domainMatchesSelection && domainResult?.available === true && (
                      <div className="price-row">
                        <span>Nom de domaine {normalizedCustomDomain}</span>
                        <strong>{domainSurcharge > 0 ? `+${formatMoney(domainSurcharge)}` : 'Inclus'}</strong>
                      </div>
                    )}
                    <div className="price-row total"><span>Total</span><strong>{formatMoney(finalPrice)}</strong></div>
                  </div>

                  {/* Coupon */}
                  <div className="coupon-row">
                    {!appliedCoupon ? (
                      <>
                        <input
                          className="coupon-input"
                          type="text"
                          placeholder="Code promo"
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponStatus({ state: 'idle', message: '' }); }}
                          onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                          disabled={couponStatus.state === 'loading'}
                        />
                        <button type="button" className="coupon-apply-btn" onClick={applyCoupon} disabled={couponStatus.state === 'loading' || !couponInput.trim()}>
                          {couponStatus.state === 'loading' ? '...' : 'Appliquer'}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="coupon-remove-btn" onClick={removeCoupon}>
                        ✕ Retirer le coupon {appliedCoupon.code}
                      </button>
                    )}
                    {couponStatus.message && (
                      <span className={`coupon-msg coupon-msg-${couponStatus.state}`}>{couponStatus.message}</span>
                    )}
                  </div>

                  {(submitState.status === 'idle' || submitState.status === 'error') && !showValidation ? (
                    <>
                      {submitState.status === 'error' && (
                        <div className="status-banner error">
                          <strong>{submitState.message}</strong>
                        </div>
                      )}
                      <div className="action-strip">
                        <a className="whatsapp-btn" href={whatsAppUrl} target="_blank" rel="noreferrer">
                          <WhatsAppIcon />
                          WhatsApp
                        </a>
                        <button type="button" className="wave-pay-btn" onClick={handleValidate} disabled={isDomainSubmitBlocked}>
                          Valider ma commande
                        </button>
                      </div>
                    </>
                  ) : null}

                  {/* ── VALIDATION RECEIPT / PREVIEW ─────── */}
                  {showValidation && (
                    <div className="validation-receipt">
                      <div className="validation-header">
                        <span className="validation-brand">TEKKO</span>
                        <span className="validation-subtitle">Récapitulatif de commande</span>
                      </div>
                      <div className="receipt-divider" />
                      <div className="receipt-row"><span>Pack</span><strong>{packageSelection.label}</strong></div>
                      <div className="receipt-row"><span>Carte</span><strong>{profile.fullName}</strong></div>
                      {customization.material !== 'Pearl white' && (
                        <div className="receipt-row"><span>Matériau</span><strong>{customization.material}</strong></div>
                      )}
                      {discountAmount > 0 && (
                        <div className="receipt-row"><span>Coupon {appliedCoupon.code}</span><strong>-{formatMoney(discountAmount)}</strong></div>
                      )}
                      {wantCustomDomain && domainResult?.available && (
                        <div className="receipt-row"><span>Domaine</span><strong>{normalizedCustomDomain}</strong></div>
                      )}
                      <div className="receipt-row receipt-total"><span>Total à payer</span><strong>{formatMoney(finalPrice)}</strong></div>
                      <div className="receipt-divider" />
                      <div className="validation-preview">
                        <p className="validation-hint">Scannez ou cliquez pour prévisualiser :</p>
                        <div className="validation-qr-wrap">
                          {(savedPreviewQrUrl || previewQrUrl) && <img src={savedPreviewQrUrl || previewQrUrl} alt="QR prévisualisation" className="validation-qr" />}
                        </div>
                        <a className="validation-card-link" href={savedFinalCardUrl || finalCardUrl} target="_blank" rel="noreferrer">{(savedFinalCardUrl || finalCardUrl).replace(/^https?:\/\//, '')}</a>
                        <p className="validation-note">Ce lien deviendra permanent après paiement. Il vous sera aussi envoyé par email.</p>
                      </div>
                      <div className="receipt-divider" />
                      <div className="validation-actions">
                        <button type="button" className="validation-back-btn" onClick={() => { setShowValidation(false); setSavedOrderId(null); setSavedFinalCardUrl(''); setSavedPreviewQrUrl(''); }}>
                          ← Modifier
                        </button>
                        <button type="button" className="wave-pay-btn" onClick={handleSubmit}>
                          <WaveIcon />
                          Payer avec Wave
                        </button>
                      </div>
                    </div>
                  )}

                  {submitState.status === 'saving' && (
                    <div className="receipt-loading">
                      <div className="receipt-spinner" />
                      <span>{submitState.message || 'Enregistrement...'}</span>
                    </div>
                  )}

                  {(submitState.status === 'checkout-ready' || submitState.status === 'saved') && submitState.order && (
                    <div className="receipt-ticket receipt-success">
                      <div className="receipt-header">
                        <span className="receipt-check-icon">✓</span>
                        <span className="receipt-brand">TEKKO</span>
                        <span className="receipt-subtitle">Commande enregistrée</span>
                      </div>
                      <div className="receipt-divider" />
                      <div className="receipt-row"><span>Commande</span><strong>{submitState.order.orderId?.slice(0, 8).toUpperCase()}</strong></div>
                      <div className="receipt-row"><span>Montant</span><strong>{formatMoney(finalPrice)}</strong></div>
                      <div className="receipt-row"><span>Statut</span><strong>{submitState.status === 'checkout-ready' ? 'En attente de paiement' : 'Enregistrée'}</strong></div>
                      <div className="receipt-divider" />
                      {submitState.paymentUrl && (
                        <a className="wave-pay-btn full-width" href={submitState.paymentUrl} target="_blank" rel="noreferrer">
                          <WaveIcon />
                          Ouvrir Wave pour payer
                        </a>
                      )}
                      <p className="receipt-email-note">
                        Après confirmation du paiement, vous recevrez par email le lien de votre carte digitale ainsi que le reçu PDF téléchargeable.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </form>
        </aside>

        {/* RIGHT — PREVIEW PANE */}
        <section className="preview-pane"
          style={{
            '--accent': activeAccent,
            '--preview-surface': activeTheme.surface,
            '--preview-highlight': activeTheme.highlight,
            '--preview-text': activeTheme.text,
            '--preview-panel': activeTheme.panel,
          }}>

          {/* Preview top bar */}
          <div className="preview-top-bar">
            <div className="preview-meta-chips">
              <span className="meta-chip">{packageSelection.name}</span>
              <span className="meta-chip price-chip">{formatMoney(totalPrice)}</span>
              <span className="meta-chip">{customization.material}</span>
            </div>
            <div className="preview-switcher">
              <button type="button" className={previewTab === 'digital' ? 'active' : ''} onClick={() => { userSwitchedPreview.current = true; setPreviewTab('digital'); setTimeout(() => { userSwitchedPreview.current = false; }, 3000); }}>
                Digitale
              </button>
              <button type="button" className={previewTab === 'physical' ? 'active' : ''} onClick={() => { userSwitchedPreview.current = true; setPreviewTab('physical'); setTimeout(() => { userSwitchedPreview.current = false; }, 3000); }}>
                Physique
              </button>
            </div>
          </div>

          {/* DIGITAL PREVIEW */}
          {previewTab === 'digital' && (
            <div className="phone-wrap">
              <div className="phone-shell">
                <div className="phone-notch" />
                <div className={`phone-screen dl-${cardLayout}`} style={phoneVars}>

                  {/* CLASSIC */}
                  {cardLayout === 'classic' && (<>
                    <div className="dl-hero">
                      <span className="phone-badge">{customization.cardLabel}</span>
                      {logoUrl && <img className="dl-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets.logo.opacity }} />}
                      <div className="dl-hero-photo photo-frame gesture-target" ref={avatarUrl ? avatarGestureRef : null}
                        title="Glisser pour repositionner · Molette/Pincer pour zoomer">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={profile.fullName} className="framed-image"
                            style={{ objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`, transform: `scale(${assets.avatar.zoom}) rotate(${assets.avatar.rotation}deg)`, opacity: assets.avatar.opacity }} />
                        ) : <span className="dl-hero-initials">{initials}</span>}
                      </div>
                      <h3>{profile.fullName}</h3>
                      <p className="role-line">{profile.role} · {profile.company}</p>
                      <p className="bio-copy">{profile.bio}</p>
                    </div>
                    <div className="action-row">
                      <button type="button">Save contact</button>
                      <a href={finalCardUrl} className="secondary-action as-button">Open card</a>
                    </div>
                    <div className="info-panels">
                      {profile.phone && <article><span>Tel</span><strong>{profile.phone}</strong></article>}
                      {profile.email && <article><span>Email</span><strong>{profile.email}</strong></article>}
                      {profile.website && <article><span>Web</span><strong>{profile.website}</strong></article>}
                      {profile.location && <article><span>Lieu</span><strong>{profile.location}</strong></article>}
                    </div>
                  </>)}

                  {/* BANNER */}
                  {cardLayout === 'banner' && (<>
                    <div className="dl-cover" ref={assets.cover.previewUrl ? coverGestureRef : null}
                      title={assets.cover.previewUrl ? 'Glisser pour repositionner · Molette/Pincer pour zoomer' : undefined}>
                      {assets.cover.previewUrl ? (
                        <img className="dl-cover-img" src={assets.cover.previewUrl} alt="cover" />
                      ) : (
                        <div className="dl-cover-bg" style={{ background: `linear-gradient(135deg, ${activeAccent} 0%, ${activeTheme.highlight || activeAccent}88 100%)` }} />
                      )}
                      <div className="dl-cover-overlay" />
                      <span className="phone-badge dl-cover-badge">{customization.cardLabel}</span>
                      <div className="dl-cover-avatar photo-frame gesture-target" ref={avatarUrl ? avatarGestureRef : null}
                        title="Glisser pour repositionner · Molette/Pincer pour zoomer">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={profile.fullName} className="framed-image"
                            style={{ objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`, transform: `scale(${assets.avatar.zoom})`, opacity: assets.avatar.opacity }} />
                        ) : <span>{initials}</span>}
                      </div>
                    </div>
                    <div className="dl-body">
                      {logoUrl && <img className="dl-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets.logo.opacity }} />}
                      <h3>{profile.fullName}</h3>
                      <p className="role-line">{profile.role} · {profile.company}</p>
                      <p className="bio-copy">{profile.bio}</p>
                      <div className="action-row">
                        <button type="button">Save contact</button>
                        <a href={finalCardUrl} className="secondary-action as-button">Open card</a>
                      </div>
                      <div className="info-panels">
                        {profile.phone && <article><span>Tel</span><strong>{profile.phone}</strong></article>}
                        {profile.email && <article><span>Email</span><strong>{profile.email}</strong></article>}
                        {profile.website && <article><span>Web</span><strong>{profile.website}</strong></article>}
                      </div>
                    </div>
                  </>)}

                  {/* SPLIT */}
                  {cardLayout === 'split' && (
                    <div className="dl-split-wrap">
                      <div className="dl-split-left gesture-target" style={{ background: `linear-gradient(180deg, ${activeAccent}cc 0%, ${activeTheme.surface || '#0c1b2b'} 100%)` }}
                        ref={avatarUrl ? avatarGestureRef : null}
                        title="Glisser pour repositionner · Molette/Pincer pour zoomer">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={profile.fullName} className="framed-image"
                            style={{ objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`, transform: `scale(${assets.avatar.zoom})`, opacity: assets.avatar.opacity }} />
                        ) : <span className="dl-split-initials">{initials}</span>}
                      </div>
                      <div className="dl-split-right">
                        <span className="phone-badge">{customization.cardLabel}</span>
                        {logoUrl && <img className="dl-company-logo" src={logoUrl} alt="logo" style={{ opacity: assets.logo.opacity }} />}
                        <h3>{profile.fullName}</h3>
                        <p className="role-line">{profile.role}</p>
                        <p className="role-line" style={{ opacity: 0.5 }}>{profile.company}</p>
                        <button type="button" className="dl-save-btn">Save</button>
                        <div className="dl-split-links">
                          {profile.phone && <span>{profile.phone}</span>}
                          {profile.email && <span>{profile.email}</span>}
                          {profile.website && <span>{profile.website}</span>}
                          {profile.location && <span>{profile.location}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MINIMAL */}
                  {cardLayout === 'minimal' && (<>
                    <div className="dl-minimal-top" style={{ background: `linear-gradient(160deg, ${activeTheme.surface || '#0c1b2b'} 0%, ${activeAccent}22 100%)` }}>
                      <div className="dl-minimal-mono gesture-target" style={{ background: activeAccent }}
                        ref={avatarUrl ? avatarGestureRef : null}
                        title="Glisser pour repositionner · Molette/Pincer pour zoomer">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={profile.fullName} className="framed-image"
                            style={{ objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`, transform: `scale(${assets.avatar.zoom})`, opacity: assets.avatar.opacity }} />
                        ) : <span>{initials}</span>}
                      </div>
                      <h2 className="dl-minimal-name">{profile.fullName}</h2>
                      <p className="dl-minimal-role">{profile.role}</p>
                      <p className="dl-minimal-company" style={{ color: activeAccent }}>{profile.company}</p>
                      {logoUrl && <img className="dl-company-logo dl-company-logo--minimal" src={logoUrl} alt="logo" style={{ opacity: assets.logo.opacity }} />}
                    </div>
                    <div className="dl-minimal-links">
                      {profile.phone && <div className="dl-link-row"><span className="dl-link-type">Tel</span><span>{profile.phone}</span></div>}
                      {profile.email && <div className="dl-link-row"><span className="dl-link-type">Email</span><span>{profile.email}</span></div>}
                      {profile.website && <div className="dl-link-row"><span className="dl-link-type">Web</span><span>{profile.website}</span></div>}
                      {profile.location && <div className="dl-link-row"><span className="dl-link-type">Lieu</span><span>{profile.location}</span></div>}
                    </div>
                    <div className="action-row" style={{ padding: '0.5rem 0.8rem 1rem' }}>
                      <button type="button">Save contact</button>
                      <a href={finalCardUrl} className="secondary-action as-button">Open card</a>
                    </div>
                  </>)}

                </div>
              </div>
            </div>
          )}

          {/* PHYSICAL CARD PREVIEW */}
          {previewTab === 'physical' && (
            <div className="card-wrap">
              <span className="card-face-label">▸ Recto</span>
              <div className="nfc-card front" style={cardVars}>
                <div className="card-artwork-layer gesture-target" ref={artworkUrl ? artworkGestureRef : null}
                  title="Glisser pour repositionner · Molette/Pincer pour zoomer">
                  {artworkUrl ? (
                    <img src={artworkUrl} alt="artwork" className="card-artwork-image"
                      style={{
                        objectPosition: `${assets.artwork.positionX}% ${assets.artwork.positionY}%`,
                        transform: `scale(${assets.artwork.zoom}) rotate(${assets.artwork.rotation}deg)`,
                        opacity: assets.artwork.opacity,
                      }} />
                  ) : null}
                </div>
                <div className="card-sheen" data-finish={customization.finish} />
                <div className="card-front-content" style={{ background: artworkUrl ? (materialPreview.base === '#f5f5f3' ? 'linear-gradient(180deg, rgba(255,255,255,.0) 0%, rgba(0,0,0,.38) 100%)' : 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,.65) 100%)') : 'none' }}>
                  {!artworkUrl && (
                    <div className="card-no-art-hint">Ajoutez un visuel</div>
                  )}
                  <div>
                    <span className="brand-mark">TEKKO</span>
                    {customization.includeLogo && <span className="mini-logo">GeoChifa</span>}
                  </div>
                  <div>
                    {profile.fullName && <h3 style={{ color: materialPreview.ink }}>{profile.fullName}</h3>}
                    {profile.role && <p style={{ color: materialPreview.ink, opacity: .7 }}>{profile.role}</p>}
                    {profile.company && profile.company !== 'TEKKO' && <span style={{ color: materialPreview.ink, opacity: .5 }}>{profile.company}</span>}
                  </div>
                  <div className="nfc-chip-row">
                    {customization.foil !== 'No foil' && <div className="nfc-chip" />}
                    {customization.foil !== 'No foil' && <span>NFC</span>}
                  </div>
                </div>
              </div>

              <span className="card-face-label">▸ Verso</span>
              <div className="nfc-card back" style={cardVars}>
                <div className="card-sheen" data-finish={customization.finish} />
                <div className="card-back-content">
                  <div>
                    <span className="qr-label">{customization.includeQr ? 'QR fallback' : 'Tap only'}</span>
                    <p>{customization.backsideMessage}</p>
                  </div>
                  {customization.includeQr && qrCodeDataUrl ? (
                    <img className="qr-image" src={qrCodeDataUrl} alt="QR" />
                  ) : (
                    <div className="tap-only-mark">NFC</div>
                  )}
                  <strong className="card-url">{finalCardUrl}</strong>
                </div>
              </div>

              <div className="spec-strip">
                <span>{customization.material}</span>
                <span>{customization.finish}</span>
                <span>{customization.foil}</span>
                <span className="card-scale-note">Echelle 1:1 (85.6 × 54 mm)</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── MOBILE STICKY BAR ──────────────────────────────────────── */}
      <div className="mobile-bar">
        <div className="mobile-price">
          <span className="mobile-pack">{packageSelection.name}</span>
          <strong className="mobile-total">{formatMoney(totalPrice)}</strong>
        </div>
        {mobileView === 'preview' && (
          <div className="mobile-preview-switcher">
            <button type="button" className={previewTab === 'digital' ? 'active' : ''} onClick={() => setPreviewTab('digital')}>
              Digital
            </button>
            <button type="button" className={previewTab === 'physical' ? 'active' : ''} onClick={() => setPreviewTab('physical')}>
              Physique
            </button>
          </div>
        )}
        <button type="button" className={`mobile-toggle${mobileView === 'preview' ? ' active' : ''}`}
          onClick={() => setMobileView((v) => {
            if (v === 'form') {
              mobileScrollPos.current = window.scrollY;
              return 'preview';
            }
            requestAnimationFrame(() => window.scrollTo(0, mobileScrollPos.current));
            return 'form';
          })}>
          {mobileView === 'preview' ? '← Formulaire' : 'Aperçu →'}
        </button>
      </div>

    </div>
  );
}
