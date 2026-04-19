# Canvas-First UX Redesign — Tapal Studio

**Date:** 2026-04-18
**Status:** Approved
**Scope:** `website/src/views/BuilderView.jsx` → split into 4 components + CSS + toolbar

---

## Problem

BuilderView.jsx is a 1,868-line wizard-form where users fill in fields on the left and see a preview on the right. This creates unnecessary indirection — the user sees the card but edits in a separate form. Mobile users toggle between form and preview with a button, making the workflow disjointed.

## Solution

Replace the form-based editing with **direct manipulation on the card preview**. Users tap elements on the card to edit them. A floating toolbar provides access to layout, theme, colors, and ordering.

---

## Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Editing paradigm | Canvas-first for design (profile, images, style), wizard for transactional (physical, delivery, summary, payment) |
| 2 | Property editing surface | Bottom sheet (mobile), side panel (desktop) |
| 3 | First-run experience | Guided placeholders + tap-to-edit, no onboarding modal |
| 4 | Navigation | Floating toolbar at bottom (Layout, Theme, Colors, Physical, Order) |
| 5 | Design-to-order transition | "Commander" CTA → full-screen checkout wizard, mini card thumbnail |
| 6 | Direct manipulation scope | Tap text/contact fields to edit, tap avatar/cover(if layout supports)/logo to upload, drag to reposition. No pinch-zoom in v1. |

---

## Architecture

### File Split

| File | Responsibility | Approx lines |
|------|---------------|-------------|
| `BuilderView.jsx` | Orchestrator — all state, URL routing, mode switching | ~400 |
| `builderIcons.jsx` | Shared SVG icons + SOCIAL_ICON_MAP + CONTACT_ICON_MAP for builder-only UI | ~120 |
| `CardCanvas.jsx` | Phone preview with 9 edit-aware layout renderers | ~800 |
| `FieldEditor.jsx` | Bottom sheet (mobile) / side panel (desktop) for field editing | ~300 |
| `CheckoutWizard.jsx` | Full-screen checkout: physical → delivery → summary → payment | ~400 |

### Data Flow

```
BuilderView (state owner)
  ├── CardCanvas (reads profile/style/layout, emits onEditField/onEditImage)
  ├── FieldEditor (reads editingField, emits onFieldChange)
  ├── FloatingToolbar (layout/theme/colors/physical/order buttons)
  └── CheckoutWizard (reads all state, emits onOrder)
```

- All state stays in `BuilderView.jsx` — props down, callbacks up
- No new libraries, no Context API
- Builder-only SVG icon components + `SOCIAL_ICON_MAP` + `CONTACT_ICON_MAP` live in a small shared module consumed by `CardCanvas.jsx` and `FieldEditor.jsx`
- `useGestureAttach()` hook stays in `CardCanvas.jsx`
- Profile JSON auto-persist behavior unchanged (server needs no changes)

### Shared UI State Contract

`BuilderView.jsx` owns all transient UI state introduced by the redesign:

- `editorMode`: `'canvas' | 'checkout'`
- `editingField`: `null | { type: 'field' | 'socials' | 'image', key: string }`
- `toolbarPanel`: `null | 'layout' | 'theme' | 'colors' | 'physical'`
- `showEditHints`: boolean, true only for first canvas visit in the session

Rules:

- Opening a card field closes any open toolbar panel
- Opening a toolbar panel closes `editingField`
- Entering checkout closes both `editingField` and `toolbarPanel`
- Returning from checkout restores canvas mode with both panels closed

---

## Component Details

### CardCanvas.jsx

**Props:** `profile`, `customization`, `cardLayout`, `assets`, `activeTheme`, `activeAccent`, `finalCardUrl`, `initials`, `activeSocials`, `onEditField(fieldKey)`, `onEditImage(imageKey)`, `onAdjustAsset(assetKey, field, value)`

Each of the 9 layout renderers (classic, banner, split, minimal, bold, grid, elegant, gradient, custom) gets enhanced:

- Every text element gets `className="editable-zone"` and `onClick={() => onEditField(key)}`
- Every image area gets `className="editable-zone"` and `onClick={() => onEditImage(key)}`
- Placeholder text shown for empty fields (e.g., "Votre nom", "Votre titre")

