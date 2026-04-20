import { useEffect, useMemo, useRef } from 'react';
import { defaultAssets, getAssetDisplayUrl, profileFields, socialFields } from '../../lib/catalog';
import { SOCIAL_ICON_MAP } from './builderIcons';

const EXTRA_FIELD_META = {
  bio: {
    key: 'bio',
    label: 'Bio',
    type: 'textarea',
    placeholder: 'Parlez rapidement de vous, de votre activite ou de votre proposition de valeur.',
  },
};

const CUSTOMIZATION_FIELD_META = {
  cardLabel: {
    key: 'cardLabel',
    label: 'Label carte',
    type: 'text',
    placeholder: 'Tapal Signature',
  },
};

const IMAGE_META = {
  avatar: {
    label: 'Photo de profil',
    hint: 'Choisissez la photo visible sur votre carte digitale.',
  },
  cover: {
    label: 'Image de couverture',
    hint: 'Disponible uniquement sur les layouts qui affichent une couverture.',
  },
  logo: {
    label: "Logo de l'entreprise",
    hint: 'Ajoutez un logo optionnel sur les layouts qui le prennent en charge.',
  },
  artwork: {
    label: 'Visuel de carte physique',
    hint: 'Utilise pour le recto de la carte NFC physique.',
  },
};

