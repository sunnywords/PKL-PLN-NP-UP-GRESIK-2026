---
name: Serene Glow
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#50453b'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#82756a'
  outline-variant: '#d4c4b7'
  surface-tint: '#1e3a8a'
  primary: '#1e3a8a'
  on-primary: '#ffffff'
  primary-container: '#d4a373'
  on-primary-container: '#5b3912'
  inverse-primary: '#f0bd8b'
  secondary: '#566342'
  on-secondary: '#ffffff'
  secondary-container: '#d7e5bb'
  on-secondary-container: '#5a6745'
  tertiary: '#a33d23'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff8d70'
  on-tertiary-container: '#7a2008'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#3b82f6'
  primary-fixed-dim: '#f0bd8b'
  on-primary-fixed: '#2c1600'
  on-primary-fixed-variant: '#623f18'
  secondary-fixed: '#dae8be'
  secondary-fixed-dim: '#becca3'
  on-secondary-fixed: '#141f05'
  on-secondary-fixed-variant: '#3f4b2c'
  tertiary-fixed: '#ffdad2'
  tertiary-fixed-dim: '#ffb4a2'
  on-tertiary-fixed: '#3c0700'
  on-tertiary-fixed-variant: '#83260e'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  margin: 20px
  gutter: 16px
---

## Brand & Style

This design system is anchored in the emotional needs of parents: the desire for tranquility, safety, and a restful environment. The brand personality is nurturing and dependable, prioritizing a "low-cognitive-load" experience that feels like a natural extension of a nursery.

The aesthetic combines **Minimalism** with **Glassmorphism**. High amounts of whitespace ensure the interface feels breathable, while translucent layers provide a sense of depth and modern sophistication. The overall style is "Soft Modern"—avoiding the coldness of traditional tech by using organic textures and light-diffusing effects that mimic the physical IoT lamp.

## Colors

The palette is derived from natural earth tones to promote relaxation. 
- **Warm Cream (#FDFBF7)**: Used as the primary canvas to prevent the eye-strain associated with pure white.
- **Light Brown (#D4A373)**: The primary brand color, used for grounding elements and core interactions.
- **Sage Green (#A3B18A)**: Represents the mosquito repellent functionality, signaling safety and organic protection.
- **Soft Terracotta (#E76F51)**: Used for sleep schedules and evening routines, evoking a sunset.
- **Amber/Yellow (#FFB703)**: A functional accent reserved strictly for light-based controls (brightness, lamp on/off).

## Typography

The design system utilizes **Plus Jakarta Sans** for its friendly, open apertures and slightly rounded terminals. This typeface maintains a balance between professional clarity and approachable warmth. 

Headlines use a tighter letter-spacing and heavier weights to create a sense of hierarchy without feeling aggressive. Body text is prioritized for legibility with generous line heights, ensuring parents can read the screen easily even in low-light environments or while multi-tasking.

## Layout & Spacing

The layout follows a **Fixed Grid** model within a mobile-first context, utilizing a 4-column system for handheld devices. The spacing rhythm is built on an 8px baseline to maintain mathematical harmony.

Generous internal padding within cards (md/24px) creates a spacious, "uncluttered" feeling. Content is grouped logically into modules with large vertical margins (lg/40px) to distinguish between different device functions (e.g., separating Lamp controls from Repellent settings).

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and **Ambient Shadows**. Instead of traditional deep shadows, this design system uses soft, wide-dispersion blurs (20-40px) with low opacity (10%) tinted by the Primary Light Brown color.

Cards utilize a semi-transparent background (White at 60% opacity) with a `backdrop-filter: blur(12px)`. This creates a layered effect where the background colors peek through, simulating a soft glow. A thin, 1px border with 20% opacity is used on glass elements to define edges without adding visual weight.

## Shapes

The shape language is defined by **Softness**. Square corners are entirely avoided to maintain the family-friendly and "safe" aesthetic. 

Primary containers and cards use `rounded-xl` (1.5rem / 24px) to mimic the smooth, injection-molded plastic of high-end IoT hardware. Interactive elements like buttons and input fields utilize a similar roundedness to ensure a tactile, "squishy" feel that invites touch.

## Components

### Buttons
Primary buttons use a solid fill of Light Brown or Sage Green with white text. They feature a subtle "inner glow" gradient to appear slightly convex and tactile. Floating Action Buttons (FABs) for quick "All Off" functions should use the Soft Terracotta color.

### Cards
All cards are glassmorphic. They should include a subtle 1px stroke in a lighter shade of the background to ensure they stand out against the Warm Cream canvas.

### Inputs & Controls
- **Light Sliders**: Use the Amber/Yellow accent for the track and handle, featuring a soft outer glow when active.
- **Toggles**: Large, pill-shaped toggles. When "On," the Sage Green color should be used to indicate a safe, active repellent state.
- **Time Pickers**: Use a circular dial metaphor with Soft Terracotta accents to represent the sleep cycle.

### Indicators
Small, pulsing glow indicators are used to show the connection status of the IoT hardware, appearing as a soft breathing light rather than a sharp blinking LED.