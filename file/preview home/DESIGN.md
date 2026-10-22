---
name: Social Commerce Engine
colors:
  surface: '#FFFFFF'
  surface-dim: '#d3daee'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e2e8fc'
  surface-container-highest: '#dce2f6'
  on-surface: '#151b2a'
  on-surface-variant: '#5a4045'
  inverse-surface: '#2a3040'
  inverse-on-surface: '#edf0ff'
  outline: '#8e6f74'
  outline-variant: '#e2bec3'
  surface-tint: '#bb0452'
  primary: '#b7004f'
  on-primary: '#ffffff'
  primary-container: '#da2a67'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb1c0'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#b70f33'
  on-tertiary: '#ffffff'
  tertiary-container: '#db3049'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9df'
  primary-fixed-dim: '#ffb1c0'
  on-primary-fixed: '#3f0017'
  on-primary-fixed-variant: '#90003d'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b4'
  on-tertiary-fixed: '#40000b'
  on-tertiary-fixed-variant: '#920024'
  background: '#f9f9ff'
  on-background: '#151b2a'
  surface-variant: '#dce2f6'
  brand-hover: '#C81E5B'
  violet-dark: '#6D28D9'
  buy-primary: '#EF4056'
  buy-hover: '#D73246'
  success: '#12B76A'
  warning: '#F79009'
  danger: '#F04438'
  info: '#2E90FA'
  ink-900: '#0B1220'
  ink-800: '#16213A'
  ink-700: '#253049'
  ink-600: '#475467'
  ink-500: '#667085'
  ink-400: '#98A2B3'
  ink-300: '#D0D5DD'
  ink-200: '#EAECF0'
  ink-100: '#F2F4F7'
  canvas: '#FAFAFB'
  canvas-sunken: '#F6F7F9'
typography:
  display:
    fontFamily: Vazirmatn
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 42px
  display-mobile:
    fontFamily: Vazirmatn
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 34px
  headline-lg:
    fontFamily: Vazirmatn
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg-mobile:
    fontFamily: Vazirmatn
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Vazirmatn
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 29px
  headline-md-mobile:
    fontFamily: Vazirmatn
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
  headline-sm:
    fontFamily: Vazirmatn
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm-mobile:
    fontFamily: Vazirmatn
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  price-headline:
    fontFamily: Vazirmatn
    fontSize: 18px
    fontWeight: '800'
    lineHeight: 24px
  body-default:
    fontFamily: Vazirmatn
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 26px
  body-emphasis:
    fontFamily: Vazirmatn
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 26px
  label-caption:
    fontFamily: Vazirmatn
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 21px
  label-caption-mobile:
    fontFamily: Vazirmatn
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 19px
  label-micro:
    fontFamily: Vazirmatn
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 15px
  code-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

### Visual Philosophy & Emotional Resonance
The design system bridges the dynamic, discovery-driven emotional energy of social feeds with the operational certainty, trust, and speed required for seamless social commerce. It captures the modern aesthetic of content creation—vibrant gradients, media-first canvas, kinetic delight—while anchoring transactional flows in absolute clarity and friction-free checkout mechanics. 

The visual tone is:
- **Expressive & Social:** Rich, calibrated brand gradients, tactile micro-feedback (double-tap hearts, story rings), and ambient media framing.
- **Commercial Rigor & Trust:** Crisp typography, verified seller and delivery indicators, zero layout shifts, and prominent, unmissable buy actions.
- **Telegram-Grade Speed & Utility:** Lightweight structural surfaces, logical RTL rhythm, modular sidebars, and rapid keyboard/touch response.

### Design Movement
A structured synthesis of **Modern Flat UI** and **Dynamic Social Fluidity**:
- **Layered Neutrals:** Crisp surfaces with surgical contrast rather than heavy skeletal borders.
- **Targeted Glassmorphism:** Translucent blurs reserved strictly for dynamic sticky navigation and modal backdrops, keeping feed contents performant and responsive.
- **RTL-First Precision:** Symmetrical alignment calibrated for Persian reading direction, paired with strict logical property architecture (`inline-start`, `inline-end`).

## Colors

