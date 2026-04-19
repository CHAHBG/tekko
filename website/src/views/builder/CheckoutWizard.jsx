import { useEffect, useMemo, useState } from 'react';
import {
  foilCatalog,
  formatMoney,
  getAssetDisplayUrl,
  materialCatalog,
  orderContactFields,
  packCatalog,
} from '../../lib/catalog';
import { CardCanvas } from './CardCanvas';

export function PhysicalCardMock({ customization, assets, activeAccent, cardSurface, profile }) {
  const [flipped, setFlipped] = useState(false);
  const [pulse, setPulse] = useState(false);

  const artworkUrl = getAssetDisplayUrl(assets.artwork);
  const artwork = assets.artwork;
  const hasArtwork = !!(artworkUrl && artwork.sourceType !== 'none');
  const foilValue = foilCatalog[customization.foil];
  const hasFoil = customization.foil !== 'No foil' && !!foilValue;
  const foilGradient = hasFoil
    ? `linear-gradient(135deg, ${foilValue} 0%, ${foilValue}88 25%, #fff 50%, ${foilValue}88 75%, ${foilValue} 100%)`
    : undefined;
  const logoUrl = getAssetDisplayUrl(assets.logo);
  const hasLogo = !!(logoUrl && assets.logo?.sourceType !== 'none' && customization.includeLogo);
  const hasName = !!(profile.fullName);
  const hasRole = !!(profile.role);
  const hasQr = !!(customization.includeQr);
  const hasBackMsg = !!(customization.backsideMessage?.trim());

  const positionMap = {
    'top-left': { top: '8%', left: '7%' },
    'top-right': { top: '8%', right: '7%' },
    'bottom-left': { bottom: '12%', left: '7%' },
    'bottom-right': { bottom: '12%', right: '7%' },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  };
  const sizeMap = { small: '18%', medium: '25%', large: '34%' };
  const qrSizeMap = { small: '24%', medium: '32%', large: '42%' };

  const logoPos = positionMap[customization.logoPosition] || positionMap['bottom-right'];
  const logoMaxH = sizeMap[customization.logoSize] || sizeMap['medium'];
  const qrPos = positionMap[customization.qrPosition] || positionMap['center'];
  const qrSz = qrSizeMap[customization.qrSize] || qrSizeMap['medium'];

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(t);
  }, [
    customization.material,
    customization.foil,
    customization.finish,
    customization.includeQr,
    customization.includeLogo,
    customization.logoPosition,
    customization.logoSize,
    customization.qrPosition,
    customization.qrSize,
    customization.backsideMessage,
    assets.artwork?.sourceType,
    assets.logo?.sourceType,
  ]);

  return (
    <div className="physical-card-stage">
      <div
        className={`flip-container pcard-flip${flipped ? ' flipped' : ''}${pulse ? ' pcard-pulse' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        title="Cliquer pour retourner"
      >
        <div className="flip-inner">
          {/* ── RECTO ───────────────────────── */}
          <div className="flip-front">
            <div className="pcard pcard--front" style={cardSurface}>
              {hasArtwork && (
                <img
                  className="pcard-artwork"
                  src={artworkUrl}
                  alt="artwork"
                  style={{
                    transform: `scale(${artwork.zoom ?? 1}) rotate(${artwork.rotation ?? 0}deg)`,
                    objectPosition: `${artwork.positionX ?? 50}% ${artwork.positionY ?? 50}%`,
                    opacity: artwork.opacity ?? 1,
                  }}
                />
              )}
              {hasFoil && <div className="pcard-foil" style={{ '--foil-bg': foilGradient }} />}
              {/* NFC chip — always present (hardware feature) */}
              <div className="pcard-chip" />
              {hasLogo && (
                <img
                  className="pcard-logo"
                  src={logoUrl}
                  alt="logo"
                  style={{ ...logoPos, maxHeight: logoMaxH, maxWidth: logoMaxH, position: 'absolute' }}
                />
              )}
              {(hasName || hasRole) && (
                <div className="pcard-identity">
                  {hasName && <span className="pcard-name" style={{ color: `var(--card-ink, #111)` }}>{profile.fullName}</span>}
                  {hasRole && <span className="pcard-role" style={{ color: `var(--card-ink, #111)` }}>{profile.role}</span>}
                </div>
              )}
            </div>
          </div>
          {/* ── VERSO ───────────────────────── */}
          <div className="flip-back">
            <div className="pcard pcard--back" style={cardSurface}>
              {hasQr && (
                <div
                  className="pcard-qr-placeholder"
                  style={{ ...qrPos, width: qrSz, position: 'absolute' }}
                />
              )}
              {hasBackMsg && <p className="pcard-back-msg">{customization.backsideMessage}</p>}
              <p className="pcard-back-url">tapal.geochifa.com</p>
            </div>
          </div>
        </div>
      </div>
      <p className="flip-hint">Cliquer pour retourner</p>
    </div>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}>
      <path d="M2 12c1.5-3 4-5 6-5s3.5 2 5.5 2 4-2 6-2c1 0 1.8.4 2.5 1M2 17c1.5-3 4-5 6-5s3.5 2 5.5 2 4-2 6-2c1 0 1.8.4 2.5 1" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.85L.073 23.928a.5.5 0 00.611.611l6.181-1.462A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.032-1.384l-.36-.214-3.732.882.897-3.63-.236-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z" />
    </svg>
  );
}

