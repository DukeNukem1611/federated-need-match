---
name: High-Tech Precision
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#859399'
  outline-variant: '#3c494e'
  surface-tint: '#4cd6ff'
  primary: '#a4e6ff'
  on-primary: '#003543'
  primary-container: '#00d1ff'
  on-primary-container: '#00566a'
  inverse-primary: '#00677f'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#d1ddf5'
  on-tertiary: '#263143'
  tertiary-container: '#b6c1d8'
  on-tertiary-container: '#444f62'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b7eaff'
  primary-fixed-dim: '#4cd6ff'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#004e60'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin: 32px
  section-gap: 80px
---

## Brand & Style
The design system is engineered for high-performance hackathon environments where clarity meets innovation. The brand personality is authoritative yet forward-thinking, evoking the feeling of a sophisticated command center. It balances a "dark mode" aesthetic with high-energy accents to signal technical proficiency and reliability.

The design style blends **Modern Corporate** structure with **Glassmorphism** accents. This approach ensures the interface feels lightweight and futuristic without sacrificing the professional utility required for complex data visualization and rapid user task completion.

## Colors
The palette is rooted in deep, atmospheric tones to provide a high-contrast foundation for technical work. 

- **Primary (Electric Blue):** Used for critical actions, active states, and highlighting key data points. It acts as the "light" in the interface.
- **Secondary (Deep Charcoal/Navy):** The primary background color, providing a stable, low-eye-strain environment.
- **Tertiary (Slate):** Used for elevated surfaces like cards, sidebars, and nested containers.
- **Neutral (Muted Blue-Grey):** Reserved for secondary text, borders, and decorative elements that require lower visual hierarchy.

Backgrounds should utilize subtle radial gradients (e.g., a faint primary color glow in a corner) to prevent the dark interface from feeling "flat" or "heavy."

## Typography
The typography strategy employs a "system-meets-science" aesthetic. **Space Grotesk** is used for headlines to provide a technical, geometric edge that feels innovative. **Inter** is used for all functional body text and UI labels to ensure maximum legibility across various screen densities.

Large headlines should use tight letter-spacing to feel impactful, while functional labels should use increased tracking (letter-spacing) to improve readability at small sizes. Use the `mono-data` style specifically for numerical outputs, code snippets, or status indicators.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for main content areas. To achieve the requested "plenty of whitespace" vibe, the layout prioritizes generous vertical margins between sections (`section-gap`).

Spacing follows a strict 8px linear scale. Internal component padding should be airy; for example, cards should rarely have less than 24px of internal padding. Align elements to the grid but allow for "breakout" elements—like wide code blocks or full-width data visualizations—to create a dynamic, modern feel.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

- **Level 0 (Base):** The secondary color (#0F172A).
- **Level 1 (Cards/Panels):** A slightly lighter tertiary color with a 1px subtle border (#FFFFFF at 10% opacity).
- **Level 2 (Modals/Popovers):** A semi-transparent surface with a `backdrop-filter: blur(12px)` and a subtle outer glow using the primary color at very low opacity (5-10%).

Borders serve as the primary divider. Instead of solid black or white, borders should use a "tinted" approach—using a lighter version of the background color to maintain a crisp, high-tech look.

## Shapes
The shape language is characterized by **Precision**. A "Soft" roundedness (Level 1) is applied to maintain a professional and engineered feel. 

Avoid fully circular buttons unless they are icon-only; instead, use the standard 0.25rem (4px) radius for buttons and 0.5rem (8px) for cards. This slight rounding takes the edge off the "Brutalist" look while remaining more serious and "high-tech" than pill-shaped designs.

## Components

### Buttons
Primary buttons use the primary electric blue with white or dark-navy text. Hover states should include a subtle "bloom" effect (outer glow). Secondary buttons use an outline style with the 1px tinted border.

### Cards
Cards are the cornerstone of the layout. They should feature a subtle gradient background—starting from the tertiary color and fading slightly darker. Interactive cards should have a primary-colored top border (2px) that appears on hover.

### Input Fields
Inputs are dark-themed with a subtle "inner-glow" look. The focus state is critical: the border should transition to the primary color with a soft outer glow to guide user attention.

### Chips & Status Indicators
Chips should be used for tags or categories. For status (e.g., "Live", "Complete"), use a small dot next to the text. The dot should have a "pulse" animation for active states to emphasize the "high-tech/live" nature of the project.

### Data Visualization
Charts should use the primary electric blue as the main data line. Use a secondary accent (like a vibrant teal or violet) only when multiple data sets are required. Grids within charts should be kept at 5% opacity to remain unobtrusive.