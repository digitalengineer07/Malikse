# Responsive UI upgrade plan

Status: core UI implementation completed. See UI_IMPLEMENTATION_NOTES.md for changes and verified coverage.

User direction: preserve the original blue gradient background and glass-finish bottom navigation. Match other controls to this theme; do not replace it with a flat background or solid dock.

## Outcome

Give MalikSe a consistent, polished visual system across forms, dashboards,
navigation and marketplace screens. Keep essential actions reachable on small
phones, with the keyboard open, with larger text, and around device safe areas.
Validate representative devices instead of claiming every phone is covered.

## Findings from the current code

- `BottomNav.tsx` positions the mobile bar absolutely at the bottom. Its visible
  height is 64 plus bottom spacing and the safe-area allowance. `RoleDashboard.tsx`
  only supplies 44 points of bottom content padding. This explains the reported
  sign-out overlap at the code level; reproduce on a phone before closing it.
- `WorkflowUI.tsx` and `AccountProfileScreen.tsx` have separate fixed bottom
  padding. Forms lack a shared keyboard-aware screen layout.
- `VerifiedHomeScreen.tsx` uses a wrapping `View` for property types. Pagination
  controls reuse its style, so change the filter row independently.
- `AppHeader.tsx` always shows a brand tagline and language toggle, and ignores
  several declared props, including the title and right-side element.
- `theme.ts` mixes a blue primary palette with green navigation tokens. Screens
  also define their own colors, borders and shadows. Transparent input borders
  on white surfaces make field boundaries difficult to distinguish.
- Fonts are loaded in the root layout, but `premiumStyles` currently only calls
  `StyleSheet.create`; it does not apply those font families.

## 1. Establish one visual system

Use a restrained blue/slate palette, preserving the existing brand direction:

| Purpose | Proposed color |
| --- | --- |
| Primary buttons and selected controls | `#245B78` |
| Pressed primary | `#19445C` |
| Selected/secondary background | `#E8F1F6` |
| App background | `#F5F7FA` |
| Cards and input surfaces | `#FFFFFF` |
| Main text | `#172B3A` |
| Supporting text | `#526575` |
| Borders | `#D6E0E8` |

Keep distinct success, warning and error colors for meaning; do not recolor
errors blue. Validate actual foreground/background contrast before release.
Define semantic tokens for focus, disabled, pressed and selected states.

Use an explicit font-weight-to-font-family mapping for loaded Poppins fonts,
with readable fallbacks for Hindi and platform failure cases. Standardize spacing
on 4/8-point increments, inputs/buttons at approximately 48–52 points minimum
height, card radii 16–20, and restrained shadows. Let controls grow with text.
Replace hardcoded colors in the touched screens with theme tokens.

Files: `app/constants/theme.ts`, `app/constants/typography.ts`,
`app/components/AppBackground.tsx`, shared controls and navigation.

## 2. Fix navigation overlap and screen insets first

Create a shared layout contract between navigation and scrollable screens:

- Measure the entire floating navigation footprint, including safe-area spacing.
  Reserve that height plus a small content gap only on screens with an overlay.
- Keep one owner for safe-area padding. Avoid adding the inset twice when a
  navigator already reserves space or when the desktop footer is in normal flow.
- Apply it to the user dashboard, profile, tab screens and any floating actions.
- Keep sign-out inside normal scroll content, below account actions. Stack
  account actions on narrow screens and allow long labels to wrap.
- Handle keyboard opening separately: inputs and submit controls must scroll
  above it; navigation must not cover or steal touches from form controls.

Files: `BottomNav.tsx`, `RoleDashboard.tsx`, `AccountProfileScreen.tsx`,
`WorkflowUI.tsx`, `AppScreen.tsx`, and tab/role layouts where required.

Acceptance: after scrolling to the dashboard bottom, the whole sign-out control
is visible and tappable above navigation and the device gesture area, in portrait
and landscape. Logout behavior and account routing remain functional.

## 3. Simplify the top header

- Home: compact MalikSe wordmark on the left and a small language control on the
  right. Remove the tagline from the shared mobile header.
- Inner screens: back action, a concise title, and at most one contextual action.
  Move secondary options into the page or profile where appropriate.
- Honor the header's supported props; remove unused legacy props after updating
  callers. Preserve custom back handlers and fallback navigation.
