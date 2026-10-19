---
name: Financial Steward
colors:
  surface: '#fff8f9'
  surface-dim: '#e2d7da'
  surface-bright: '#fff8f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf1f4'
  surface-container: '#f6ebee'
  surface-container-high: '#f0e5e8'
  surface-container-highest: '#eae0e3'
  on-surface: '#1f1a1d'
  on-surface-variant: '#544245'
  inverse-surface: '#342f31'
  inverse-on-surface: '#f9eef1'
  outline: '#877275'
  outline-variant: '#dac0c4'
  surface-tint: '#9b3f5a'
  primary: '#9b3f5a'
  on-primary: '#ffffff'
  primary-container: '#ff8fab'
  on-primary-container: '#79243f'
  inverse-primary: '#ffb1c2'
  secondary: '#006b56'
  on-secondary: '#ffffff'
  secondary-container: '#75f9d4'
  on-secondary-container: '#00725c'
  tertiary: '#ae2f34'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff928f'
  on-tertiary-container: '#88111d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c2'
  on-primary-fixed: '#3f0018'
  on-primary-fixed-variant: '#7d2742'
  secondary-fixed: '#75f9d4'
  secondary-fixed-dim: '#55dcb9'
  on-secondary-fixed: '#002018'
  on-secondary-fixed-variant: '#005140'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b0'
  on-tertiary-fixed: '#410006'
  on-tertiary-fixed-variant: '#8c1520'
  background: '#fff8f9'
  on-background: '#1f1a1d'
  surface-variant: '#eae0e3'
typography:
  headline-xl:
    fontFamily: Quicksand
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.5px
  headline-lg:
    fontFamily: Quicksand
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.3px
  headline-md:
    fontFamily: Quicksand
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.2px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.2px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.4px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a healing, clean, and minimalist aesthetic for a personal finance application. The visual narrative balances emotional warmth with precise financial clarity, evoking feelings of safety, ease, and gentle encouragement. 

### Brand Personality & Audience
- **Tone:** Approachable, calming, optimistic, and nurturing.
- **Audience:** Young professionals and individuals seeking a stress-free, delightful approach to personal expense tracking.
- **Emotional Response:** Replaces the anxiety often associated with budgeting with a sense of gentle control and self-care.

### Design Style
We employ a refined variant of **Minimalism** infused with soft warmth. The interface relies on generous whitespace, a carefully restrained pastel palette, and rounded structural geometry to remove visual clutter and highlight personal financial data clearly.

## Colors

The color system is built around a soothing sakura pink primary tone, supported by soft botanical accents for financial flows and a warm, clean foundation.

- **Primary (`#FF8FAB`):** Sakura pink used for primary actions, active states, and brand focal points.
- **Secondary (`#35C3A1`):** Mint green dedicated to positive cash flow, income entries, and growth indicators.
- **Tertiary (`#FF6B6B`):** Coral red reserved for alerts, budget overruns, and expense deductions.
- **Neutrals:** Canvas background utilizes a near-white pale pink (`#FFF4F7`), cards are rendered in creamy white (`#FFFBFC`), and body text is set in deep charcoal (`#4A4A4A`) for optimal legibility without harsh contrasts.

## Typography

Typography pairs a friendly, rounded geometric header font with a highly legible, contemporary sans-serif for numbers and body text. 

- **Headlines:** Set in Quicksand for a soft, approachable character that avoids clinical sternness.
- **Body & Labels:** Set in Plus Jakarta Sans to ensure financial figures, currency symbols, and categorization labels remain razor-sharp across mobile viewports.
- **Scale:** Optimized for mobile-first scanning, maintaining comfortable line heights to prevent dense data blocks.

## Layout & Spacing

The layout model relies on a mobile-first fluid grid prioritizing thumb-zone accessibility and comfortable vertical rhythm.

- **Grid & Margins:** Uses a fluid column layout with 16px (`1rem`) outer canvas margins to maximize screen real estate on compact viewports while framing cards gracefully.
- **Spacing Rhythm:** Built on a strict 4px/8px incremental scale. Component padding is kept generous (`space-md` to `space-lg`) to maintain the airy, minimalist atmosphere.
- **Responsive Adaptation:** On larger viewports (tablets and desktops), the main container maxes out at a centered 480px width to preserve the intimate, focused feel of a mobile application.

## Elevation & Depth

Depth is conveyed through subtle, warm-tinted tonal layers and ambient diffusion rather than harsh drop shadows, preserving the gentle, healing nature of the interface.

- **Surfaces:** Use flat, creamy white (`#FFFBFC`) cards stacked directly onto the pale pink (`#FFF4F7`) canvas to establish hierarchy.
- **Shadows:** Ambient shadows are rendered with extreme blur radii (16px to 24px) and very low opacity (4%-8%), tinted with a whisper of the primary pink to avoid muddy neutral tones.
- **Borders:** Zero structural hard borders; elevation separation relies entirely on surface contrast and soft ambient diffusion.

## Shapes

The shape language utilizes generous rounding (16px to 20px) to eliminate sharp edges and reinforce the friendly, comforting personality of the application.

- **Containers & Cards:** Standard cards and modular panels adopt a generous `16px` to `20px` radius.
- **Interactive Elements:** Buttons, inputs, and chips feature fully rounded pill shapes or soft matching radii to invite touch interaction and convey a welcoming tactile feel.

## Components

Components are designed to be tactile, clean, and frictionless, encouraging daily logging habits.

### Buttons
- **Primary:** Solid sakura pink (`#FF8FAB`) fill with deep charcoal or white text, styled with pill-shaped rounded corners and a subtle active scale-down state.
- **Secondary / Ghost:** Transparent or soft tinted background with primary color text for low-priority actions.

### Chips & Tags
- Used for expense categories (e.g., "Food", "Transport"). Rendered as compact pills with tinted pastel backgrounds and matching icon indicators.

### Input Fields
- Clean, borderless or low-opacity stroked fields set against creamy white surfaces, featuring soft rounded corners (`16px`) and clear floating placeholder text in muted gray.

### Cards
- Summary cards and transaction item containers feature creamy white (`#FFFBFC`) backgrounds, generous internal padding (`16px`), and soft ambient shadows to group financial data cleanly.

### Checkboxes & Radios
- Custom-styled circular elements using primary sakura pink for selected states, accented with smooth transition micro-animations.

### Additional Recommended Components
- **Quick-Add Floating Action Button (FAB):** A prominent sakura pink circular trigger anchored at the bottom thumb zone for instant expense logging.
- **Visual Budget Progress Rings:** Circular progress indicators utilizing mint green and coral red to track spending limits at a glance.