### Separation of Concerns: The Cardinal Action Rule
To avoid decision paralysis within content-dense feeds, interactive color roles are strictly segregated:
- **Primary (`#E1306C`) & Secondary (`#7C3AED`):** Dedicated exclusively to social activity, active story status, creative brand touchpoints, following merchants, and profile engagement.
- **Tertiary / Commercial CTA (`#EF4056`):** Exclusively reserved for commercial actions—adding to basket, final purchase triggers, promotional discounts, and seller transactional communication.
- **Strict Viewport Rule:** Only **one** saturated commercial action button (`#EF4056`) may occupy the primary focal zone of a single viewport at any given moment.

### Neutrals & Background Surfaces
The system avoids pure optical black, employing rich navy-tinted charcoal tones (`#0B1220` through `#F2F4F7`) to build depth and contrast without harshness. 

- `--surface` (`#FFFFFF`): Applied to cards, bottom sheets, menus, and elevated dialogs.
- `--canvas` (`#FAFAFB`): Canvas wash that creates soft separation from pure white card containers.
- `--canvas-sunken` (`#F6F7F9`): Inset backgrounds, metadata trays, and alternate chat counter-bubbles.

## Typography

### Localization & RTL Engine
All typography is rendered natively in `Vazirmatn` with full OpenType feature support. 
- **Persian Digits Activation:** Enable `font-feature-settings: "ss01"` across all UI text, prices, timestamps, and stock tallies using standard Persian formatting (`Intl.NumberFormat('fa-IR')`).
- **Latin Isolation:** Strict fallback isolation using monospaced styling (`JetBrains Mono`) for SKUs, order tracking codes, bank card representations, and promo alphanumeric strings. Wrap all embedded Latin text in `<bdi>` elements to prevent bidirectional text leakage.
- **Reading Rhythm:** Persian requires taller vertical line heights compared to Latin scripts. The base line-height for body text is set to `1.75` (`26px` on `15px` font) to prevent character collision with ascenders, descenders, and tashkeel marks.

## Layout & Spacing

### Viewport Layout System
The layout implements an asymmetric 3-column desktop layout that transforms into a lean single-column mobile experience:

1. **Mobile (< 768px):** 
   - Single-column canvas with edge-to-edge media cards.
   - Sticky top glass navigation (`56px`) with 64px bottom tab navigation bar + dynamic safe-area insets.
   - Sticky product actions render inside a fixed bottom buy sheet (`52px` button height).
2. **Tablet (768px – 1023px):**
   - 2-column format: 72px icon navigation rail + 600px centered feed.
   - Cart, order tracker, and chat drawers pull out as slide-over sheets.
3. **Desktop (1024px – 1439px):**
   - 3-column architecture: 76px compact navigation rail, 600px feed column, and 320px sticky utility cockpit on the left (in RTL: inline-end).
4. **Wide Desktop (≥ 1440px):**
   - Full 3-column layout: 244px expanded navigation rail, 630px feed column, and 320px sticky utility rail.

### Spatial Rhythm & Cumulative Layout Shift (CLS)
- Media nodes (images and video players) must be strictly locked into `1:1` square or `4:5` vertical portrait ratios with predefined skeleton placeholders to ensure zero cumulative layout shift during progressive image hydration.
- The standard vertical gap between post units is fixed at `24px` (`space-xl`).

## Elevation & Depth

### Tonal Hierarchy & Ambient Shadows
Elevation relies on smooth, tinted shadows combined with soft hairline borders (`1px solid #EAECF0`) rather than heavy dark drop shadows:

- **Level 0 (Flat):** Canvas background (`#FAFAFB`) and recessed trays (`#F6F7F9`).
- **Level 1 (Resting Surface):** Feed cards, input fields, standard list elements:
  - `box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);`
- **Level 2 (Hover & Focus States):** Card interaction lift (`translateY(-2px)`), floating action buttons:
  - `box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);`
- **Level 3 (Floating Menus & Sticky Bars):** Sticky top bars, floating cart pill, filter dropdowns:
  - `box-shadow: 0 16px 40px rgba(16, 24, 40, 0.12);`