**Editable fields on the card:**

| Field key | Element | Available in |
|-----------|---------|-------------|
| `fullName` | Name text | All layouts |
| `role` | Title/role text | All layouts |
| `company` | Company text | All layouts |
| `phone` | Phone row | All layouts |
| `email` | Email row | All layouts |
| `website` | Website row | All layouts |
| `location` | Location row | All layouts |
| `socials` | Social icons row | All layouts |
| `avatar` | Avatar photo | All layouts |
| `cover` | Cover/banner image | Banner, split, gradient, custom |
| `logo` | Logo image | Layouts with logo |

**Visual affordance:**
- Desktop hover: dashed outline + small pencil icon (CSS `.editable-zone:hover`)
- Mobile: 1.5s pulse animation on all editable zones on first load, then fades out (`showEditHints` state, once per session)
- Empty/placeholder fields: lighter text style with in-canvas fallback copy such as `Votre nom`, `Votre titre`, `Votre entreprise`, rendered directly in the preview element so the tap target still exists when data is empty

**Gesture coexistence:**
- `onClick` fires on tap (no drag movement). Existing gesture handlers use `onPointerDown/Move/Up`.
- Tap = click handler. Drag = gesture handler. No conflict.
- `e.stopPropagation()` on gesture `onPointerDown` to prevent click during drag.

### FieldEditor.jsx

**Props:** `editingField`, `profile`, `onFieldChange(key, value)`, `onClose()`, `onImageUpload(key, file)`

**`editingField` shape:**

```js
null | { type: 'field' | 'socials' | 'image', key: string }
```

Examples:

- `{ type: 'field', key: 'fullName' }`
- `{ type: 'socials', key: 'socials' }`
- `{ type: 'image', key: 'avatar' }`

`FieldEditor.jsx` resolves labels, placeholders, and input types from `profileFields`, `socialFields`, and an internal image metadata map. It does not own form data.

**Mobile layout:** Bottom sheet sliding up from bottom, covers ~40% of screen. Card preview visible above.

**Desktop layout:** Side panel on right (~320px). Card preview centered-left.

**Responsive breakpoint:** automatic CSS/media-query behavior at `max-width: 960px` = mobile sheet, `min-width: 961px` = desktop side panel. No JS device detection.

**Content by field type:**
- Text fields (fullName, role, company, location): label + text input
- Contact fields (phone, email, website): label + typed input (tel/email/url)
- Social group (`socials` key): all 10 social fields with icons + inputs
- Image fields (avatar, cover, logo): file picker button + thumbnail + "Supprimer" option

**Behavior:**
- Changes apply live on every keystroke (no debounce in v1; optimize later only if profiling shows preview lag)
- Closes on: "Terminé" button, click outside, Escape key
- Auto-focuses the input on open

### FloatingToolbar