function ArtworkField({ asset, onImageFileChange, onImageRemoteChange, onAdjustAsset }) {
  const hasImage = asset.sourceType !== 'none';

  return (
    <div className="asset-block">
      <p className="asset-title">Visuel recto</p>
      <div className="asset-source-grid">
        <label className="field span-full upload-field">
          <span>Image depuis l'appareil</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onImageFileChange('artwork', event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="field span-full">
          <span>Ou lien image (URL)</span>
          <input
            type="url"
            value={asset.remoteUrl}
            placeholder="https://example.com/artwork.jpg"
            onChange={(event) => onImageRemoteChange('artwork', event.target.value)}
          />
        </label>
      </div>
      {hasImage && (
        <div className="adjuster-grid">
          <label className="field">
            <span>Zoom</span>
            <input type="range" min="0.6" max="2.4" step="0.01" value={asset.zoom} onChange={(event) => onAdjustAsset('artwork', 'zoom', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Horizontal</span>
            <input type="range" min="0" max="100" step="1" value={asset.positionX} onChange={(event) => onAdjustAsset('artwork', 'positionX', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Vertical</span>
            <input type="range" min="0" max="100" step="1" value={asset.positionY} onChange={(event) => onAdjustAsset('artwork', 'positionY', Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Rotation</span>
            <input type="range" min="-35" max="35" step="1" value={asset.rotation} onChange={(event) => onAdjustAsset('artwork', 'rotation', Number(event.target.value))} />
          </label>
        </div>
      )}
    </div>
  );
}

const WIZARD_STEPS = [
  { key: 'physical', label: 'Carte' },
  { key: 'delivery', label: 'Livraison' },
  { key: 'summary', label: 'Resume' },
  { key: 'payment', label: 'Paiement' },
];

export function CheckoutWizard({
  profile,
  orderContact,
  customization,
  assets,
  activeTheme,
  activeAccent,
  cardLayout,
  finalCardUrl,
  initials,
  activeSocials,
  selectedPackKey,
  packageSelection,
  inventory,
  totalPrice,
  discountAmount,
  finalPrice,
  wantCustomDomain,
  customDomain,
  normalizedCustomDomain,
  domainResult,
  domainMatchesSelection,
  domainSurcharge,
  domainValidationMessage,
  isDomainSubmitBlocked,
  couponInput,
  couponStatus,
  appliedCoupon,
  submitState,
  showValidation,
  previewQrUrl,
  savedFinalCardUrl,
  savedPreviewQrUrl,
  onBack,
  onSelectPack,
  onUpdateOrderContact,
  onUpdateCustomization,
  onSetWantCustomDomain,
  onSetCustomDomain,
  onSetDomainResult,
  onSetCouponInput,
  onApplyCoupon,
  onRemoveCoupon,
  onValidate,
  onSubmit,
  onCancelValidation,
  onImageFileChange,
  onImageRemoteChange,
  onAdjustAsset,
  DomainCheckerComponent,
  whatsAppUrl,
  businessCards,
  onUpdateBusinessCard,
}) {
  const [stepIndex, setStepIndex] = useState(0);

  const cardSurface = useMemo(() => ({
    '--card-base': materialCatalog[customization.material].base,
    '--card-edge': materialCatalog[customization.material].edge,
    '--card-ink': materialCatalog[customization.material].ink,
    '--card-accent': activeAccent,
    '--card-foil': customization.foil !== 'No foil' ? foilCatalog[customization.foil] : null,
  }), [activeAccent, customization.foil, customization.material]);

  const currentStep = WIZARD_STEPS[stepIndex].key;
  const canGoBackStep = stepIndex > 0;
  const canGoNextStep = stepIndex < WIZARD_STEPS.length - 1;

  function nextStep() {
    setStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function previousStep() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  const deliveryLocation = `${orderContact.deliveryCity || ''} ${orderContact.deliveryAddress || ''} ${profile.location || ''}`.toLowerCase();
  const localDelivery = ['senegal', 'sénégal', 'dakar', 'thies', 'thiès', 'saint-louis', 'ziguinchor', 'mbour', 'kaolack', 'louga', 'rufisque', 'pikine', 'guediawaye', 'guédiawaye']
    .some((term) => deliveryLocation.includes(term));

  return (
    <div className="checkout-wizard">
      <div className="checkout-wizard-shell">

        {/* ── LEFT — scrollable form ──────────────────────── */}
        <div className="checkout-form-pane">
          <div className="checkout-wizard-header">
            <button type="button" className="checkout-back-btn" onClick={onBack}>
              Retour a l'editeur
            </button>
            <div>
              <p className="checkout-kicker">Commande</p>
              <h2>Finaliser votre carte</h2>
            </div>
          </div>

          <div className="wizard-stepper">
            {WIZARD_STEPS.map((step, index) => (
              <button
                key={step.key}
                type="button"
                className={`wizard-step-chip${index === stepIndex ? ' active' : ''}`}
                onClick={() => setStepIndex(index)}
              >
                <span>{index + 1}</span>
                {step.label}
              </button>
            ))}
          </div>

          <div className="wizard-step">
          {currentStep === 'physical' && (
            <div className="form-card wizard-step-card">
              <div className="form-card-header">
                <span className="step-dot">1</span>
                <h3>Carte physique</h3>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Materiau</span>
                  <select value={customization.material} onChange={(event) => onUpdateCustomization('material', event.target.value)}>
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
                  <select value={customization.finish} onChange={(event) => onUpdateCustomization('finish', event.target.value)}>
                    <option>Matte</option>
                    <option>Soft matte</option>
                    <option>Satin</option>
                    <option>Gloss</option>
                  </select>
                </label>
                <label className="field">
                  <span>Dorure</span>
                  <select value={customization.foil} onChange={(event) => onUpdateCustomization('foil', event.target.value)}>
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
                <label className="field span-full">
                  <span>Message au verso</span>
                  <input type="text" value={customization.backsideMessage} onChange={(event) => onUpdateCustomization('backsideMessage', event.target.value)} />
                </label>
              </div>
              <div className="toggle-row">
                <label className="toggle-pill">
                  <input type="checkbox" checked={customization.includeQr} onChange={(event) => onUpdateCustomization('includeQr', event.target.checked)} />
                  <span>QR code au verso</span>
                </label>
                <label className="toggle-pill">
                  <input type="checkbox" checked={customization.includeLogo} onChange={(event) => onUpdateCustomization('includeLogo', event.target.checked)} />
                  <span>Logo au recto</span>
                </label>
              </div>
              <ArtworkField asset={assets.artwork} onImageFileChange={onImageFileChange} onImageRemoteChange={onImageRemoteChange} onAdjustAsset={onAdjustAsset} />
            </div>
          )}

          {currentStep === 'delivery' && (
            <div className="form-card wizard-step-card">
              <div className="form-card-header">
                <span className="step-dot">2</span>
                <h3>Livraison</h3>
              </div>
              <div className="form-grid">
                {orderContactFields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    <input type={field.type} value={orderContact[field.key]} onChange={(event) => onUpdateOrderContact(field.key, event.target.value)} />
                  </label>
                ))}
                <label className="field span-full">
                  <span>Instructions de livraison</span>
                  <textarea rows="2" value={orderContact.deliveryNotes} onChange={(event) => onUpdateOrderContact('deliveryNotes', event.target.value)} />
                </label>
              </div>
              {deliveryLocation.trim() && (
                <div className={`delivery-estimate${localDelivery ? ' delivery-estimate-local' : ' delivery-estimate-intl'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {localDelivery
                    ? 'Livraison estimee au Senegal : 2 a 5 jours ouvres'
                    : 'Livraison hors Senegal : 1 semaine a 1 mois selon la destination'}
                </div>
              )}
            </div>
          )}

          {currentStep === 'summary' && (
            <div className="form-card wizard-step-card">
              <div className="form-card-header">
                <span className="step-dot">3</span>
                <h3>Resume</h3>
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
                <div className="receipt-row"><span>Materiau</span><strong>{customization.material}</strong></div>
                <div className="receipt-row"><span>Finition</span><strong>{customization.finish}</strong></div>
                <div className="receipt-row"><span>Dorure</span><strong>{customization.foil}</strong></div>
                {customization.includeQr && <div className="receipt-row"><span>QR code</span><strong>Oui</strong></div>}
                {customization.includeLogo && <div className="receipt-row"><span>Logo</span><strong>Oui</strong></div>}
                {wantCustomDomain && normalizedCustomDomain && (
                  <div className="receipt-row"><span>Domaine</span><strong>{normalizedCustomDomain}</strong></div>
                )}
                <div className="receipt-row receipt-total"><span>Total</span><strong>{formatMoney(finalPrice)}</strong></div>
                <div className="receipt-tear" />
              </div>
            </div>
          )}

          {currentStep === 'payment' && (
            <div className="form-card wizard-step-card">
              <div className="form-card-header">
                <span className="step-dot">4</span>
                <h3>Paiement</h3>
              </div>
              <div className="pack-list">
                {Object.values(packCatalog).map((pack) => (
                  <button key={pack.key} type="button" className={`pack-row${selectedPackKey === pack.key ? ' active' : ''}${pack.discountBadge ? ' pack-row-deal' : ''}`} onClick={() => onSelectPack(pack.key)}>
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

              {/* Business pack — enter info for each of the 5 cards */}
              {selectedPackKey === 'business' && businessCards && (
                <div className="business-cards-section">
                  <p className="field-label-sm" style={{ marginTop: '0.85rem' }}>Informations pour chaque carte (5 cartes)</p>
                  <p className="toolbar-note" style={{ marginBottom: '0.5rem' }}>La carte 1 utilise le profil principal. Remplissez les cartes 2 a 5 pour vos collaborateurs.</p>
                  <div className="business-cards-grid">
                    {businessCards.map((card, index) => (
                      <details key={index} className="business-card-item" open={index === 0}>
                        <summary className="business-card-summary">
                          <span className="business-card-num">{index + 1}</span>
                          <span>{index === 0 ? (profile.fullName || 'Carte principale') : (card.fullName || `Carte ${index + 1}`)}</span>
                        </summary>
                        {index === 0 ? (
                          <p className="toolbar-note" style={{ padding: '0.5rem 0.75rem' }}>Utilise le profil principal ({profile.fullName || '—'})</p>
                        ) : (
                          <div className="form-grid" style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                            <label className="field">
                              <span>Nom complet</span>
                              <input type="text" value={card.fullName} placeholder="Nom complet" onChange={(e) => onUpdateBusinessCard(index, 'fullName', e.target.value)} />
                            </label>
                            <label className="field">
                              <span>Poste / Role</span>
                              <input type="text" value={card.role} placeholder="Ex: Directeur Commercial" onChange={(e) => onUpdateBusinessCard(index, 'role', e.target.value)} />
                            </label>
                            <label className="field">
                              <span>Email</span>
                              <input type="email" value={card.email} placeholder="email@exemple.com" onChange={(e) => onUpdateBusinessCard(index, 'email', e.target.value)} />
                            </label>
                            <label className="field">
                              <span>Telephone</span>
                              <input type="tel" value={card.phone} placeholder="+221 77 ..." onChange={(e) => onUpdateBusinessCard(index, 'phone', e.target.value)} />
                            </label>
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {selectedPackKey !== 'starter' && (
                <div className="domain-option-section">
                  <label className="toggle-pill">
                    <input
                      type="checkbox"
                      checked={wantCustomDomain}
                      onChange={(event) => onSetWantCustomDomain(event.target.checked)}
                    />
                    <span>Je veux un nom de domaine personnalise</span>
                  </label>
                  {wantCustomDomain && DomainCheckerComponent && (
                    <div className="domain-checker-wrap">
                      <p className="domain-note">Entrez le domaine souhaite. TEKKO couvre jusqu'a 6 000 FCFA/an. Au-dela, la difference est a votre charge.</p>
                      <DomainCheckerComponent value={customDomain} onChange={onSetCustomDomain} onResult={onSetDomainResult} />
                      {domainValidationMessage && (
                        <div className="domain-help domain-help-warn">{domainValidationMessage}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="price-table" style={{ marginTop: '0.85rem' }}>
                <div className="price-row"><span>Pack {packageSelection.name}</span><strong>{formatMoney(packageSelection.price)}</strong></div>
                {customization.material === 'Brushed metal' && <div className="price-row"><span>+ Metal brosse</span><strong>{formatMoney(20000)}</strong></div>}
                {customization.foil !== 'No foil' && <div className="price-row"><span>+ Dorure {customization.foil.replace(' foil', '')}</span><strong>{formatMoney(5000)}</strong></div>}
                {discountAmount > 0 && (
                  <div className="price-row price-row-discount">
                    <span>Coupon {appliedCoupon.code}</span>
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

              <div className="coupon-row">
                {!appliedCoupon ? (
                  <>
                    <input
                      className="coupon-input"
                      type="text"
                      placeholder="Code promo"
                      value={couponInput}
                      onChange={(event) => onSetCouponInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => event.key === 'Enter' && onApplyCoupon()}
                      disabled={couponStatus.state === 'loading'}
                    />
                    <button type="button" className="coupon-apply-btn" onClick={onApplyCoupon} disabled={couponStatus.state === 'loading' || !couponInput.trim()}>
                      {couponStatus.state === 'loading' ? '...' : 'Appliquer'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="coupon-remove-btn" onClick={onRemoveCoupon}>
                    Retirer le coupon {appliedCoupon.code}
                  </button>
                )}
                {couponStatus.message && <span className={`coupon-msg coupon-msg-${couponStatus.state}`}>{couponStatus.message}</span>}
              </div>

              {(submitState.status === 'idle' || submitState.status === 'error') && !showValidation && (
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
                    <button type="button" className="wave-pay-btn" onClick={onValidate} disabled={isDomainSubmitBlocked}>
                      Valider ma commande
                    </button>
                  </div>
                </>
              )}

              {showValidation && (
                <div className="validation-receipt">
                  <div className="validation-header">
                    <span className="validation-brand">TEKKO</span>
                    <span className="validation-subtitle">Recapitulatif de commande</span>
                  </div>
                  <div className="receipt-divider" />
                  <div className="receipt-row"><span>Pack</span><strong>{packageSelection.name}</strong></div>
                  <div className="receipt-row"><span>Carte</span><strong>{profile.fullName}</strong></div>
                  {customization.material !== 'Pearl white' && <div className="receipt-row"><span>Materiau</span><strong>{customization.material}</strong></div>}
                  {discountAmount > 0 && <div className="receipt-row"><span>Coupon {appliedCoupon.code}</span><strong>-{formatMoney(discountAmount)}</strong></div>}
                  {wantCustomDomain && domainResult?.available && <div className="receipt-row"><span>Domaine</span><strong>{normalizedCustomDomain}</strong></div>}
                  <div className="receipt-row receipt-total"><span>Total a payer</span><strong>{formatMoney(finalPrice)}</strong></div>
                  <div className="receipt-divider" />
                  <div className="validation-preview">
                    <p className="validation-hint">Scannez ou cliquez pour previsualiser :</p>
                    <div className="validation-qr-wrap">
                      {(savedPreviewQrUrl || previewQrUrl) && <img src={savedPreviewQrUrl || previewQrUrl} alt="QR previsualisation" className="validation-qr" />}
                    </div>
                    <a className="validation-card-link" href={savedFinalCardUrl || finalCardUrl} target="_blank" rel="noreferrer">
                      {(savedFinalCardUrl || finalCardUrl).replace(/^https?:\/\//, '')}
                    </a>
                    <p className="validation-note">Ce lien deviendra permanent apres paiement. Il vous sera aussi envoye par email.</p>
                  </div>
                  <div className="receipt-divider" />
                  <div className="validation-actions">
                    <button type="button" className="validation-back-btn" onClick={onCancelValidation}>
                      Modifier
                    </button>
                    <button type="button" className="wave-pay-btn" onClick={onSubmit}>
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
                    <span className="receipt-subtitle">Commande enregistree</span>
                  </div>
                  <div className="receipt-divider" />
                  <div className="receipt-row"><span>Commande</span><strong>{submitState.order.orderId?.slice(0, 8).toUpperCase()}</strong></div>
                  <div className="receipt-row"><span>Montant</span><strong>{formatMoney(finalPrice)}</strong></div>
                  <div className="receipt-row"><span>Statut</span><strong>{submitState.status === 'checkout-ready' ? 'En attente de paiement' : 'Enregistree'}</strong></div>
                  <div className="receipt-divider" />
                  {submitState.paymentUrl && (
                    <a className="wave-pay-btn full-width" href={submitState.paymentUrl} target="_blank" rel="noreferrer">
                      <WaveIcon />
                      Ouvrir Wave pour payer
                    </a>
                  )}
                  <p className="receipt-email-note">Apres confirmation du paiement, vous recevrez par email le lien de votre carte digitale ainsi que le recu PDF telechargeable.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="wizard-actions">
          <button type="button" className="ghost-btn" onClick={canGoBackStep ? previousStep : onBack}>
            {canGoBackStep ? 'Etape precedente' : 'Retour a l editeur'}
          </button>
          {canGoNextStep && (
            <button type="button" className="primary-btn" onClick={nextStep}>
              Continuer
            </button>
          )}
        </div>
        </div>{/* end checkout-form-pane */}

        {/* ── RIGHT — sticky preview panel ───────────────────── */}
        <div className="checkout-preview-pane">
          <p className="preview-pane-label">Apercu</p>
          <div className="checkout-preview-duo">
            {/* Digital card — bare render, no phone chrome */}
            <div className="checkout-card-bare">
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
                noPhone={true}
              />
            </div>
            {/* Physical card — right of phone */}
            <PhysicalCardMock
              customization={customization}
              assets={assets}
              activeAccent={activeAccent}
              cardSurface={cardSurface}
              profile={profile}
            />
          </div>
        </div>

      </div>
    </div>
  );
}