- **Level 4 (Modals & Sheets):** Mobile product purchase sheets, 60/40 desktop split modals:
  - `box-shadow: 0 32px 64px rgba(16, 24, 40, 0.18);`

### Glassmorphic Surfaces & Scrims
- **Sticky Glass Headers:** `background: rgba(255, 255, 255, 0.72); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`
- **Modal Scrims:** `background: rgba(11, 18, 32, 0.55); backdrop-filter: blur(4px);`

## Shapes

### Corner Radii Guidelines
The design system enforces a balanced curve scale (`Level 2: Rounded`) optimized for mobile touch targets and modern editorial framing:

- **Pill (`999px`):** Avatars, story status rings, floating pricing badges, live broadcast indicators, status counter chips.
- **Extra Large (`24px`):** Large interactive modal dialogs and split desktop preview panels.
- **Large (`16px`):** Mobile checkout bottom sheets, sticky summary drawers, product media containers.
- **Medium (`12px`):** Primary feed cards, post commentary trays, customer/merchant direct message bubbles.
- **Small (`8px`):** Text fields, numerical stepper pickers, variant selector pills, badge tags.

## Components

### Buttons
- **Commercial Buy Action (Primary CTA):** High-density red (`#EF4056`), white bold text, `48px` default desktop height (`52px` in sticky mobile sheet), `rounded-sm` (8px). Pressed state shifts to `#D73246`. Must include instant micro-price summary or direct cart icon.
- **Social Action Button:** Gradient fill (`linear-gradient(135deg, #E1306C, #7C3AED)`), white text, `40px` height. Reserved for merchant "دنبال کردن" (Follow) and social campaigns.
- **Secondary / Ghost Button:** Transparent background, `1px` border in `#D0D5DD`, text `#16213A`. Hover states apply `#F2F4F7`.

### Chips & Badges
- **Floating Price Tag:** Positioned directly over post media at `inset-inline-start: 12px`, `inset-block-end: 12px`. High-opacity dark glass background (`rgba(11, 18, 32, 0.75)`), white text, bold Persian numerals.
- **Authenticity & Delivery Badges:** Micro tags with green `#12B76A` (ضمانت اصالت) and blue `#2E90FA` (ارسال فوری). Border radius `4px`, padding `2px 6px`, font size `11px`.
- **Story Ring Avatar:** Circular frame with a `3px` dynamic gradient stroke (`conic-gradient(from 180deg, #F9CE34, #EE2A7B, #6228D7, #F9CE34)`), separated from the avatar image by a `2px` white spacer buffer.

### Product Post Cards
- **Header (`56px`):** Seller avatar, merchant name, verified tick icon, location caption, and trailing contextual menu trigger (`...`).
- **Media Block:** Fixed `1:1` or `4:5` aspect ratio with right-to-left swipe indicators for carousels. Double-tap triggers an animated central heart burst (`scale(1.35)`).
- **Commerce Action Bar (`48px`):** Like, comment, share, and bookmark icons on the right (inline-start), with product stock count on the left (inline-end).
- **Integrated Buy Bar (`64px`):** Clean separation row at the card base featuring active price in 18px bold, struck-through original price, discount percentage chip, and immediate "افزودن به سبد" button.

### Form Inputs & Selectors
- **Fields:** Height `44px`, `rounded-sm` (8px), border `1px solid #D0D5DD`, text color `#0B1220`. Active focus rings apply `2px solid #E1306C` with zero shadow blur.
- **Variant Selectors (Color / Size):** Horizontal flex row with `8px` gaps. Out of stock variants display diagonal strikethrough lines with disabled opacity (`0.45`).

### Inventory Cards & RBAC Matrix Controls
- **Stock Status Badge:** Green `#12B76A` for "موجود" (In Stock), Amber `#F79009` for "کم‌موجود" (Low Stock, < 5 items), and Red `#F04438` for "ناموجود" (Sold Out).
- **RBAC Matrix Table:** Dense rows with alternating zebra striping (`#FFFFFF` to `#FAFAFB`), displaying granular role permissions (مدیر فروشگاه, پشتیبان, انباردار, بازاریاب) via clear status switches.