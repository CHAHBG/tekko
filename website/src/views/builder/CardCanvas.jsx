import { useCallback, useRef } from 'react';
import { getAssetDisplayUrl } from '../../lib/catalog';
import {
  SvgEmail,
  SvgLocation,
  SvgPhone,
  SvgSave,
  SvgShare,
  SvgWeb,
} from './builderIcons';

const fontStyleMap = {
  moderne: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  elegant: "Georgia, 'Times New Roman', serif",
  technique: "'Courier New', Courier, monospace",
  arrondi: "'Trebuchet MS', 'Comic Sans MS', Nunito, Arial, sans-serif",
  roboto: "'Roboto', sans-serif",
  sf: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
  segoe: "'Segoe UI', Calibri, Arial, sans-serif",
};

function useGestureAttach(assetKey, assetsRef, adjustRef) {
  const stateRef = useRef({ drag: null, cleanup: null, preventClick: false });

  return useCallback((element) => {
    stateRef.current.cleanup?.();
    stateRef.current.cleanup = null;
    if (!element) return;

    const state = stateRef.current;
    const getAsset = () => (assetsRef.current ?? {})[assetKey] ?? {};
    const adjust = (field, value) => adjustRef.current?.(assetKey, field, value);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const wheel = (event) => {
      event.preventDefault();
      adjust('zoom', clamp((getAsset().zoom ?? 1) - event.deltaY * 0.004, 0.6, 2.4));
    };

    const handleClick = (event) => {
      if (!state.preventClick) return;
      state.preventClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseDown = (event) => {
      if (event.button !== 0) return;
      const asset = getAsset();
      const rect = element.getBoundingClientRect();
      state.preventClick = false;
      state.drag = {
        x: event.clientX,
        y: event.clientY,
        px: asset.positionX ?? 50,
        py: asset.positionY ?? 50,
        width: rect.width,
        height: rect.height,
      };
      element.classList.add('gesture--active');
    };

    const handleMouseMove = (event) => {
      if (!state.drag) return;
      const drag = state.drag;
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        state.preventClick = true;
      }
      adjust('positionX', clamp(drag.px + (deltaX * 100) / drag.width, 0, 100));
      adjust('positionY', clamp(drag.py + (deltaY * 100) / drag.height, 0, 100));
    };

    const handleMouseUp = () => {
      state.drag = null;
      element.classList.remove('gesture--active');
    };

    const handleTouchStart = (event) => {
      const touches = event.touches;
      state.preventClick = false;
      if (touches.length !== 1) {
        state.drag = null;
        return;
      }

      const asset = getAsset();
      const rect = element.getBoundingClientRect();
      state.drag = {
        x: touches[0].clientX,
        y: touches[0].clientY,
        px: asset.positionX ?? 50,
        py: asset.positionY ?? 50,
        width: rect.width,
        height: rect.height,
      };
    };

    const handleTouchMove = (event) => {
      const touches = event.touches;
      if (touches.length !== 1 || !state.drag) {
        return;
      }

      event.preventDefault();
      const drag = state.drag;
      const deltaX = touches[0].clientX - drag.x;
      const deltaY = touches[0].clientY - drag.y;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        state.preventClick = true;
      }
      adjust('positionX', clamp(drag.px + (deltaX * 100) / drag.width, 0, 100));
      adjust('positionY', clamp(drag.py + (deltaY * 100) / drag.height, 0, 100));
    };

    const handleTouchEnd = () => {
      state.drag = null;
      element.classList.remove('gesture--active');
    };

    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('click', handleClick, true);
    element.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    state.cleanup = () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('click', handleClick, true);
      element.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.classList.remove('gesture--active');
    };
  }, []);
}

function editableClass(showEditHints, extraClassName = '') {
  return `${extraClassName}${extraClassName ? ' ' : ''}editable-zone${showEditHints ? ' pulse-hint' : ''}`;
}

function stopClick(event) {
  event.stopPropagation();
}

function renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints, extraStyle) {
  if (activeSocials.length === 0) {
    return (
      <div
        className={editableClass(showEditHints, 'dl-social-row dl-social-row-empty')}
        style={extraStyle}
        onClick={(event) => onEditField('socials', event.currentTarget)}
        title="Ajouter des réseaux sociaux"
      >
        <span className="dl-social-empty-hint">+ Réseaux sociaux</span>
      </div>
    );
  }

  return (
    <div
      className={editableClass(showEditHints, 'dl-social-row')}
      style={extraStyle}
      onClick={(event) => onEditField('socials', event.currentTarget)}
    >
      {activeSocials.map((social) => (
        <button
          key={social.key}
          type="button"
          className="dl-social-btn"
          title={social.label}
          style={{ color: activeAccent }}
          onClick={(event) => {
            event.stopPropagation();
            onEditField('socials');
          }}
        >
          <social.Icon />
        </button>
      ))}
    </div>
  );
}

