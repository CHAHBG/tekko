# Canvas-First Tapal Studio Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-first Tapal Studio builder with a canvas-first editor that keeps the existing preview, order, and payment logic working while making profile/style editing happen directly from the card preview.

**Architecture:** Keep all business logic and persisted state in [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx). Extract the preview into an edit-aware [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx), extract the field/image editor into [website/src/views/builder/FieldEditor.jsx](website/src/views/builder/FieldEditor.jsx), and extract transactional sections 4-7 into [website/src/views/builder/CheckoutWizard.jsx](website/src/views/builder/CheckoutWizard.jsx). Preserve the existing API surface, catalog data, payment handlers, and public card behavior.

**Tech Stack:** React 18 JSX, Vite 5, existing catalog/api utilities, plain CSS in [website/src/styles.css](website/src/styles.css), no new runtime dependencies.

---

## File Structure

**Create**
- [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx): shared builder-only SVG icons plus `SOCIAL_ICON_MAP` and `CONTACT_ICON_MAP`.
- [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx): preview-only component with `useGestureAttach` and all digital layout renderers.
- [website/src/views/builder/FieldEditor.jsx](website/src/views/builder/FieldEditor.jsx): mobile sheet / desktop side panel for text, social, and image editing.
- [website/src/views/builder/CheckoutWizard.jsx](website/src/views/builder/CheckoutWizard.jsx): full-screen order flow reusing current sections 4-7 UI and callbacks.

**Modify**
- [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx): shrink into orchestrator, add canvas UI state, replace form pane with toolbar + extracted components, keep submission/payment logic.
- [website/src/styles.css](website/src/styles.css): add canvas editor, field editor, floating toolbar, checkout wizard, editable affordance, and migration-safe responsive styles.

**Do not change unless required by integration bugs**
- [website/src/App.jsx](website/src/App.jsx)
- [website/src/lib/api.js](website/src/lib/api.js)
- [website/src/lib/catalog.js](website/src/lib/catalog.js)
- [website/src/views/PublicCardView.jsx](website/src/views/PublicCardView.jsx)

**Testing reality**
- There is no existing frontend unit/integration test harness in [website/package.json](website/package.json).
- Use repeated `npm run build` verification plus focused manual smoke checks after each chunk.
- Do not add Vitest/Jest in this feature unless the refactor becomes unsafe without it.

---

## Chunk 1: Extract The Preview Into CardCanvas

### Task 1: Create the builder subfolder and preview component shell

**Files:**
- Create: [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx)
- Create: [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx)
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L1)

- [ ] **Step 1: Create the folder and component file**

Create [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx) with this exported surface:

```jsx
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
}) {
  return null;
}
```

- [ ] **Step 2: Move preview-only helpers from BuilderView into CardCanvas**

Move these items from [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx) into the new builder files:
- SVG icon components currently at lines 29-71 into [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx)
- `SOCIAL_ICON_MAP` and `CONTACT_ICON_MAP` into [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx)
- `fontStyleMap` into [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx) if the preview still needs it
- `useGestureAttach()` currently at lines 208-268 into [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx)

Keep the hook signature aligned with existing asset behavior:

```jsx
function useGestureAttach(assetKey, assetsRef, adjustRef) {
  // unchanged drag + wheel/pinch behavior
}
```

- [ ] **Step 3: Import the new component into BuilderView**

Add:

```jsx
import { CardCanvas } from './builder/CardCanvas';
```

Remove the moved preview-only definitions from [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx).

In [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx), import the shared icons from [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx).

- [ ] **Step 4: Run build to prove the extraction compiles before moving JSX**

Run: `npm run build`

Expected: Vite build completes with no syntax/import errors.

### Task 2: Move the digital preview renderers into CardCanvas without behavior changes

**Files:**
- Create: [website/src/views/builder/CardCanvas.jsx](website/src/views/builder/CardCanvas.jsx)
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L1586)

- [ ] **Step 1: Copy the existing digital preview markup into CardCanvas**

