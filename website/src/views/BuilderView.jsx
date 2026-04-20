import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { startCheckout, submitOrder, fetchInventory, validateCoupon, checkDomain, submitCleEnMainOrder } from '../lib/api';
import VoiceAssistant from '../components/VoiceAssistant';
import { CardCanvas } from './builder/CardCanvas';
import { FieldEditor } from './builder/FieldEditor';
import { CheckoutWizard, PhysicalCardMock } from './builder/CheckoutWizard';
import { SOCIAL_ICON_MAP as BUILDER_SOCIAL_ICON_MAP } from './builder/builderIcons';
import {
  analyzePrompt,
  buildOrderBrief,
  buildWhatsAppUrl,
  calculateTotalPrice,
  cardTemplates,
  composeCardUrl,
  createSlug,
  defaultAssets,
  defaultCustomization,
  defaultOrderContact,
  defaultProfile,
  foilCatalog,
  formatMoney,
  getInitials,
  materialCatalog,
  orderContactFields,
  packCatalog,
  profileFields,
  serializeAsset,
  socialFields,
  themeCatalog,
} from '../lib/catalog';
import { useI18n, getSupportedLanguages, setLanguage as setI18nLang } from '../lib/i18n';
import { useDarkMode } from '../lib/darkMode';
import { SvgSun, SvgMoon, SvgMonitor, SvgMic, SvgGrid, TEMPLATE_ICON_MAP } from './builder/builderIcons';

// Fields that can be edited inline directly on the canvas (no side panel)
const INLINE_TEXT_FIELDS = new Set(['fullName', 'role', 'company', 'phone', 'email', 'website', 'bio']);