export function CardCanvas({
  profile,
  customization,
  cardLayout,
  assets,
  activeTheme,
  activeAccent,
  finalCardUrl,
  initials,
  activeSocials,
  onEditField,
  onEditImage,
  onAdjustAsset,
  showEditHints,
  noPhone = false,
}) {
  const avatarUrl = getAssetDisplayUrl(assets.avatar);
  const coverUrl = getAssetDisplayUrl(assets.cover);
  const logoUrl = getAssetDisplayUrl(assets.logo);
  const activeLayout = cardLayout;
  const phoneVars = {
    '--accent': activeAccent,
    '--preview-surface': customization.bgColor || activeTheme.surface,
    '--preview-highlight': activeTheme.highlight,
    '--preview-text': customization.textColor || activeTheme.text,
    '--preview-panel': activeTheme.panel,
    '--preview-font': fontStyleMap[customization.fontStyle] || fontStyleMap.moderne,
  };

  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const adjustAssetRef = useRef(onAdjustAsset);
  adjustAssetRef.current = onAdjustAsset;
  const avatarGestureRef = useGestureAttach('avatar', assetsRef, adjustAssetRef);
  const coverGestureRef = useGestureAttach('cover', assetsRef, adjustAssetRef);

  const phoneScreen = (
    <div className={`phone-screen dl-${activeLayout}`} style={phoneVars}>
          {activeLayout === 'classic' && (
            <>
              <div className="dl-hero">
                <span className="phone-badge">{customization.cardLabel || 'Carte de visite'}</span>
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
                <div
                  className={editableClass(showEditHints, 'dl-hero-photo photo-frame gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={() => onEditImage('avatar')}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom}) rotate(${assets.avatar.rotation}deg)`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span className="dl-hero-initials">{initials || '+'}</span>
                  )}
                </div>
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
              </div>
              <div className="action-row">
                <button type="button" onClick={stopClick}>Save contact</button>
                <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
              </div>
              <div className="info-panels">
                <article className={editableClass(showEditHints)} onClick={(event) => onEditField('phone', event.currentTarget)}>
                  <span className="dl-icon"><SvgPhone /></span>
                  <strong>{profile.phone || 'Votre telephone'}</strong>
                </article>
                <article className={editableClass(showEditHints)} onClick={(event) => onEditField('email', event.currentTarget)}>
                  <span className="dl-icon"><SvgEmail /></span>
                  <strong>{profile.email || 'Votre email'}</strong>
                </article>
                <article className={editableClass(showEditHints)} onClick={(event) => onEditField('website', event.currentTarget)}>
                  <span className="dl-icon"><SvgWeb /></span>
                  <strong>{profile.website || 'Votre site'}</strong>
                </article>
                <article className={editableClass(showEditHints)} onClick={(event) => onEditField('location', event.currentTarget)}>
                  <span className="dl-icon"><SvgLocation /></span>
                  <strong>{profile.location || 'Votre adresse'}</strong>
                </article>
              </div>
              {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
            </>
          )}

          {activeLayout === 'banner' && (
            <>
              <div
                className={editableClass(showEditHints, 'dl-cover')}
                ref={coverUrl ? coverGestureRef : null}
                title="Glisser pour repositionner"
                onClick={() => onEditImage('cover')}
              >
                {coverUrl ? (
                  <img
                    className="dl-cover-img"
                    src={coverUrl}
                    alt="cover"
                    style={{
                      objectPosition: `${assets.cover.positionX}% ${assets.cover.positionY}%`,
                      transform: `scale(${assets.cover.zoom})`,
                      opacity: assets.cover.opacity,
                    }}
                  />
                ) : (
                  <div className="dl-cover-bg" style={{ background: `linear-gradient(135deg, ${activeAccent} 0%, ${activeTheme.highlight || activeAccent}88 100%)` }} />
                )}
                <div className="dl-cover-overlay" />
                <span className="phone-badge dl-cover-badge">{customization.cardLabel || 'Carte de visite'}</span>
                <div
                  className={editableClass(showEditHints, 'dl-cover-avatar photo-frame gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditImage('avatar');
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span>{initials || '+'}</span>
                  )}
                </div>
              </div>
              <div className="dl-body">
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
                <div className="action-row">
                  <button type="button" onClick={stopClick}>Save contact</button>
                  <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
                </div>
                <div className="info-panels">
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('phone', event.currentTarget)}>
                    <span className="dl-icon"><SvgPhone /></span>
                    <strong>{profile.phone || 'Votre telephone'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('email', event.currentTarget)}>
                    <span className="dl-icon"><SvgEmail /></span>
                    <strong>{profile.email || 'Votre email'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('website', event.currentTarget)}>
                    <span className="dl-icon"><SvgWeb /></span>
                    <strong>{profile.website || 'Votre site'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('location', event.currentTarget)}>
                    <span className="dl-icon"><SvgLocation /></span>
                    <strong>{profile.location || 'Votre adresse'}</strong>
                  </article>
                </div>
                {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
              </div>
            </>
          )}

          {activeLayout === 'split' && (
            <div className="dl-split-wrap">
              <div
                className={editableClass(showEditHints, 'dl-split-left')}
                style={{ background: `linear-gradient(180deg, ${activeAccent}cc 0%, ${activeTheme.surface || '#0c1b2b'} 100%)` }}
                ref={coverUrl ? coverGestureRef : null}
                title="Glisser pour repositionner"
                onClick={() => onEditImage('cover')}
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="cover"
                    className="framed-image"
                    style={{
                      objectPosition: `${assets.cover.positionX}% ${assets.cover.positionY}%`,
                      transform: `scale(${assets.cover.zoom})`,
                      opacity: assets.cover.opacity,
                    }}
                  />
                ) : (
                  <div className="dl-split-cover-fallback" style={{ background: `linear-gradient(180deg, ${activeAccent}cc 0%, ${activeTheme.surface || '#0c1b2b'} 100%)` }} />
                )}
                <div
                  className={editableClass(showEditHints, 'dl-split-avatar photo-frame gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditImage('avatar');
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span className="dl-split-initials">{initials || '+'}</span>
                  )}
                </div>
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo dl-company-logo--split')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditImage('logo');
                    }}
                  />
                )}
              </div>
              <div className="dl-split-right">
                <span className="phone-badge">{customization.cardLabel || 'Carte de visite'}</span>
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} style={{ opacity: 0.5 }} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                <button type="button" className="dl-save-btn" onClick={stopClick}>Save</button>
                <div className="dl-split-links">
                  <span className={editableClass(showEditHints)} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-icon"><SvgPhone /></span> {profile.phone || 'Votre telephone'}</span>
                  <span className={editableClass(showEditHints)} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-icon"><SvgEmail /></span> {profile.email || 'Votre email'}</span>
                  <span className={editableClass(showEditHints)} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-icon"><SvgWeb /></span> {profile.website || 'Votre site'}</span>
                  <span className={editableClass(showEditHints)} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-icon"><SvgLocation /></span> {profile.location || 'Votre adresse'}</span>
                </div>
                {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
              </div>
            </div>
          )}

          {activeLayout === 'minimal' && (
            <>
              <div className="dl-minimal-top" style={{ background: `linear-gradient(160deg, ${activeTheme.surface || '#0c1b2b'} 0%, ${activeAccent}22 100%)` }}>
                <div
                  className={editableClass(showEditHints, 'dl-minimal-mono gesture-target')}
                  style={{ background: activeAccent }}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={() => onEditImage('avatar')}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span>{initials || '+'}</span>
                  )}
                </div>
                <h2 className={editableClass(showEditHints, 'dl-minimal-name')} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h2>
                <p className={editableClass(showEditHints, 'dl-minimal-role')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'dl-minimal-company')} style={{ color: activeAccent }} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo dl-company-logo--minimal')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
              </div>
              <div className="dl-minimal-links">
                <div className={editableClass(showEditHints, 'dl-link-row')} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-icon"><SvgPhone /></span><span>{profile.phone || 'Votre telephone'}</span></div>
                <div className={editableClass(showEditHints, 'dl-link-row')} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-icon"><SvgEmail /></span><span>{profile.email || 'Votre email'}</span></div>
                <div className={editableClass(showEditHints, 'dl-link-row')} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-icon"><SvgWeb /></span><span>{profile.website || 'Votre site'}</span></div>
                <div className={editableClass(showEditHints, 'dl-link-row')} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-icon"><SvgLocation /></span><span>{profile.location || 'Votre adresse'}</span></div>
              </div>
              {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints, { padding: '0 0.8rem' })}
              <div className="action-row" style={{ padding: '0.5rem 0.8rem 1rem' }}>
                <button type="button" onClick={stopClick}>Save contact</button>
                <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
              </div>
            </>
          )}

          {activeLayout === 'bold' && (
            <>
              <div
                className={editableClass(showEditHints, 'dl-bold-bg gesture-target')}
                ref={avatarUrl ? avatarGestureRef : null}
                title="Glisser pour repositionner"
                onClick={() => onEditImage('avatar')}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile.fullName || 'Avatar'}
                    className="framed-image"
                    style={{
                      objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                      transform: `scale(${assets.avatar.zoom})`,
                      opacity: assets.avatar.opacity,
                    }}
                  />
                ) : (
                  <div className="dl-bold-placeholder" style={{ background: `linear-gradient(135deg, ${activeAccent} 0%, ${activeTheme.highlight || activeAccent}66 100%)` }} />
                )}
              </div>
              <div className="dl-bold-glass">
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity, maxHeight: '22px' }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
                <div className="dl-bold-links">
                  <button type="button" className={editableClass(showEditHints, 'dl-bold-link-btn')} style={{ borderColor: `${activeAccent}55`, color: activeAccent }} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-icon"><SvgPhone /></span> {profile.phone || 'Votre telephone'}</button>
                  <button type="button" className={editableClass(showEditHints, 'dl-bold-link-btn')} style={{ borderColor: `${activeAccent}55`, color: activeAccent }} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-icon"><SvgEmail /></span> {profile.email || 'Votre email'}</button>
                  <button type="button" className={editableClass(showEditHints, 'dl-bold-link-btn')} style={{ borderColor: `${activeAccent}55`, color: activeAccent }} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-icon"><SvgWeb /></span> {profile.website || 'Votre site'}</button>
                  <button type="button" className={editableClass(showEditHints, 'dl-bold-link-btn')} style={{ borderColor: `${activeAccent}55`, color: activeAccent }} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-icon"><SvgLocation /></span> {profile.location || 'Votre adresse'}</button>
                </div>
                {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
                <div className="action-row">
                  <button type="button" onClick={stopClick}>Save contact</button>
                  <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
                </div>
              </div>
            </>
          )}

          {activeLayout === 'grid' && (
            <>
              <div className="dl-grid-header">
                <div
                  className={editableClass(showEditHints, 'dl-grid-avatar gesture-target')}
                  style={{ borderColor: activeAccent }}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={() => onEditImage('avatar')}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span>{initials || '+'}</span>
                  )}
                </div>
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <span className={editableClass(showEditHints, 'dl-grid-company')} style={{ color: activeAccent }} onClick={(event) => onEditField('company', event.currentTarget)}>
                  @{profile.company || 'entreprise'}
                </span>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
              </div>
              <div className="dl-grid-links">
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-grid-icon"><SvgPhone /></span><span>Appeler</span></button>
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-grid-icon"><SvgEmail /></span><span>Email</span></button>
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-grid-icon"><SvgWeb /></span><span>Site web</span></button>
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-grid-icon"><SvgLocation /></span><span>Localiser</span></button>
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={stopClick}><span className="dl-grid-icon"><SvgSave /></span><span>Save contact</span></button>
                <button type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={stopClick}><span className="dl-grid-icon"><SvgShare /></span><span>Partager</span></button>
                {activeSocials.map((social) => (
                  <button key={social.key} type="button" className="dl-grid-link" style={{ '--grid-accent': activeAccent }} onClick={(event) => onEditField('socials', event.currentTarget)}><span className="dl-grid-icon"><social.Icon /></span><span>{social.label}</span></button>
                ))}
              </div>
              {logoUrl && (
                <div className="dl-grid-footer">
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={() => onEditImage('logo')}
                  />
                </div>
              )}
            </>
          )}

          {activeLayout === 'elegant' && (
            <>
              <div className="dl-elegant-top">
                <span className={editableClass(showEditHints, 'dl-elegant-badge')} style={{ color: activeAccent }} onClick={(event) => onEditField('cardLabel', event.currentTarget)}>
                  {customization.cardLabel || 'Carte de visite'}
                </span>
                <div className="dl-elegant-divider" style={{ background: `${activeAccent}33` }} />
                <div
                  className={editableClass(showEditHints, 'dl-elegant-avatar gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={() => onEditImage('avatar')}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span className="dl-elegant-initials" style={{ color: activeAccent }}>{initials || '+'}</span>
                  )}
                </div>
                <h2 className={editableClass(showEditHints, 'dl-elegant-name')} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h2>
                <div className="dl-elegant-divider short" style={{ background: activeAccent }} />
                <p className={editableClass(showEditHints, 'dl-elegant-role')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'dl-elegant-company')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity, maxHeight: '26px', marginTop: '0.35rem' }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
              </div>
              {profile.bio && (
                <p className={editableClass(showEditHints, 'dl-elegant-bio')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                  {profile.bio}
                </p>
              )}
              <div className="dl-elegant-links">
                <div className={editableClass(showEditHints, 'dl-elegant-link-row')} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-icon"><SvgPhone /></span><span>{profile.phone || 'Votre telephone'}</span></div>
                <div className={editableClass(showEditHints, 'dl-elegant-link-row')} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-icon"><SvgEmail /></span><span>{profile.email || 'Votre email'}</span></div>
                <div className={editableClass(showEditHints, 'dl-elegant-link-row')} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-icon"><SvgWeb /></span><span>{profile.website || 'Votre site'}</span></div>
                <div className={editableClass(showEditHints, 'dl-elegant-link-row')} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-icon"><SvgLocation /></span><span>{profile.location || 'Votre adresse'}</span></div>
              </div>
              {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints, { padding: '0 1rem' })}
              <div className="action-row" style={{ padding: '0.5rem 1rem 1rem' }}>
                <button type="button" onClick={stopClick}>Save contact</button>
                <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
              </div>
            </>
          )}

          {activeLayout === 'gradient' && (
            <>
              <div
                className={editableClass(showEditHints, 'dl-gradient-hero')}
                style={{ background: `linear-gradient(135deg, ${activeAccent} 0%, ${activeTheme.highlight || activeAccent}88 50%, ${activeTheme.surface || '#0c1b2b'} 100%)` }}
                ref={coverUrl ? coverGestureRef : null}
                title="Glisser pour repositionner"
                onClick={() => onEditImage('cover')}
              >
                {coverUrl && (
                  <img
                    className="dl-gradient-cover"
                    src={coverUrl}
                    alt="cover"
                    style={{
                      objectPosition: `${assets.cover.positionX}% ${assets.cover.positionY}%`,
                      transform: `scale(${assets.cover.zoom})`,
                      opacity: assets.cover.opacity,
                    }}
                  />
                )}
                <div className="dl-cover-overlay" />
                <div
                  className={editableClass(showEditHints, 'dl-gradient-avatar gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditImage('avatar');
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span>{initials || '+'}</span>
                  )}
                </div>
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity, maxHeight: '20px' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditImage('logo');
                    }}
                  />
                )}
              </div>
              <div className="dl-gradient-body">
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
                <div className="dl-gradient-pills">
                  <span className={editableClass(showEditHints, 'dl-gradient-pill')} style={{ background: `${activeAccent}18`, color: activeAccent, borderColor: `${activeAccent}33` }} onClick={(event) => onEditField('phone', event.currentTarget)}><span className="dl-icon"><SvgPhone /></span> {profile.phone || 'Votre telephone'}</span>
                  <span className={editableClass(showEditHints, 'dl-gradient-pill')} style={{ background: `${activeAccent}18`, color: activeAccent, borderColor: `${activeAccent}33` }} onClick={(event) => onEditField('email', event.currentTarget)}><span className="dl-icon"><SvgEmail /></span> {profile.email || 'Votre email'}</span>
                  <span className={editableClass(showEditHints, 'dl-gradient-pill')} style={{ background: `${activeAccent}18`, color: activeAccent, borderColor: `${activeAccent}33` }} onClick={(event) => onEditField('website', event.currentTarget)}><span className="dl-icon"><SvgWeb /></span> {profile.website || 'Votre site'}</span>
                  <span className={editableClass(showEditHints, 'dl-gradient-pill')} style={{ background: `${activeAccent}18`, color: activeAccent, borderColor: `${activeAccent}33` }} onClick={(event) => onEditField('location', event.currentTarget)}><span className="dl-icon"><SvgLocation /></span> {profile.location || 'Votre adresse'}</span>
                </div>
                {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
                <div className="action-row">
                  <button type="button" onClick={stopClick}>Save contact</button>
                  <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
                </div>
              </div>
            </>
          )}

          {activeLayout === 'custom' && (
            <>
              <div
                className={editableClass(showEditHints, 'dl-cover dl-cover--custom')}
                ref={coverUrl ? coverGestureRef : null}
                title="Glisser pour repositionner"
                onClick={() => onEditImage('cover')}
              >
                {coverUrl ? (
                  <img
                    className="dl-cover-img"
                    src={coverUrl}
                    alt="cover"
                    style={{
                      objectPosition: `${assets.cover.positionX}% ${assets.cover.positionY}%`,
                      transform: `scale(${assets.cover.zoom})`,
                      opacity: assets.cover.opacity,
                    }}
                  />
                ) : (
                  <div className="dl-cover-bg" style={{ background: `linear-gradient(135deg, ${activeAccent} 0%, ${activeTheme.highlight || activeAccent}88 100%)` }} />
                )}
                <div className="dl-cover-overlay" />
                <span className="phone-badge dl-cover-badge">{customization.cardLabel || 'Carte sur mesure'}</span>
                <div
                  className={editableClass(showEditHints, 'dl-cover-avatar photo-frame gesture-target')}
                  ref={avatarUrl ? avatarGestureRef : null}
                  title="Glisser pour repositionner"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditImage('avatar');
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.fullName || 'Avatar'}
                      className="framed-image"
                      style={{
                        objectPosition: `${assets.avatar.positionX}% ${assets.avatar.positionY}%`,
                        transform: `scale(${assets.avatar.zoom})`,
                        opacity: assets.avatar.opacity,
                      }}
                    />
                  ) : (
                    <span>{initials || '+'}</span>
                  )}
                </div>
              </div>
              <div className="dl-body">
                {logoUrl && (
                  <img
                    className={editableClass(showEditHints, 'dl-company-logo')}
                    src={logoUrl}
                    alt="logo"
                    style={{ opacity: assets.logo.opacity }}
                    onClick={() => onEditImage('logo')}
                  />
                )}
                <h3 className={editableClass(showEditHints)} onClick={(event) => onEditField('fullName', event.currentTarget)}>
                  {profile.fullName || 'Votre nom'}
                </h3>
                <p className={editableClass(showEditHints, 'role-line')} onClick={(event) => onEditField('role', event.currentTarget)}>
                  {profile.role || 'Votre titre'}
                </p>
                <p className={editableClass(showEditHints, 'company-line')} onClick={(event) => onEditField('company', event.currentTarget)}>
                  {profile.company || 'Votre entreprise'}
                </p>
                {profile.bio && (
                  <p className={editableClass(showEditHints, 'bio-copy')} onClick={(event) => onEditField('bio', event.currentTarget)}>
                    {profile.bio}
                  </p>
                )}
                <div className="dl-custom-note">
                  {customization.customLayoutDescription || 'Layout sur mesure en cours de conception par le studio.'}
                </div>
                <div className="action-row">
                  <button type="button" onClick={stopClick}>Save contact</button>
                  <a href={finalCardUrl} className="secondary-action as-button" onClick={stopClick}>Open card</a>
                </div>
                <div className="info-panels">
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('phone', event.currentTarget)}>
                    <span className="dl-icon"><SvgPhone /></span>
                    <strong>{profile.phone || 'Votre telephone'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('email', event.currentTarget)}>
                    <span className="dl-icon"><SvgEmail /></span>
                    <strong>{profile.email || 'Votre email'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('website', event.currentTarget)}>
                    <span className="dl-icon"><SvgWeb /></span>
                    <strong>{profile.website || 'Votre site'}</strong>
                  </article>
                  <article className={editableClass(showEditHints)} onClick={(event) => onEditField('location', event.currentTarget)}>
                    <span className="dl-icon"><SvgLocation /></span>
                    <strong>{profile.location || 'Votre adresse'}</strong>
                  </article>
                </div>
                {renderSocialRow(activeSocials, activeAccent, onEditField, showEditHints)}
              </div>
            </>
          )}
    </div>
  );
  return noPhone ? (
    <div className="card-preview-bare">{phoneScreen}</div>
  ) : (
    <div className="phone-wrap">
      <div className="phone-shell">
        <div className="phone-notch" />
        {phoneScreen}
      </div>
    </div>
  );
}