Move the `previewTab === 'digital'` phone preview block from [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx) into `CardCanvas`, including the renderers for:
- classic
- banner
- split
- minimal
- bold
- grid
- elegant
- gradient

Keep the current DOM structure and CSS classes intact in this step.

- [ ] **Step 2: Add edit-aware wrappers without changing layout structure**

Update representative elements like this:

```jsx
<h3 className="editable-zone" onClick={() => onEditField('fullName')}>
  {profile.fullName || 'Votre nom'}
</h3>
```

```jsx
<div className="dl-cover editable-zone" onClick={() => onEditImage('cover')}>
  ...
</div>
```

Use direct handlers on the existing elements, not overlay hitboxes.

- [ ] **Step 3: Preserve gesture behavior on movable image areas**

Attach the existing gesture refs only to asset-driven containers and guard click-vs-drag behavior. Keep asset adjustment calls routed back through `onAdjustAsset`.

- [ ] **Step 4: Replace the inline preview block in BuilderView**

Replace the current digital preview section with:

```jsx
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
```

- [ ] **Step 5: Run build again**

Run: `npm run build`

Expected: Build succeeds and the extracted component is wired correctly.

---

## Chunk 2: Add Canvas Editing State, FieldEditor, And Toolbar

### Task 3: Add BuilderView orchestrator state for canvas mode

**Files:**
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L307)

- [ ] **Step 1: Add the new UI state contract to BuilderView**

Introduce these states near the existing view state:

```jsx
const [editorMode, setEditorMode] = useState('canvas');
const [editingField, setEditingField] = useState(null);
const [toolbarPanel, setToolbarPanel] = useState(null);
const [showEditHints, setShowEditHints] = useState(true);
```

- [ ] **Step 2: Add focused open/close handlers**

Implement orchestrator helpers:

```jsx
function handleEditField(key) {
  setToolbarPanel(null);
  setEditingField({ type: key === 'socials' ? 'socials' : 'field', key });
}

function handleEditImage(key) {
  setToolbarPanel(null);
  setEditingField({ type: 'image', key });
}

function handleOpenToolbarPanel(panel) {
  setEditingField(null);
  setToolbarPanel((current) => current === panel ? null : panel);
}
```

- [ ] **Step 3: Retire mobile-only preview toggling from the orchestrator**

Remove `mobileView`, `mobileScrollPos`, and the `show-preview` toggle logic once the canvas layout is active. Keep `previewTab` only if still needed for the physical card preview inside checkout; otherwise remove it too.

- [ ] **Step 4: Keep current submission/business logic untouched**

Do not rewrite `handleValidate`, `handleSubmit`, coupon logic, domain logic, or order payload shape in this task.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds with the new state contract in place.

### Task 4: Create FieldEditor and wire live editing

**Files:**
- Create: [website/src/views/builder/FieldEditor.jsx](website/src/views/builder/FieldEditor.jsx)
- Create: [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx)
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx)

- [ ] **Step 1: Build the `editingField`-driven editor shell**

Create [website/src/views/builder/FieldEditor.jsx](website/src/views/builder/FieldEditor.jsx) with:

```jsx
export function FieldEditor({
  editingField,
  profile,
  assets,
  onFieldChange,
  onImageFileChange,
  onImageRemoteChange,
  onAdjustAsset,
  onClose,
}) {
  if (!editingField) return null;
  return null;
}
```

- [ ] **Step 2: Resolve field metadata from catalog data**

Use `profileFields` and `socialFields` to map keys to labels, placeholders, and input types. Import social/contact icons from [website/src/views/builder/builderIcons.jsx](website/src/views/builder/builderIcons.jsx) so the editor and preview share the same icon set. Avoid hardcoding the whole profile schema twice.

- [ ] **Step 3: Keep updates fully live**

Wire text inputs straight to BuilderView state:

```jsx
onChange={(event) => onFieldChange('fullName', event.target.value)}
```

Wire image editing to the existing asset handlers:

