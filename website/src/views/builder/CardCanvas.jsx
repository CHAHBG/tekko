import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CardRenderer, displayWebsite, fontStyleMap } from '../CardRenderer';

/*
 * CardCanvas — the studio preview. It now renders the SAME CardRenderer as the
 * published e-card (so studio === final), and just layers click-to-edit zones
 * and drag/zoom gestures on top via the `edit` prop. Read-only callers
 * (checkout / brief previews) pass readOnly to get the clean final look.
 */

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

export function CardCanvas({
  profile,
  customization,
  cardLayout,
  assets,
  activeTheme,
  activeAccent,
  finalCardUrl,
  initials,
  onEditField,
  onEditImage,
  onAdjustAsset,
  showEditHints,
  readOnly = false,
  qrUrl = '',
}) {
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const adjustAssetRef = useRef(onAdjustAsset);
  adjustAssetRef.current = onAdjustAsset;
  const avatarGestureRef = useGestureAttach('avatar', assetsRef, adjustAssetRef);
  const coverGestureRef = useGestureAttach('cover', assetsRef, adjustAssetRef);

  const attachGesture = useCallback((assetKey) => {
    if (assetKey === 'avatar') return avatarGestureRef;
    if (assetKey === 'cover') return coverGestureRef;
    return undefined;
  }, [avatarGestureRef, coverGestureRef]);

  const highlight = activeTheme?.highlight || activeAccent;
  const cardUrl = (finalCardUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const qrTarget = profile?.website ? displayWebsite(profile.website) : cardUrl;

  const cssVars = {
    '--ecard-accent': activeAccent,
    '--ecard-highlight': highlight,
    '--ecard-font': fontStyleMap[customization?.fontStyle] || fontStyleMap.moderne,
    ...(customization?.textColor ? { '--ecard-text': customization.textColor } : {}),
    ...(customization?.bgColor ? { '--ecard-bg': customization.bgColor } : {}),
  };

  const edit = readOnly
    ? null
    : { onEditField, onEditImage, attachGesture, showEditHints };

  // Scale the studio card down so the WHOLE card fits in the visible area
  // (between the top of the stage and the floating toolbar) — no inner scroll,
  // nothing cut off. The published card itself is never scaled.
  const fitRef = useRef(null);
  const pageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [fitHeight, setFitHeight] = useState(null);

  useLayoutEffect(() => {
    if (readOnly) return undefined;
    const fitEl = fitRef.current;
    const page = pageRef.current;
    if (!fitEl || !page) return undefined;
    const recompute = () => {
      const naturalH = page.offsetHeight; // layout height, unaffected by transform
      if (!naturalH) return;
      const top = fitEl.getBoundingClientRect().top;
      const dock = document.querySelector('.floating-toolbar');
      const bottom = dock ? dock.getBoundingClientRect().top : window.innerHeight;
      const avail = bottom - top - 16;
      const next = Math.max(0.5, Math.min(1, avail / naturalH));
      setScale(next);
      setFitHeight(naturalH * next);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(page);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [readOnly]);

  return (
    <div
      className="ecard-fit"
      ref={fitRef}
      style={!readOnly && fitHeight != null ? { height: fitHeight, overflow: 'hidden' } : undefined}
    >
      <div
        className={`ecard-page ecard-page--embedded ecard-page--${cardLayout}`}
        ref={pageRef}
        style={!readOnly ? { ...cssVars, transform: `scale(${scale})`, transformOrigin: 'top center' } : cssVars}
      >
        <CardRenderer
          profile={profile}
          customization={customization}
          assets={assets}
          accent={activeAccent}
          highlight={highlight}
          layout={cardLayout}
          initials={initials}
          qrUrl={qrUrl}
          qrTarget={qrTarget}
          cardUrl={cardUrl}
          edit={edit}
        />
      </div>
    </div>
  );
}