function InlineEditOverlay({ editingField, profile, onFieldChange, onClose }) {
  const { key, rect } = editingField;
  const fieldMeta = profileFields.find((f) => f.key === key);
  const isTextarea = key === 'bio';

  return (
    <div className="inline-edit-backdrop" onClick={onClose}>
      <div
        className="inline-edit-float"
        style={{ top: rect.top, left: rect.left, width: Math.max(rect.width, 220) }}
        onClick={(event) => event.stopPropagation()}
      >
        {isTextarea ? (
          <textarea
            className="inline-edit-input"
            autoFocus
            value={profile[key] || ''}
            placeholder={fieldMeta?.placeholder || fieldMeta?.label || key}
            rows={3}
            onChange={(event) => onFieldChange(key, event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
          />
        ) : (
          <input
            className="inline-edit-input"
            autoFocus
            type="text"
            value={profile[key] || ''}
            placeholder={fieldMeta?.placeholder || fieldMeta?.label || key}
            onChange={(event) => onFieldChange(key, event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') onClose(); }}
          />
        )}
        <button type="button" className="inline-edit-done" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.85L.073 23.928a.5.5 0 0 0 .611.611l6.181-1.462A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.032-1.384l-.36-.214-3.732.882.897-3.63-.236-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
    </svg>
  );
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google Maps API key not configured'));
  if (window._googleMapsPromise) return window._googleMapsPromise;
  if (window.google?.maps?.places) return Promise.resolve();
  window._googleMapsPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window._googleMapsPromise = null;
      reject(new Error('Google Maps took too long to load'));
    }, 8000);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&language=fr`;
    script.async = true;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); window._googleMapsPromise = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(script);
  });
  return window._googleMapsPromise;
}

function LocationPicker({ value, onChange }) {
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [inputValue, setInputValue] = useState(value || '');
  const [mapsReady, setMapsReady] = useState(() => !!window.google?.maps?.places);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionMode, setSuggestionMode] = useState(() => (GOOGLE_MAPS_KEY ? 'google' : 'fallback'));

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    loadGoogleMaps()
      .then(() => {
        setMapsReady(true);
        setSuggestionMode('google');
      })
      .catch(() => {
        setSuggestionMode('fallback');
      });
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
      setInputValue(label);
      setSelected({ lat, lng, label });
      setSuggestions([]);
      onChange(label);
    });
    return () => {
      window.google?.maps?.event.removeListener(listener);
    };
  }, [mapsReady, onChange]);

  useEffect(() => {
    if (mapsReady || suggestionMode !== 'fallback') return;

    const query = inputValue.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        setIsLoadingSuggestions(true);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Location lookup failed');
        const results = await response.json();
        setSuggestions(
          (results || []).map((item) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon),
          })),
        );
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [inputValue, mapsReady, suggestionMode]);

  const staticMapUrl = selected?.lat != null && GOOGLE_MAPS_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${selected.lat},${selected.lng}&zoom=15&size=480x180&scale=2&markers=color:red%7C${selected.lat},${selected.lng}&key=${GOOGLE_MAPS_KEY}`
    : null;
  const osmEmbedUrl = selected?.lat != null && !GOOGLE_MAPS_KEY
    ? (() => {
      const latDelta = 0.008;
      const lngDelta = 0.012;
      const bbox = [
        selected.lng - lngDelta,
        selected.lat - latDelta,
        selected.lng + lngDelta,
        selected.lat + latDelta,
      ].join(',');
      return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${selected.lat},${selected.lng}`)}`;
    })()
    : null;

  function applySuggestion(next) {
    setInputValue(next.label);
    setSelected(next);
    setSuggestions([]);
    onChange(next.label);
  }

  return (
    <div className="location-picker">
      <div className="location-search-row">
        <div className="location-input-wrap">
          <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          <input
            ref={inputRef}
            type="text"
            className="location-input"
            value={inputValue}
            placeholder="Rechercher un lieu, une entreprise..."
            onChange={(event) => {
              setInputValue(event.target.value);
              if (mapsReady) onChange(event.target.value);
            }}
            onBlur={(event) => {
              window.setTimeout(() => {
                if (event.target.value && event.target.value !== value) onChange(event.target.value);
                setSuggestions([]);
              }, 120);
            }}
          />
        </div>
      </div>
      {suggestionMode === 'fallback' && (
        <div className="location-help-row">
          <span className="location-help-text">
            {isLoadingSuggestions ? 'Recherche de suggestions...' : 'Suggestions de lieu actives.'}
          </span>
        </div>
      )}
      {!mapsReady && suggestions.length > 0 && (
        <div className="location-suggestions" role="listbox" aria-label="Suggestions de lieu">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
              type="button"
              className="location-suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
      {(staticMapUrl || osmEmbedUrl) && (
        <div className="location-map-wrap">
          {staticMapUrl ? (
            <img src={staticMapUrl} alt="Carte" className="location-map-static" />
          ) : (
            <iframe
              src={osmEmbedUrl}
              title="Aperçu de la carte"
              className="location-map-static location-map-static-frame"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
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
          <p className="adjuster-gesture-hint">↔ Glisser · Molette: zoom dans l'aperçu</p>
        </div>
      )}
    </div>
  );
}

/* ── NFC Activation Guide — interactive phone picker ───────────── */
const NFC_PHONES = [
  {
    key: 'iphone-new', label: 'iPhone XS / XR ou plus recent', icon: '🍎',
    steps: ['Le NFC est toujours actif — aucune activation necessaire.', 'Approchez la carte Tapal du haut arriere de votre iPhone (pres de la camera).', 'La page de votre carte s\'ouvre automatiquement dans Safari.'],
    tip: null,
    placement: 'En haut au dos du telephone, pres de la camera.',
  },
  {
    key: 'iphone-old', label: 'iPhone 7 / 8 / X', icon: '🍎',
    steps: ['Ouvrez le Centre de controle (glissez depuis le coin superieur droit).', 'Appuyez sur l\'icone NFC (rectangle avec des ondes).', 'Approchez la carte Tapal du haut arriere de l\'iPhone.'],
    tip: 'Si l\'icone NFC n\'apparait pas : Reglages → Centre de controle → ajoutez « Lecteur de tags NFC ».',
    placement: 'En haut au dos du telephone, pres de la camera.',
  },
  {
    key: 'iphone-6', label: 'iPhone 6 et moins', icon: '🍎',
    steps: ['Le NFC n\'est pas supporte pour la lecture sur ces modeles.', 'Utilisez le QR code au verso de votre carte Tapal a la place.', 'Ouvrez l\'appareil photo et pointez vers le QR code.'],
    tip: null,
    placement: null,
  },
  {
    key: 'samsung', label: 'Samsung (Galaxy S / A / Note)', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Connexions.', 'Activez NFC et paiement sans contact.'],
    tip: 'Raccourci : glissez le panneau de notifications vers le bas et appuyez sur l\'icone NFC.',
    placement: 'Au centre du dos du telephone.',
  },
  {
    key: 'xiaomi', label: 'Xiaomi / Redmi / POCO', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Connexion et partage.', 'Activez NFC.'],
    tip: null,
    placement: 'Au centre du dos du telephone.',
  },
  {
    key: 'huawei', label: 'Huawei / Honor', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Plus de parametres de connectivite.', 'Activez NFC.'],
    tip: null,
    placement: 'Au centre du dos du telephone.',
  },
  {
    key: 'oppo', label: 'Oppo / Realme / OnePlus', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Connexion et partage (ou Parametres supplementaires).', 'Activez NFC.'],
    tip: null,
    placement: 'Au centre du dos du telephone.',
  },
  {
    key: 'pixel', label: 'Google Pixel', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Appareils connectes → Preferences de connexion.', 'Activez NFC.'],
    tip: null,
    placement: 'Au centre du dos du telephone.',
  },
  {
    key: 'motorola', label: 'Motorola / Lenovo', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Appareils connectes (ou Sans fil et reseaux → Plus).', 'Activez NFC.'],
    tip: null,
    placement: 'Au centre du dos, pres du logo Motorola.',
  },
  {
    key: 'tecno', label: 'Tecno / Infinix / itel', icon: '📱',
    steps: ['Ouvrez Parametres.', 'Allez dans Connexion et partage (ou Plus de connectivite).', 'Activez NFC (si disponible).'],
    tip: 'Certains modeles d\'entree de gamme n\'ont pas de NFC. Verifiez les specs de votre modele.',
    placement: 'Au centre du dos du telephone.',
  },
];

function NfcGuide() {
  const [selected, setSelected] = useState(null);
  const phone = NFC_PHONES.find((p) => p.key === selected);

  return (
    <div className="nfc-guide">
      <div className="nfc-guide-header">
        <span className="nfc-guide-icon">📡</span>
        <div>
          <strong>Comment activer le NFC ?</strong>
          <p className="nfc-guide-subtitle">Selectionnez votre telephone pour voir les instructions.</p>
        </div>
      </div>
      <div className="nfc-phone-picker">
        {NFC_PHONES.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`nfc-phone-btn${selected === p.key ? ' active' : ''}`}
            onClick={() => setSelected(selected === p.key ? null : p.key)}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {phone && (
        <div className="nfc-phone-instructions">
          <h4>{phone.label}</h4>
          <ol className="nfc-steps">
            {phone.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {phone.tip && <p className="nfc-guide-tip">💡 {phone.tip}</p>}
          {phone.placement && (
            <div className="nfc-placement">
              <span>📍</span>
              <span><strong>Ou placer la carte :</strong> {phone.placement}</span>
            </div>
          )}
        </div>
      )}
      {!phone && (
        <p className="nfc-guide-hint">💡 Astuce universelle : cherchez « NFC » dans la barre de recherche des Parametres de votre telephone.</p>
      )}
    </div>
  );
}

export function BuilderView() {
  const { t, lang } = useI18n();
  const { mode: darkMode, toggle: toggleDark, effective: effectiveTheme } = useDarkMode();

  // ── ONBOARDING ───────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem('tapal-onboarded') !== 'true'; } catch { return true; }
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  const onboardingSteps = [
    { svgIcon: <SvgGrid />, titleKey: 'builder.onboarding.step1', descKey: 'builder.onboarding.step1desc' },
    { svgIcon: <SvgMic />, titleKey: 'builder.onboarding.step2', descKey: 'builder.onboarding.step2desc' },
    { svgIcon: <SvgSun />, titleKey: 'builder.onboarding.step3', descKey: 'builder.onboarding.step3desc' },
  ];
  function finishOnboarding() {
    setShowOnboarding(false);
    try { localStorage.setItem('tapal-onboarded', 'true'); } catch {}
  }

  // ── TEMPLATE PICKER ──────────────────────────────────────────────
  const [showTemplates, setShowTemplates] = useState(false);
  function applyTemplate(tpl) {
    setProfile((p) => ({ ...p, ...tpl.profile }));
    setCustomization((c) => ({
      ...c,
      themeKey: tpl.customization.theme,
      accent: tpl.customization.accent,
      material: tpl.customization.material,
      finish: tpl.customization.finish,
      foil: tpl.customization.foil,
      fontStyle: tpl.customization.fontStyle || c.fontStyle,
    }));
    if (tpl.customization.cardLayout) setCardLayout(tpl.customization.cardLayout);
    setAutoStyle(false);
    setShowTemplates(false);
    setToolbarPanel(null);
  }

  const [profile, setProfile] = useState(defaultProfile);
  const [orderContact, setOrderContact] = useState(defaultOrderContact);
  const [customization, setCustomization] = useState(defaultCustomization);
  const [assets, setAssets] = useState(defaultAssets);
  const [selectedPackKey, setSelectedPackKey] = useState('pro');
  const [autoStyle, setAutoStyle] = useState(false);

  /* Business pack: up to 5 card profiles */
  const emptyBusinessCard = () => ({ fullName: '', role: '', email: '', phone: '' });
  const [businessCards, setBusinessCards] = useState(() =>
    Array.from({ length: 5 }, emptyBusinessCard),
  );
  function updateBusinessCard(index, field, value) {
    setBusinessCards((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }
  const [bambaMode, setBambaMode] = useState(false);
  const [bambaDesc, setBambaDesc] = useState('');
  const [bambaQty, setBambaQty] = useState(1);
  const [showVoice, setShowVoice] = useState(false);
  const [editorMode, setEditorMode] = useState('canvas');
  const [editingField, setEditingField] = useState(null);
  const [toolbarPanel, setToolbarPanel] = useState(null);
  const [showEditHints, setShowEditHints] = useState(() => {
    try {
      return window.sessionStorage.getItem('tapal-edit-hints-seen') !== 'true';
    } catch {
      return true;
    }
  });
  const [cardLayout, setCardLayout] = useState('classic');
  const [customRefFile, setCustomRefFile] = useState(null);
  const [customRefPreview, setCustomRefPreview] = useState('');

  const [submitState, setSubmitState] = useState({ status: 'idle', message: '', order: null, paymentUrl: '' });
  const [showValidation, setShowValidation] = useState(false);
  const [inventory, setInventory] = useState({});
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

  // Social links that have a value
  const activeSocials = socialFields.filter((sf) => profile[sf.key]?.trim()).map((sf) => ({
    key: sf.key, label: sf.label, url: profile[sf.key], Icon: BUILDER_SOCIAL_ICON_MAP[sf.key],
  }));
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

  const cardSurface = useMemo(() => ({
    '--card-base': materialCatalog[customization.material]?.base || '#ffffff',
    '--card-edge': materialCatalog[customization.material]?.edge || '#ccc',
    '--card-ink': materialCatalog[customization.material]?.ink || '#111',
    '--card-accent': activeAccent,
    '--card-foil': customization.foil !== 'No foil' ? foilCatalog[customization.foil] : null,
  }), [activeAccent, customization.foil, customization.material]);

  const bambaBrief = useMemo(() => {
    // Use perCardBase if defined (e.g. Business = 27000), else derive from pack price
    const perCardPrice = packageSelection?.perCardBase ?? Math.round((packageSelection?.price ?? 0) / (packageSelection?.quantity ?? 1));
    let totalQtyPrice = perCardPrice * bambaQty;
    if (bambaQty >= 10) totalQtyPrice = Math.round(totalQtyPrice * 0.70);
    else if (bambaQty >= 5) totalQtyPrice = Math.round(totalQtyPrice * 0.80);
    else if (bambaQty >= 3) totalQtyPrice = Math.round(totalQtyPrice * 0.90);
    const lines = [
      `*Commande Cle en main - Tapal*`,
      ``,
      `Nom : ${profile.fullName}`,
      `WhatsApp : ${profile.phone}`,
      `Pack : ${packageSelection.name} (${formatMoney(perCardPrice)}/carte)`,
      `Qte : ${bambaQty} carte(s)${bambaQty > 1 ? ` — Total : ${formatMoney(totalQtyPrice)}` : ` — Total : ${formatMoney(totalQtyPrice)}`}`,
      ...(discountAmount > 0 ? [`Coupon : ${appliedCoupon?.code ?? ''} (-${formatMoney(discountAmount)})`] : []),
      ...(wantCustomDomain && normalizedCustomDomain
        ? [`Domaine : ${normalizedCustomDomain}${domainSurcharge > 0 ? ` (+${formatMoney(domainSurcharge)})` : ' (inclus)'}`]
        : []),
    ];
    if (orderContact.deliveryCity) lines.push(`Ville : ${orderContact.deliveryCity}`);
    if (bambaDesc.trim()) lines.push(``, `Description : ${bambaDesc.trim()}`);
    lines.push(``, `Merci de me rappeler pour finaliser le design !`);
    return lines.join('\n');
  }, [appliedCoupon, bambaDesc, bambaQty, discountAmount, domainSurcharge, finalPrice, normalizedCustomDomain, orderContact.deliveryCity, packageSelection, profile.fullName, profile.phone, wantCustomDomain]);
  const bambaWhatsAppUrl = useMemo(() => buildWhatsAppUrl(bambaBrief), [bambaBrief]);

  function handleBambaWhatsApp(e) {
    e.preventDefault();
    // Fire-and-forget: save order to DB (don't block WA opening)
    submitCleEnMainOrder({
      name: profile.fullName,
      phone: profile.phone,
      city: orderContact.deliveryCity,
      packKey: selectedPackKey,
      quantity: bambaQty,
      description: bambaDesc,
    }).catch(() => { /* silently ignore — WA message is the fallback */ });
    window.open(bambaWhatsAppUrl, '_blank', 'noopener,noreferrer');
  }

  assetRef.current = assets;

  const [previewQrUrl, setPreviewQrUrl] = useState('');

  useEffect(() => {
    let active = true;
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
    if (!bambaMode) return;
    setEditorMode('canvas');
    setEditingField(null);
    setToolbarPanel(null);
  }, [bambaMode]);

  useEffect(() => {
    if (bambaMode || !showEditHints) return undefined;

    const timer = window.setTimeout(() => dismissEditHints(), 1500);
    return () => window.clearTimeout(timer);
  }, [bambaMode, showEditHints]);

  useEffect(() => {
    if (!toolbarPanel) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setToolbarPanel(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolbarPanel]);

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

  function dismissEditHints() {
    setShowEditHints(false);
    try {
      window.sessionStorage.setItem('tapal-edit-hints-seen', 'true');
    } catch {
      // ignore session storage failures
    }
  }

  function handleRemoveAsset(assetKey) {
    const currentAsset = assets[assetKey];
    if (currentAsset?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(currentAsset.previewUrl);
    }
    updateAsset(assetKey, { ...defaultAssets[assetKey] });
  }

  const adjustAsset = (assetKey, field, value) =>
    updateAsset(assetKey, { ...assets[assetKey], [field]: value });

  function handleEditField(key, element) {
    dismissEditHints();
    setToolbarPanel(null);
    if (INLINE_TEXT_FIELDS.has(key) && element) {
      const rect = element.getBoundingClientRect();
      setEditingField({ type: 'inline', key, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } });
    } else {
      setEditingField({ type: key === 'socials' ? 'socials' : 'field', key });
    }
  }

  function handleEditImage(key) {
    dismissEditHints();
    setToolbarPanel(null);
    setEditingField({ type: 'image', key });
  }

  function handleOpenToolbarPanel(panel) {
    dismissEditHints();
    setEditingField(null);
    setToolbarPanel((current) => (current === panel ? null : panel));
  }

  function handleSelectPack(packKey) {
    setSelectedPackKey(packKey);
    if (packKey === 'starter') {
      setWantCustomDomain(false);
      setCustomDomain('');
      setDomainResult(null);
    }
  }

  function handleEnterCheckout() {
    dismissEditHints();
    setEditingField(null);
    setToolbarPanel(null);
    setEditorMode('checkout');
  }

  function handleExitCheckout() {
    setEditorMode('canvas');
    setEditingField(null);
    setToolbarPanel(null);
  }

  function handleCancelValidation() {
    setShowValidation(false);
    setSavedOrderId(null);
    setSavedFinalCardUrl('');
    setSavedPreviewQrUrl('');
  }

  function handleToggleCustomDomain(value) {
    setWantCustomDomain(value);
    if (!value) {
      setCustomDomain('');
      setDomainResult(null);
    }
  }

  function applyPromptToCard() {
    setCustomization((c) => ({ ...c, material: promptSuggestion.material, finish: promptSuggestion.finish, foil: promptSuggestion.foil }));
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
        businessCards: selectedPackKey === 'business' ? businessCards : null,
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
          businessCards: selectedPackKey === 'business' ? businessCards : null,
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

      const checkoutResponse = await startCheckout(orderId);

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

  const layoutOptions = [
    { key: 'classic', label: 'Classique', thumb: 'cl' },
    { key: 'banner', label: 'Banniere', thumb: 'bn' },
    { key: 'split', label: 'Bicolonne', thumb: 'sp' },
    { key: 'minimal', label: 'Minimal', thumb: 'mn' },
    { key: 'bold', label: 'Bold', thumb: 'bd' },
    { key: 'grid', label: 'Grille', thumb: 'gr' },
    { key: 'elegant', label: 'Elegant', thumb: 'el' },
    { key: 'gradient', label: 'Gradient', thumb: 'gd' },
    { key: 'custom', label: 'Sur mesure', thumb: 'cu' },
  ];
  const fontOptions = [
    { key: 'moderne', label: 'Moderne', sample: 'Aa' },
    { key: 'elegant', label: 'Elegant', sample: 'Aa' },
    { key: 'technique', label: 'Technique', sample: 'Aa' },
    { key: 'arrondi', label: 'Arrondi', sample: 'Aa' },
    { key: 'roboto', label: 'Google', sample: 'Aa' },
    { key: 'sf', label: 'Apple', sample: 'Aa' },
    { key: 'segoe', label: 'Microsoft', sample: 'Aa' },
  ];
  const toolbarTitleMap = {
    layout: 'Mise en page',
    theme: 'Theme',
    colors: 'Couleurs',
    physical: 'Carte physique',
  };
  const PANEL_ORDER = ['layout', 'theme', 'colors', 'physical'];
  const currentPanelIdx = PANEL_ORDER.indexOf(toolbarPanel);
  const prevPanel = currentPanelIdx > 0 ? PANEL_ORDER[currentPanelIdx - 1] : null;
  const nextPanel = currentPanelIdx < PANEL_ORDER.length - 1 ? PANEL_ORDER[currentPanelIdx + 1] : null;
  const currentLayoutLabel = layoutOptions.find((option) => option.key === cardLayout)?.label || 'Classique';

  function renderToolbarPanel() {
    if (!toolbarPanel || editorMode === 'checkout') return null;

    // Physical panel: same overlay style as other panels
    if (toolbarPanel === 'physical') {
      return (
        <div className="toolbar-panel-overlay" onClick={() => setToolbarPanel(null)}>
        <div className="toolbar-panel-sheet" role="dialog" aria-label="Carte physique" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="toolbar-panel-head">
            <div>
              <p className="toolbar-panel-kicker">Outils</p>
              <h3>Carte physique</h3>
            </div>
            <button type="button" className="field-editor-close" onClick={() => setToolbarPanel(null)} aria-label="Fermer">
              Fermer
            </button>
          </div>
          <div className="toolbar-panel-body">
            <div className="form-grid">
              <label className="field">
                <span>Materiau</span>
                <select value={customization.material} onChange={(event) => updateCustomization('material', event.target.value)}>
                  {Object.keys(materialCatalog).map((material) => {
                    const outOfStock = inventory[`material:${material}`]?.inStock === false;
                    return (
                      <option key={material} value={material} disabled={outOfStock}>
                        {material}{outOfStock ? ' - epuise' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="field">
                <span>Finition</span>
                <select value={customization.finish} onChange={(event) => updateCustomization('finish', event.target.value)}>
                  <option>Matte</option>
                  <option>Soft matte</option>
                  <option>Satin</option>
                  <option>Gloss</option>
                </select>
              </label>
              <label className="field span-full">
                <span>Dorure</span>
                <select value={customization.foil} onChange={(event) => updateCustomization('foil', event.target.value)}>
                  {Object.keys(foilCatalog).map((foil) => {
                    const outOfStock = inventory[`foil:${foil}`]?.inStock === false;
                    return (
                      <option key={foil} value={foil} disabled={outOfStock}>
                        {foil}{outOfStock ? ' - epuise' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <label className="field span-full">
              <span>Message au verso</span>
              <input type="text" value={customization.backsideMessage} onChange={(event) => updateCustomization('backsideMessage', event.target.value)} />
            </label>
            <div className="toggle-row">
              <label className="toggle-pill">
                <input type="checkbox" checked={customization.includeQr} onChange={(event) => updateCustomization('includeQr', event.target.checked)} />
                <span>QR code au verso</span>
              </label>
              <label className="toggle-pill">
                <input type="checkbox" checked={customization.includeLogo} onChange={(event) => updateCustomization('includeLogo', event.target.checked)} />
                <span>Logo au recto</span>
              </label>
            </div>

            {/* ── Logo placement controls ─────────────────── */}
            {customization.includeLogo && (
              <div className="placement-controls">
                <p className="placement-label">Logo</p>
                <AssetField
                  title="Image du logo"
                  asset={assets.logo}
                  onFileChange={(event) => handleAssetFile('logo', event.target.files?.[0] ?? null)}
                  onRemoteChange={(value) => handleAssetRemote('logo', value)}
                  onAdjust={(field, value) => adjustAsset('logo', field, value)}
                />
                <div className="placement-row">
                  <label className="field">
                    <span>Position</span>
                    <select value={customization.logoPosition} onChange={(event) => updateCustomization('logoPosition', event.target.value)}>
                      <option value="top-left">Haut gauche</option>
                      <option value="top-right">Haut droite</option>
                      <option value="bottom-left">Bas gauche</option>
                      <option value="bottom-right">Bas droite</option>
                      <option value="center">Centre</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Taille</span>
                    <select value={customization.logoSize} onChange={(event) => updateCustomization('logoSize', event.target.value)}>
                      <option value="small">Petit</option>
                      <option value="medium">Moyen</option>
                      <option value="large">Grand</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {/* ── QR placement controls ───────────────────── */}
            {customization.includeQr && (
              <div className="placement-controls">
                <p className="placement-label">QR Code</p>
                <div className="placement-row">
                  <label className="field">
                    <span>Position</span>
                    <select value={customization.qrPosition} onChange={(event) => updateCustomization('qrPosition', event.target.value)}>
                      <option value="center">Centre</option>
                      <option value="top-left">Haut gauche</option>
                      <option value="top-right">Haut droite</option>
                      <option value="bottom-left">Bas gauche</option>
                      <option value="bottom-right">Bas droite</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Taille</span>
                    <select value={customization.qrSize} onChange={(event) => updateCustomization('qrSize', event.target.value)}>
                      <option value="small">Petit</option>
                      <option value="medium">Moyen</option>
                      <option value="large">Grand</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            <AssetField
              title="Visuel recto (carte NFC physique)"
              asset={assets.artwork}
              onFileChange={(event) => handleAssetFile('artwork', event.target.files?.[0] ?? null)}
              onRemoteChange={(value) => handleAssetRemote('artwork', value)}
              onAdjust={(field, value) => adjustAsset('artwork', field, value)}
              rotationEnabled
            />

            {/* ── NFC Activation Guide ─────────────────────── */}
            <NfcGuide />

            <div className="wizard-actions wizard-actions--inline">
              <button type="button" className="primary-btn" onClick={handleEnterCheckout}>
                Continuer vers la commande
              </button>
            </div>
          </div>
          <div className="toolbar-panel-nav">
            {prevPanel ? (
              <button type="button" className="toolbar-nav-btn toolbar-nav-btn--prev" onClick={() => setToolbarPanel(prevPanel)}>
                ← {toolbarTitleMap[prevPanel]}
              </button>
            ) : <span />}
          </div>
        </div>
        </div>
      );
    }

    return (
      <div className="toolbar-panel-overlay" onClick={() => setToolbarPanel(null)}>
        <div className="toolbar-panel-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={toolbarTitleMap[toolbarPanel]}>
          <div className="toolbar-panel-head">
            <div>
              <p className="toolbar-panel-kicker">Outils</p>
              <h3>{toolbarTitleMap[toolbarPanel]}</h3>
            </div>
            <button type="button" className="field-editor-close" onClick={() => setToolbarPanel(null)} aria-label="Fermer le panneau">
              Fermer
            </button>
          </div>

          {toolbarPanel === 'layout' && (
            <div className="toolbar-panel-body">
              <p className="field-label-sm">Modeles</p>
              <div className="template-gallery stagger-children" style={{ marginBottom: '1rem' }}>
                {cardTemplates.map((tpl) => {
                  const TplIcon = TEMPLATE_ICON_MAP[tpl.key];
                  return (
                    <div key={tpl.key} className="template-card hover-lift" onClick={() => applyTemplate(tpl)}>
                      <span className="tpl-icon">{TplIcon ? <TplIcon /> : tpl.key.slice(0, 2).toUpperCase()}</span>
                      <span className="label">{t(tpl.labelKey) || tpl.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="field-label-sm">Choisissez le format de votre carte digitale</p>
              <div className="layout-picker">
                {layoutOptions.map((layout) => (
                  <button
                    key={layout.key}
                    type="button"
                    className={`layout-chip${cardLayout === layout.key ? ' active' : ''}${layout.key === 'custom' ? ' layout-chip-custom' : ''}`}
                    onClick={() => setCardLayout(layout.key)}
                  >
                    <span className={`layout-thumb lt-${layout.thumb}`} />
                    <span>{layout.label}</span>
                  </button>
                ))}
              </div>

              <p className="toolbar-note">
                La couverture n'apparait que sur les layouts Banner, Split, Gradient et Sur mesure.
              </p>

              {cardLayout === 'custom' && (
                <div className="custom-layout-panel">
                  <div className="custom-layout-banner">
                    <span>Notre studio creera un layout unique selon vos instructions.</span>
                  </div>
                  <label className="field">
                    <span>Decrivez le layout souhaite</span>
                    <textarea
                      rows="4"
                      value={customization.customLayoutDescription ?? ''}
                      placeholder="Ex : photo en plein fond avec nom en bas, couleurs turquoise et blanc, style minimaliste luxe..."
                      onChange={(event) => updateCustomization('customLayoutDescription', event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>URL de reference (optionnel)</span>
                    <input
                      type="url"
                      value={customization.customLayoutRefUrl ?? ''}
                      placeholder="https://exemple.com/design-ref"
                      onChange={(event) => updateCustomization('customLayoutRefUrl', event.target.value)}
                    />
                  </label>
                  <label className="field upload-field">
                    <span>Image de reference (optionnel)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (customRefPreview?.startsWith('blob:')) URL.revokeObjectURL(customRefPreview);
                        setCustomRefFile(file);
                        setCustomRefPreview(file ? URL.createObjectURL(file) : '');
                      }}
                    />
                  </label>
                  {customRefPreview && (
                    <div className="custom-ref-preview">
                      <span>Apercu reference</span>
                      <img src={customRefPreview} alt="Reference design" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {toolbarPanel === 'theme' && (
            <div className="toolbar-panel-body">
              <div className="toolbar-section">
                <p className="field-label-sm">Theme</p>
                <div className="theme-grid">
                  {Object.entries(themeCatalog).map(([key, theme]) => (
                    <button
                      key={key}
                      type="button"
                      className={`theme-chip${activeThemeKey === key ? ' active' : ''}`}
                      onClick={() => {
                        setAutoStyle(false);
                        updateCustomization('themeKey', key);
                      }}
                    >
                      <span className="theme-dot" style={{ background: theme.accent }} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toolbar-section">
                <p className="field-label-sm">Style de texte</p>
                <div className="font-style-picker">
                  {fontOptions.map((font) => (
                    <button
                      key={font.key}
                      type="button"
                      className={`font-chip${customization.fontStyle === font.key ? ' active' : ''}`}
                      data-font={font.key}
                      onClick={() => updateCustomization('fontStyle', font.key)}
                    >
                      <span className="font-sample">{font.sample}</span>
                      <span>{font.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="field span-full">
                <span>Label carte</span>
                <input type="text" value={customization.cardLabel} onChange={(event) => updateCustomization('cardLabel', event.target.value)} />
              </label>

              <div className="animation-section">
                <div className="animation-toggle-row">
                  <div>
                    <p className="animation-title">Animations</p>
                    <p className="animation-subtitle">Transitions et effets sur la carte digitale</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={customization.animationEnabled ?? false} onChange={(event) => updateCustomization('animationEnabled', event.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
                {customization.animationEnabled && (
                  <label className="field">
                    <span>Decrivez l'animation souhaitee</span>
                    <textarea
                      rows="3"
                      value={customization.animationDescription ?? ''}
                      placeholder="Ex : apparition progressive de chaque section, fond avec particules flottantes, nom avec effet shimmer dore..."
                      onChange={(event) => updateCustomization('animationDescription', event.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {toolbarPanel === 'colors' && (
            <div className="toolbar-panel-body toolbar-panel-body--compact">
              <div className="field span-full">
                <span className="field-label-sm">Couleur d'accent</span>
                <label className={`accent-picker-label${autoStyle ? ' accent-picker-locked' : ''}`}>
                  <span className="accent-swatch-lg" style={{ background: activeAccent }} />
                  <span className="accent-hex">{activeAccent.toUpperCase()}</span>
                  <span className="accent-pick-hint">Choisir</span>
                  <input
                    type="color"
                    value={autoStyle ? promptSuggestion.accent : customization.accent}
                    disabled={autoStyle}
                    onChange={(event) => updateCustomization('accent', event.target.value)}
                  />
                </label>
              </div>

              <div className="field span-full">
                <span className="field-label-sm">Couleur du texte</span>
                <label className="accent-picker-label">
                  <span className="accent-swatch-lg" style={{ background: customization.textColor || '#e8ddd0', border: customization.textColor ? 'none' : '2px dashed #555' }} />
                  <span className="accent-hex">{customization.textColor ? customization.textColor.toUpperCase() : 'Auto'}</span>
                  {customization.textColor && (
                    <button
                      type="button"
                      className="color-reset-btn"
                      onClick={(event) => {
                        event.preventDefault();
                        updateCustomization('textColor', '');
                      }}
                    >
                      X
                    </button>
                  )}
                  <input type="color" value={customization.textColor || '#e8ddd0'} onChange={(event) => updateCustomization('textColor', event.target.value)} />
                </label>
              </div>

              <div className="field span-full">
                <span className="field-label-sm">Couleur de fond</span>
                <label className="accent-picker-label">
                  <span className="accent-swatch-lg" style={{ background: customization.bgColor || '#0c1b2b', border: customization.bgColor ? 'none' : '2px dashed #555' }} />
                  <span className="accent-hex">{customization.bgColor ? customization.bgColor.toUpperCase() : 'Auto'}</span>
                  {customization.bgColor && (
                    <button
                      type="button"
                      className="color-reset-btn"
                      onClick={(event) => {
                        event.preventDefault();
                        updateCustomization('bgColor', '');
                      }}
                    >
                      X
                    </button>
                  )}
                  <input type="color" value={customization.bgColor || '#0c1b2b'} onChange={(event) => updateCustomization('bgColor', event.target.value)} />
                </label>
              </div>
            </div>
          )}

          {/* ── Panel navigation footer ── */}
          <div className="toolbar-panel-nav">
            {prevPanel ? (
              <button type="button" className="toolbar-nav-btn toolbar-nav-btn--prev" onClick={() => setToolbarPanel(prevPanel)}>
                ← {toolbarTitleMap[prevPanel]}
              </button>
            ) : <span />}
            {nextPanel ? (
              <button type="button" className="toolbar-nav-btn toolbar-nav-btn--next" onClick={() => setToolbarPanel(nextPanel)}>
                {toolbarTitleMap[nextPanel]} →
              </button>
            ) : <span />}
          </div>

        </div>
      </div>
    );
  }

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
            {t('nav.canvas')}
          </button>
          <button type="button" className={`mode-tab mode-tab-cle${bambaMode ? ' active' : ''}`} onClick={() => setBambaMode(true)}>
            {t('nav.turnkey')}
          </button>
        </div>
        <div className="topbar-utils">
          <div className="lang-picker">
            {getSupportedLanguages().map((l) => (
              <button key={l.code} type="button" className={`lang-btn${lang === l.code ? ' active' : ''}`} onClick={() => setI18nLang(l.code)}>
                {l.flag}
              </button>
            ))}
          </div>
          <button type="button" className="dark-toggle btn-press" onClick={toggleDark} title={t(`darkMode.${darkMode}`)}>
            <span className="icon">{effectiveTheme === 'dark' ? <SvgSun /> : <SvgMoon />}</span>
            <span>{effectiveTheme === 'dark' ? t('darkMode.light') : t('darkMode.dark')}</span>
          </button>
          <button type="button" className="voice-trigger-btn btn-press" aria-label="Commander par voix" onClick={() => setShowVoice(true)}>
            <SvgMic />
          </button>
        </div>
      </header>

      {/* ── ONBOARDING ─────────────────────────────────────────── */}
      {showOnboarding && (
        <div className="onboarding-overlay" onClick={finishOnboarding}>
          <div className="onboarding-card anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="onboarding-step-icon">{onboardingSteps[onboardingStep].svgIcon}</div>
            <div className="onboarding-step-title">{t(onboardingSteps[onboardingStep].titleKey)}</div>
            <div className="onboarding-step-desc">{t(onboardingSteps[onboardingStep].descKey)}</div>
            <div className="onboarding-dots">
              {onboardingSteps.map((_, i) => (
                <div key={i} className={`onboarding-dot${i === onboardingStep ? ' active' : ''}`} />
              ))}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-skip" onClick={finishOnboarding}>
                {t('builder.onboarding.skip')}
              </button>
              <button type="button" className="btn-primary btn-press" onClick={() => {
                if (onboardingStep < onboardingSteps.length - 1) setOnboardingStep(onboardingStep + 1);
                else finishOnboarding();
              }}>
                {onboardingStep < onboardingSteps.length - 1 ? t('builder.onboarding.next') : t('builder.onboarding.start')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`studio-layout${!bambaMode ? ' studio-layout--canvas' : ''}`}>
        {bambaMode ? (
          <>
            <aside className="form-pane">
              <form className="form-scroll" onSubmit={handleSubmit}>
                <div className="cle-banner">
                  <div className="cle-banner-icon">⚡</div>
                  <div>
                    <h2>Service Cle en main</h2>
                    <p>Donnez votre nom et WhatsApp. Notre studio cree tout et vous contacte pour validation.</p>
                    <div className="delay-badge">Delai supplementaire : 2 a 5 jours ouvres</div>
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
                      <input type="text" value={profile.fullName} placeholder="Awa Ndiaye" onChange={(event) => updateProfile('fullName', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>WhatsApp</span>
                      <input type="tel" value={profile.phone} placeholder="+221 77 000 00 00" onChange={(event) => updateProfile('phone', event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Ville</span>
                      <input type="text" value={orderContact.deliveryCity} placeholder="Dakar" onChange={(event) => updateOrderContact('deliveryCity', event.target.value)} />
                    </label>
                    <label className="field span-full">
                      <span>Decrivez ce que vous voulez <span className="field-optional">(optionnel)</span></span>
                      <textarea
                        rows="3"
                        value={bambaDesc}
                        placeholder="Ex: carte noire avec mon logo doré, style luxe minimaliste, secteur finance..."
                        onChange={(e) => setBambaDesc(e.target.value)}
                      />
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
                      <button key={pack.key} type="button" className={`pack-row${selectedPackKey === pack.key ? ' active' : ''}${pack.discountBadge ? ' pack-row-deal' : ''}`} onClick={() => handleSelectPack(pack.key)}>
                        <div className="pack-row-info">
                          <strong>{pack.name}{pack.discountBadge && <span className="pack-discount-badge">{pack.discountBadge}</span>}</strong>
                          <small>{pack.caption}</small>
                        </div>
                        <div className="pack-row-price-wrap">
                          <span className="pack-row-price">{formatMoney(pack.price)}</span>
                        </div>
                        <span className="pack-row-check">{selectedPackKey === pack.key ? '\u2713' : ''}</span>
                      </button>
                    ))}
                  </div>

                  {/* ── Quantity + volume pricing ── */}
                  <div className="qty-section">
                    <p className="qty-label">Nombre de cartes</p>
                    <div className="qty-stepper">
                      <button type="button" className="qty-btn" onClick={() => setBambaQty((q) => Math.max(1, q - 1))} disabled={bambaQty <= 1}>−</button>
                      <span className="qty-value">{bambaQty}</span>
                      <button type="button" className="qty-btn" onClick={() => setBambaQty((q) => q + 1)}>+</button>
                    </div>
                    {(() => {
                      // Use perCardBase if defined (e.g. Business = 27000), else derive from pack price
                      const unit = packageSelection?.perCardBase ?? Math.round((packageSelection?.price ?? 0) / (packageSelection?.quantity ?? 1));
                      let disc = 0;
                      let label = '';
                      if (bambaQty >= 10) { disc = 30; label = '−30%'; }
                      else if (bambaQty >= 5) { disc = 20; label = '−20%'; }
                      else if (bambaQty >= 3) { disc = 10; label = '−10%'; }
                      const total = Math.round(unit * bambaQty * (1 - disc / 100));
                      return (
                        <div className="qty-pricing">
                          {disc > 0 && <span className="qty-discount-badge">{label} remise volume</span>}
                          <span className="qty-total">{formatMoney(total)}</span>
                          <span className="qty-unit-hint">{formatMoney(Math.round(total / bambaQty))}/carte</span>
                        </div>
                      );
                    })()}
                    {bambaQty >= 3 && bambaQty < 5 && <p className="qty-hint">Commandez 5+ cartes pour bénéficier de −20%</p>}
                    {bambaQty >= 5 && bambaQty < 10 && <p className="qty-hint">Commandez 10+ cartes pour bénéficier de −30%</p>}
                  </div>
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <span className="step-dot">3</span>
                    <h3>Votre resume de commande</h3>
                  </div>
                  <pre className="brief-preview">{bambaBrief}</pre>
                  {bambaQty > 5 ? (
                    <div className="bamba-large-order">
                      <p className="bamba-large-order-note">Pour les commandes de plus de 5 cartes, le paiement se fait à la livraison. Envoyez votre commande via WhatsApp et notre équipe vous contacte.</p>
                      <button type="button" className="whatsapp-btn" onClick={handleBambaWhatsApp}>
                        <WhatsAppIcon />
                        Commander via WhatsApp
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="whatsapp-btn" onClick={handleBambaWhatsApp}>
                      <WhatsAppIcon />
                      Envoyer via WhatsApp
                    </button>
                  )}
                </div>
              </form>
            </aside>

            <section className="preview-pane preview-pane--bamba" style={{ '--accent': activeAccent, '--preview-surface': activeTheme.surface, '--preview-highlight': activeTheme.highlight, '--preview-text': activeTheme.text, '--preview-panel': activeTheme.panel }}>
              <div className="preview-top-bar">
                <div className="preview-meta-chips">
                  <span className="meta-chip">{packageSelection.name}</span>
                  <span className="meta-chip price-chip">{formatMoney(finalPrice)}</span>
                  <span className="meta-chip">{customization.material}</span>
                </div>
              </div>
              <div className="canvas-preview-stage">
                <CardCanvas
                  profile={profile}
                  customization={customization}
                  cardLayout={cardLayout}
                  assets={assets}
                  activeTheme={activeTheme}
                  activeAccent={activeAccent}
                  finalCardUrl={finalCardUrl}
                  initials={initials}
                  activeSocials={activeSocials}
                  onEditField={() => {}}
                  onEditImage={() => {}}
                  onAdjustAsset={() => {}}
                  showEditHints={false}
                />
              </div>
            </section>
          </>
        ) : (
          <section className="preview-pane preview-pane--canvas" style={{ '--accent': activeAccent, '--preview-surface': activeTheme.surface, '--preview-highlight': activeTheme.highlight, '--preview-text': activeTheme.text, '--preview-panel': activeTheme.panel }}>
            <div className="preview-top-bar preview-top-bar--canvas">
              <div className="preview-meta-chips">
                <span className="meta-chip">{packageSelection.name}</span>
                <span className="meta-chip price-chip">{formatMoney(finalPrice)}</span>
                <span className="meta-chip">{customization.material}</span>
                <span className="meta-chip">{currentLayoutLabel}</span>
              </div>
              <div className="canvas-status-copy">
                <strong>Edition directe</strong>
                <span>Touchez la carte pour modifier vos champs, images et reseaux.</span>
              </div>
            </div>

            <div className="canvas-preview-stage canvas-preview-stage--duo">
              <CardCanvas
                profile={profile}
                customization={customization}
                cardLayout={cardLayout}
                assets={assets}
                activeTheme={activeTheme}
                activeAccent={activeAccent}
                finalCardUrl={finalCardUrl}
                initials={initials}
                activeSocials={activeSocials}
                onEditField={handleEditField}
                onEditImage={handleEditImage}
                onAdjustAsset={adjustAsset}
                showEditHints={showEditHints}
              />
              <PhysicalCardMock
                customization={customization}
                assets={assets}
                activeAccent={activeAccent}
                cardSurface={cardSurface}
                profile={profile}
              />
            </div>

            {editorMode === 'canvas' && renderToolbarPanel()}

            {editorMode === 'canvas' && editingField?.type !== 'inline' && (
              <FieldEditor
                editingField={editingField}
                profile={profile}
                customization={customization}
                assets={assets}
                onFieldChange={updateProfile}
                onCustomizationChange={updateCustomization}
                onImageFileChange={handleAssetFile}
                onImageRemoteChange={handleAssetRemote}
                onImageRemove={handleRemoveAsset}
                onAdjustAsset={adjustAsset}
                onClose={() => setEditingField(null)}
                LocationFieldComponent={LocationPicker}
              />
            )}

            {editorMode === 'canvas' && editingField?.type === 'inline' && editingField.rect && (
              <InlineEditOverlay
                editingField={editingField}
                profile={profile}
                onFieldChange={updateProfile}
                onClose={() => setEditingField(null)}
              />
            )}

            {editorMode === 'canvas' && (
              <div className="floating-toolbar" role="toolbar" aria-label="Outils du studio">
                <button type="button" className={`toolbar-btn${toolbarPanel === 'layout' ? ' active' : ''}`} onClick={() => handleOpenToolbarPanel('layout')} aria-label="Modeles et mise en page" aria-pressed={toolbarPanel === 'layout'}>
                  <span className="toolbar-btn-glyph" aria-hidden="true"><SvgGrid /></span>
                  <span>Modeles</span>
                </button>
                <button type="button" className={`toolbar-btn${toolbarPanel === 'theme' ? ' active' : ''}`} onClick={() => handleOpenToolbarPanel('theme')} aria-label="Theme et typographie" aria-pressed={toolbarPanel === 'theme'}>
                  <span className="toolbar-btn-glyph" aria-hidden="true">Aa</span>
                  <span>Theme</span>
                </button>
                <button type="button" className={`toolbar-btn${toolbarPanel === 'colors' ? ' active' : ''}`} onClick={() => handleOpenToolbarPanel('colors')} aria-label="Couleurs" aria-pressed={toolbarPanel === 'colors'}>
                  <span className="toolbar-btn-glyph" aria-hidden="true">#</span>
                  <span>Couleurs</span>
                </button>
                <button type="button" className={`toolbar-btn${toolbarPanel === 'physical' ? ' active' : ''}`} onClick={() => handleOpenToolbarPanel('physical')} aria-label="Carte physique NFC" aria-pressed={toolbarPanel === 'physical'}>
                  <span className="toolbar-btn-glyph" aria-hidden="true">NFC</span>
                  <span>Carte physique</span>
                </button>
                <button type="button" className="toolbar-btn toolbar-cta btn-press" onClick={handleEnterCheckout} aria-label={t('builder.orderNfc')}>
                  <span className="toolbar-btn-glyph" aria-hidden="true">Go</span>
                  <span>Commander</span>
                </button>
              </div>
            )}

            {editorMode === 'checkout' && (
              <CheckoutWizard
                profile={profile}
                orderContact={orderContact}
                customization={customization}
                assets={assets}
                activeTheme={activeTheme}
                activeAccent={activeAccent}
                cardLayout={cardLayout}
                finalCardUrl={finalCardUrl}
                initials={initials}
                activeSocials={activeSocials}
                selectedPackKey={selectedPackKey}
                packageSelection={packageSelection}
                inventory={inventory}
                totalPrice={totalPrice}
                discountAmount={discountAmount}
                finalPrice={finalPrice}
                wantCustomDomain={wantCustomDomain}
                customDomain={customDomain}
                normalizedCustomDomain={normalizedCustomDomain}
                domainResult={domainResult}
                domainMatchesSelection={domainMatchesSelection}
                domainSurcharge={domainSurcharge}
                domainValidationMessage={domainValidationMessage}
                isDomainSubmitBlocked={isDomainSubmitBlocked}
                couponInput={couponInput}
                couponStatus={couponStatus}
                appliedCoupon={appliedCoupon}
                submitState={submitState}
                showValidation={showValidation}
                previewQrUrl={previewQrUrl}
                savedFinalCardUrl={savedFinalCardUrl}
                savedPreviewQrUrl={savedPreviewQrUrl}
                onBack={handleExitCheckout}
                onSelectPack={handleSelectPack}
                onUpdateOrderContact={updateOrderContact}
                onUpdateCustomization={updateCustomization}
                onSetWantCustomDomain={handleToggleCustomDomain}
                onSetCustomDomain={setCustomDomain}
                onSetDomainResult={setDomainResult}
                onSetCouponInput={(value) => {
                  setCouponInput(value);
                  setCouponStatus({ state: 'idle', message: '' });
                }}
                onApplyCoupon={applyCoupon}
                onRemoveCoupon={removeCoupon}
                onValidate={handleValidate}
                onSubmit={handleSubmit}
                onCancelValidation={handleCancelValidation}
                onImageFileChange={handleAssetFile}
                onImageRemoteChange={handleAssetRemote}
                onAdjustAsset={adjustAsset}
                DomainCheckerComponent={DomainChecker}
                whatsAppUrl={whatsAppUrl}
                businessCards={businessCards}
                onUpdateBusinessCard={updateBusinessCard}
              />
            )}
          </section>
        )}
      </div>

      <VoiceAssistant isOpen={showVoice} onClose={() => setShowVoice(false)} />
    </div>
  );
}