function ImageAdjustments({ assetKey, asset, onAdjustAsset }) {
  if (!asset || asset.sourceType === 'none') return null;

  return (
    <div className="image-adjust-grid">
      <label className="field">
        <span>Zoom</span>
        <input
          type="range"
          min="0.6"
          max="2.4"
          step="0.01"
          value={asset.zoom}
          onChange={(event) => onAdjustAsset(assetKey, 'zoom', Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>Horizontal</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={asset.positionX}
          onChange={(event) => onAdjustAsset(assetKey, 'positionX', Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>Vertical</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={asset.positionY}
          onChange={(event) => onAdjustAsset(assetKey, 'positionY', Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>Opacite</span>
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.01"
          value={asset.opacity}
          onChange={(event) => onAdjustAsset(assetKey, 'opacity', Number(event.target.value))}
        />
      </label>
      {assetKey === 'artwork' && (
        <label className="field span-full">
          <span>Rotation</span>
          <input
            type="range"
            min="-35"
            max="35"
            step="1"
            value={asset.rotation}
            onChange={(event) => onAdjustAsset(assetKey, 'rotation', Number(event.target.value))}
          />
        </label>
      )}
    </div>
  );
}

export function FieldEditor({
  editingField,
  profile,
  customization,
  assets,
  onFieldChange,
  onCustomizationChange,
  onImageFileChange,
  onImageRemoteChange,
  onImageRemove,
  onAdjustAsset,
  onClose,
  LocationFieldComponent,
}) {
  const inputRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!editingField) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingField, onClose]);

  useEffect(() => {
    if (!editingField) return;
    inputRef.current?.focus();
  }, [editingField]);

  useEffect(() => {
    if (!editingField) return undefined;
    const root = sheetRef.current;
    if (!root) return undefined;

    const selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusables = () => Array.from(root.querySelectorAll(selector))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const list = getFocusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [editingField]);

  const fieldMeta = useMemo(() => {
    if (!editingField || editingField.type !== 'field') return null;
    return profileFields.find((field) => field.key === editingField.key)
      || EXTRA_FIELD_META[editingField.key]
      || CUSTOMIZATION_FIELD_META[editingField.key]
      || null;
  }, [editingField]);

  const isCustomizationField = Boolean(editingField?.type === 'field' && CUSTOMIZATION_FIELD_META[editingField.key]);
  const fieldValue = editingField?.type === 'field'
    ? (isCustomizationField ? customization?.[editingField.key] || '' : profile[editingField.key] || '')
    : '';

  function handleTextChange(value) {
    if (isCustomizationField) {
      onCustomizationChange?.(editingField.key, value);
      return;
    }
    onFieldChange(editingField.key, value);
  }

  if (!editingField) return null;

  const imageMeta = editingField.type === 'image' ? IMAGE_META[editingField.key] : null;
  const imageAsset = editingField.type === 'image'
    ? assets[editingField.key] || defaultAssets[editingField.key]
    : null;
  const imageUrl = imageAsset ? getAssetDisplayUrl(imageAsset) : '';

  return (
    <div className="field-editor-shell" onClick={onClose}>
      <div ref={sheetRef} className="field-editor-sheet field-editor-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="field-editor-title">
        <div className="field-editor-head">
          <div>
            <p className="field-editor-kicker">Edition</p>
            <h3 id="field-editor-title">
              {editingField.type === 'socials'
                ? 'Reseaux sociaux'
                : imageMeta?.label || fieldMeta?.label || 'Champ'}
            </h3>
          </div>
          <button type="button" className="field-editor-close" onClick={onClose} aria-label="Fermer l'editeur">
            Fermer
          </button>
        </div>

        {editingField.type === 'field' && fieldMeta && (
          <div className="field-editor-body">
            <p className="field-editor-help">Les changements s'appliquent en direct sur la carte.</p>
            {editingField.key === 'location' && LocationFieldComponent ? (
              <LocationFieldComponent
                value={profile.location || ''}
                onChange={(value) => onFieldChange('location', value)}
              />
            ) : fieldMeta.type === 'textarea' ? (
              <label className="field span-full">
                <span>{fieldMeta.label}</span>
                <textarea
                  ref={inputRef}
                  rows="4"
                  value={fieldValue}
                  placeholder={fieldMeta.placeholder}
                  onChange={(event) => handleTextChange(event.target.value)}
                />
              </label>
            ) : (
              <label className="field span-full">
                <span>{fieldMeta.label}</span>
                <input
                  ref={inputRef}
                  type={fieldMeta.type}
                  value={fieldValue}
                  placeholder={fieldMeta.placeholder || fieldMeta.label}
                  onChange={(event) => handleTextChange(event.target.value)}
                />
              </label>
            )}
          </div>
        )}

        {editingField.type === 'socials' && (
          <div className="field-editor-body">
            <p className="field-editor-help">Ajoutez uniquement les reseaux que vous voulez afficher sur la carte.</p>
            <div className="social-editor-list">
              {socialFields.map((field) => {
                const Icon = SOCIAL_ICON_MAP[field.key];
                return (
                  <label className="field social-editor-row" key={field.key}>
                    <span className="social-editor-label">
                      <span className="social-editor-icon">{Icon ? <Icon /> : null}</span>
                      {field.label}
                    </span>
                    <input
                      type="url"
                      value={profile[field.key] || ''}
                      placeholder={field.placeholder}
                      onChange={(event) => onFieldChange(field.key, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {editingField.type === 'image' && imageMeta && imageAsset && (
          <div className="field-editor-body">
            <p className="field-editor-help">{imageMeta.hint}</p>
            <div className="image-editor-preview">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={imageMeta.label}
                  style={{
                    transform: `scale(${imageAsset.zoom ?? 1}) rotate(${imageAsset.rotation ?? 0}deg)`,
                    objectPosition: `${imageAsset.positionX ?? 50}% ${imageAsset.positionY ?? 50}%`,
                    opacity: imageAsset.opacity ?? 1,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div className="image-editor-placeholder">Aucune image</div>
              )}
            </div>
            <label className="field span-full upload-field">
              <span>Depuis l'appareil</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => onImageFileChange(editingField.key, event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field span-full">
              <span>Lien image (URL)</span>
              <input
                type="url"
                value={imageAsset.remoteUrl || ''}
                placeholder="https://example.com/image.jpg"
                onChange={(event) => onImageRemoteChange(editingField.key, event.target.value)}
              />
            </label>
            <ImageAdjustments assetKey={editingField.key} asset={imageAsset} onAdjustAsset={onAdjustAsset} />
            <button type="button" className="ghost-btn field-editor-remove" onClick={() => onImageRemove(editingField.key)}>
              Supprimer l'image
            </button>
          </div>
        )}

        <div className="field-editor-actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Termine
          </button>
        </div>
      </div>
    </div>
  );
}