```jsx
onChange={(event) => onImageFileChange('avatar', event.target.files?.[0] ?? null)}
```

- [ ] **Step 4: Mount FieldEditor from BuilderView**

Render it in canvas mode only:

```jsx
<FieldEditor
  editingField={editingField}
  profile={profile}
  assets={assets}
  onFieldChange={updateProfile}
  onImageFileChange={handleAssetFile}
  onImageRemoteChange={handleAssetRemote}
  onAdjustAsset={adjustAsset}
  onClose={() => setEditingField(null)}
/>
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds and BuilderView renders with the editor mounted.

### Task 5: Replace the form pane with a floating toolbar and canvas layout

**Files:**
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L807)
- Modify: [website/src/styles.css](website/src/styles.css)

- [ ] **Step 1: Remove the left-side profile/style form from the default builder view**

Delete the current non-bamba `form-pane` rendering for sections 1-7 from BuilderView and replace it with a canvas-first shell containing:
- the preview pane
- the field editor mount
- the floating toolbar

Keep `bambaMode` behavior unchanged unless it directly conflicts with the new layout. If it conflicts, hide the canvas-first UI when `bambaMode` is true and preserve the legacy simplified flow.

- [ ] **Step 2: Add the floating toolbar JSX in BuilderView**

Render buttons for `layout`, `theme`, `colors`, `physical`, and `order`.

Use a single source of truth:

```jsx
const toolbarItems = [
  { key: 'layout', label: 'Mise en page' },
  { key: 'theme', label: 'Theme' },
  { key: 'colors', label: 'Couleurs' },
  { key: 'physical', label: 'Carte physique' },
];
```

- [ ] **Step 3: Reuse existing option controls inside toolbar panels**

Move, do not redesign from scratch:
- layout picker from section 3
- theme/font choices from section 3
- accent/text/background color controls from section 3
- physical card material/finish/foil controls from section 4

- [ ] **Step 4: Add the base toolbar/editor/canvas CSS**

Add new classes in [website/src/styles.css](website/src/styles.css):
- `.canvas-builder`
- `.canvas-stage`
- `.floating-toolbar`
- `.toolbar-btn`
- `.toolbar-cta`
- `.toolbar-panel-sheet`
- `.field-editor-sheet`
- `.field-editor-panel`
- `.editable-zone`
- `.editable-zone.pulse-hint`

Do not remove old `.studio-layout` / `.preview-pane` rules yet; adapt them incrementally.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds with no dead imports or JSX mismatches.

---

## Chunk 3: Extract Transactional Flow Into CheckoutWizard And Finish Migration

### Task 6: Create CheckoutWizard from sections 4-7

**Files:**
- Create: [website/src/views/builder/CheckoutWizard.jsx](website/src/views/builder/CheckoutWizard.jsx)
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L1209)

- [ ] **Step 1: Copy physical, delivery, summary, and payment section UI into CheckoutWizard**

Source the markup from the current BuilderView ranges:
- physical section starting near line 1209
- delivery section starting near line 1271
- summary section starting near line 1315
- payment section starting near line 1362

Preserve the current inputs, validation display, coupon flow, domain checker, and CTA copy.

- [ ] **Step 2: Make CheckoutWizard presentation-only**

Pass current values and callbacks down from BuilderView instead of recreating business logic.

Representative API:

```jsx
<CheckoutWizard
  profile={profile}
  orderContact={orderContact}
  customization={customization}
  assets={assets}
  cardLayout={cardLayout}
  packageSelection={packageSelection}
  inventory={inventory}
  couponInput={couponInput}
  couponStatus={couponStatus}
  appliedCoupon={appliedCoupon}
  wantCustomDomain={wantCustomDomain}
  customDomain={customDomain}
  domainResult={domainResult}
  domainValidationMessage={domainValidationMessage}
  totalPrice={totalPrice}
  discountAmount={discountAmount}
  finalPrice={finalPrice}
  finalCardUrl={finalCardUrl}
  onBack={() => setEditorMode('canvas')}
  onUpdateOrderContact={updateOrderContact}
  onUpdateCustomization={updateCustomization}
  onSetCouponInput={setCouponInput}
  onApplyCoupon={applyCoupon}
  onRemoveCoupon={removeCoupon}
  onSetWantCustomDomain={setWantCustomDomain}
  onSetCustomDomain={setCustomDomain}
  onSetDomainResult={setDomainResult}
  onValidate={handleValidate}
  onSubmit={handleSubmit}