- Use a solid surface, subtle divider, consistent icon sizing and generous touch
  targets. Support safe-area top padding and long translated titles without
  colliding with actions.

Files: `AppHeader.tsx` and its callers.

## 4. Make property-type selection a single swipeable row

Build a reusable `PropertyTypeTabs` component and use it on home and search.

- Use React Native `ScrollView horizontal`; keep chips in one non-wrapping row.
  On web, horizontal overflow belongs to this strip, not the entire page.
- Chips keep readable intrinsic widths and do not shrink to fit the screen.
- Enable touch swiping and trackpad scrolling. Provide accessible selected states
  and keyboard-focusable choices; keep the focused/selected choice in view.
- Preserve filter behavior and pagination reset. Do not apply this no-wrap rule
  to the separate pagination controls.
- Use one solid primary selected state and neutral outlined unselected states.
  Leave a slight next-chip glimpse on narrow screens to suggest scrolling.

Files: `VerifiedHomeScreen.tsx`, `MarketplaceScreen.tsx`, new shared filter component.

Acceptance: All properties, Land, Flats, Houses, Shops and Offices remain on one
horizontal line at 320-point width and can all be reached by swiping. The page
itself never scrolls horizontally.

## 5. Upgrade all forms through shared components

Create/rework `FormScreen`, `FormSection`, `FormField`, `FormActions` and choice
controls around the existing `WorkflowUI` components.

- Persistent labels; helpful examples and units; clear required/optional markers.
- Consistent default, focused, invalid, disabled and loading states. Errors sit
  next to the field and are announced accessibly; submissions show progress.
- Correct keyboard/autofill settings, password visibility controls, and sensible
  Next/Done behavior. Scroll the first invalid field into view.
- Keyboard avoidance and scroll-to-focus on native; visible focus rings on web.
- Full-width primary actions on phones; secondary actions beneath or beside them
  when space permits. Prevent repeated submission while a request is pending.
- One column on phones. Use two columns only for short related fields when the
  actual available width supports them; keep long text, uploads and maps wide.
- Adapt photo/document tiles and map controls without fixed widths that exceed
  the viewport. Preserve uploads, drafts, queued submission and review workflows.

Migration order:
1. Login/register and account profile.
2. Listing details, location/boundaries, photos/documents and declaration.
3. Offer sheet, messaging inputs and marketplace search/filter controls.
4. Advisor/Verifier reports, assignment controls and Admin staff forms.
5. Remaining inputs in saved screens, map tools and insights.

Audit both `.tsx` and `.web.tsx` variants so native and web share the same rules.

## 6. Responsive and accessibility verification

Use available width rather than device names. Starting layout rules: 16-point
phone gutters, 24 on wider screens, centered form content around 640–720 maximum
width. At larger widths, use content-driven columns; avoid fixed card heights.

Check 320, 360, 375, 390, 412 and 430 widths, short screens, phone landscape,
768-width tablets and desktop web. Include an iPhone safe-area layout and Android
gesture/three-button navigation where test devices or emulators are available.
Test keyboard open/closed, increased system text sizes up to 200%, English/Hindi,
long names, validation errors, loading, empty results and slow requests.

Release checklist:
- No clipped labels, accidental page-wide horizontal overflow or unreachable actions.
- Sign-out and form submission stay visible above navigation/keyboard.
- Header remains compact and back navigation works from direct-entry routes.
- Home property filters remain a single swipeable line.
- Buttons, fields, cards and navigation consistently use the shared palette.
- Text contrast, focus indication, screen-reader labels and touch targets verified.
- Frontend TypeScript, strict lint and Expo web/native exports pass.
- Capture before/after screenshots at representative widths and perform actual
  native keyboard/safe-area checks. Web viewport checks alone do not prove native
  behavior; record unavailable device coverage explicitly.

## Delivery order

1. Theme tokens and shared navigation/inset foundation; fix sign-out overlap.
2. Simplified header and horizontal property-type tabs.
3. Shared form components and screen-by-screen migration.
4. Responsive/device verification and final visual consistency pass.

Deliver the shared components, migrated screens, focused regression checks for
layout/navigation behavior, and a short QA record with screenshots and remaining
device-coverage limitations. No backend API redesign is needed for this work.