Rendered inside `BuilderView.jsx` (not its own file — it's small).

**Position:** Fixed at bottom center of screen, above safe area.

**5 buttons:**
1. **Mise en page** (Layout) — opens bottom sheet with 9 layout thumbnails in grid
2. **Thème** (Theme) — opens bottom sheet with font picker + dark/light toggle
3. **Couleurs** (Colors) — opens bottom sheet with accent color swatches
4. **Carte physique** (Physical) — opens bottom sheet with material/finish/foil preview
5. **Commander** (Order) — CTA button (filled, accent color), transitions to CheckoutWizard

**Behavior:**
- Toolbar hidden during CheckoutWizard view
- Only one bottom sheet open at a time
- Each toolbar bottom sheet closes the FieldEditor if it was open
- `toolbarPanel` state lives in `BuilderView.jsx`
- Toolbar panels reuse the same bottom-sheet shell on mobile as `FieldEditor`, but never stack over it

### CheckoutWizard.jsx

**Props:**

- `profile`, `orderContact`, `customization`, `assets`, `cardLayout`, `packageSelection`
- `inventory`, `couponInput`, `couponStatus`, `appliedCoupon`
- `wantCustomDomain`, `customDomain`, `domainResult`, `domainValidationMessage`
- `totalPrice`, `discountAmount`, `finalPrice`, `finalCardUrl`, `savedOrderId`, `savedFinalCardUrl`, `savedPreviewQrUrl`
- action callbacks: `onBack()`, `onUpdateOrderContact(key, value)`, `onUpdateCustomization(key, value)`, `onSetCouponInput(value)`, `onApplyCoupon()`, `onRemoveCoupon()`, `onSetWantCustomDomain(value)`, `onSetCustomDomain(value)`, `onSetDomainResult(result)`, `onValidate(event)`, `onSubmit(event)`

**Layout:** Full-screen overlay replacing the canvas view.

**Structure:**
- Mini card thumbnail at top (~120px) showing current design
- Linear wizard: Physical options → Delivery info → Summary → Payment
- Back arrow returns to canvas editor
- Reuses existing form logic from current BuilderView sections 4-7

**Steps:**
1. **Physical options:** Card material, foil color, finish (existing section 4 content)
2. **Delivery:** Name, address, phone for delivery (existing section 5 content)
3. **Summary:** Order review with pricing (existing section 6 content)
4. **Payment:** CinetPay / Wave integration (existing section 7 content)

On successful payment → redirect to confirmation (existing behavior unchanged).

**Boundary note:** `CheckoutWizard.jsx` is presentation-only. Business logic stays in `BuilderView.jsx`; the wizard receives current values plus callbacks and renders the step UI.

---

## CSS Changes

### New CSS classes:
- `.editable-zone` — cursor:pointer, position:relative
- `.editable-zone:hover` — dashed outline, pencil icon pseudo-element (desktop only)
- `.editable-zone.pulse-hint` — animation for mobile first-load hint
- `.field-editor-sheet` — bottom sheet styles (mobile)
- `.field-editor-panel` — side panel styles (desktop)
- `.floating-toolbar` — fixed bottom bar with 5 buttons
- `.floating-toolbar .toolbar-btn` — individual button styles
- `.floating-toolbar .toolbar-cta` — CTA "Commander" button (accent fill)
- `.checkout-wizard` — full-screen overlay
- `.checkout-wizard .mini-card` — thumbnail at top
- `.checkout-wizard .wizard-step` — individual step container

### Removed CSS:
- `.form-pane` and its step-card layout rules after all equivalent checkout/editor styles exist
- `.mobile-bar` toggle button (no longer needed — preview is always visible)
- `.studio-layout.show-preview` toggle class

### Migration note:
- Keep `.studio-layout` and `.preview-pane` as the base layout shell in v1 to avoid unnecessary regressions
- Remove old `.form-pane`, `.mobile-bar`, and `.show-preview` selectors only after the new toolbar, editor, and checkout styles are in place and verified in both desktop and mobile layouts

### Preserved CSS:
- All 9 layout CSS classes (dl-classic-*, dl-banner-*, etc.)
- All SVG icon CSS (.dl-icon, .dl-social-row, etc.)
- Phone preview frame CSS (.preview-pane, .phone-frame, etc.)
- Gesture-related CSS

---

## Mobile Behavior

- Card preview is **always visible** (no more toggle between form and preview)
- Tapping a card element opens a bottom sheet that covers ~40% of screen
- Floating toolbar at bottom is always accessible
- On entering CheckoutWizard: full-screen, card as mini thumbnail
- Back from checkout returns to canvas with toolbar

---

## What Does NOT Change

- Server/API — no changes needed, profile JSON blob auto-persists
- `PublicCardView.jsx` — untouched (public-facing card display)
- `catalog.js` — untouched (socialFields, defaultProfile, profileFields)
- `api.js` — untouched
- Payment flow logic — same CinetPay/Wave integration
- Voice assistant — stays as-is (if present in BuilderView, moves to orchestrator)
- Database schema — no changes
- Deploy process — same build + SCP + restart

---

## Out of Scope (v1)

- Pinch-to-zoom on photos
- Undo/redo
- Drag-to-reorder contact fields
- Multi-language support for UI labels
- Animations beyond the edit hint pulse