/>
```

- [ ] **Step 3: Add the mini card thumbnail at the top of checkout**

Reuse `CardCanvas` in a compact, non-editable mode or render a lightweight card thumbnail wrapper rather than duplicating card markup again.

- [ ] **Step 4: Switch BuilderView between canvas and checkout modes**

When the toolbar `Commander` button is clicked:

```jsx
setEditingField(null);
setToolbarPanel(null);
setEditorMode('checkout');
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds with checkout extracted and mounted.

### Task 7: Finish CSS migration and remove obsolete mobile toggle UI

**Files:**
- Modify: [website/src/styles.css](website/src/styles.css)
- Modify: [website/src/views/BuilderView.jsx](website/src/views/BuilderView.jsx#L1909)

- [ ] **Step 1: Remove the old `.mobile-bar` JSX and `show-preview` state usage**

Delete the sticky mobile preview toggle block once the floating toolbar and field editor are active.

- [ ] **Step 2: Remove obsolete CSS only after replacement styles exist**

Remove or neutralize styles for:
- `.mobile-bar`
- `.mobile-toggle`
- `.mobile-preview-switcher`
- `.studio-layout.show-preview`

Keep any shared layout rules still used by the new canvas shell.

- [ ] **Step 3: Add responsive rules for desktop vs mobile editor surfaces**

At `max-width: 960px`, use bottom sheets.
At `min-width: 961px`, use right-side panel.

- [ ] **Step 4: Add first-visit hint animation**

Add a one-shot pulse style for `.editable-zone.pulse-hint` and ensure it can be removed cleanly once `showEditHints` flips to false.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds and dead CSS/JS paths are removed.

### Task 8: Manual verification and regression sweep

**Files:**
- Modify only if bugs are found during verification

- [ ] **Step 1: Run the final build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Smoke test the core canvas interactions manually**

Verify these flows in the browser:
- Tap empty name field → editor opens → typing updates preview live
- Tap avatar → image editor opens
- Banner/split/gradient cover tap appears only on layouts with covers
- Drag avatar still repositions the image
- Layout switch still updates among all supported layouts
- Toolbar panels never stack over FieldEditor
- `Commander` enters checkout and `Retour` restores canvas

- [ ] **Step 3: Smoke test transactional regressions**

Verify:
- delivery fields still update `orderContact`
- coupon apply/remove still works
- domain validation still blocks submit when unavailable
- validate flow still creates preview receipt state
- submit flow still reaches checkout creation logic

- [ ] **Step 4: Check responsive behavior**

Manually inspect at roughly:
- 390px wide mobile viewport
- 768px tablet viewport
- 1280px desktop viewport

Focus on sheet/panel behavior, toolbar visibility, and no clipped preview.

- [ ] **Step 5: Leave unrelated dirty files untouched**

Do not modify the in-flight voice/admin/server/docs changes already present in the working tree unless a direct integration failure forces it.

---

## Notes For Execution

- Keep the `bambaMode` experience working. If the new canvas-first UI only applies to Studio mode, that is acceptable and lower-risk.
- Preserve the current payload shape sent by `submitOrder()`.
- Preserve existing QR code generation, pricing, coupon, and domain behavior.
- Prefer moving existing JSX blocks into smaller files over rewriting from scratch.
- No git commit unless the user explicitly asks for one.

Plan complete and saved to `docs/superpowers/plans/2026-04-19-canvas-first-tapal-studio.md`. Ready to execute?