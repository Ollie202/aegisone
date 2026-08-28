# Playful Neo-Brutalist Web Design Skill

## Purpose

Use this skill when designing or rebuilding a frontend in a bold editorial style that blends:

- neo-brutalism
- Memphis-style graphics
- retro-futurist / Y2K tech illustration
- editorial web layout
- vector-comic illustration
- controlled anti-grid composition

The target look should feel playful, graphic, unconventional, modern, and intentionally composed — not like a generic SaaS landing page.

This skill defines a reusable visual system. Do not copy any reference image literally. Recreate the design language, hierarchy, rhythm, and visual behavior while making the final interface original to the product.

---

## When to Invoke

Invoke this skill when the user asks for frontend work using language such as:

- playful neo-brutalism
- editorial brutalism
- Memphis web design
- Y2K tech aesthetic
- retro-futurist landing page
- illustrated startup website
- bold asymmetric UI
- anti-grid layout
- chunky outlined interface
- playful product landing page

Also invoke it when a visual reference contains most of these traits:

- oversized black typography
- black outlined containers
- pastel + high-saturation accent colors
- floating vector objects
- irregular or overlapping composition
- outlined pill buttons
- flat illustration with minimal shading
- asymmetry with strong visual balance

---

# 1. Core Visual DNA

The interface should combine structure with controlled chaos.

The page must still be easy to understand, but it should not look like a conventional card-grid SaaS template.

Aim for:

**70% disciplined layout + 30% visual disruption.**

The disruption can come from:

- objects escaping container bounds
- tilted illustrations
- overlapping sections
- floating stickers
- intentionally oversized artwork
- asymmetrical spacing
- off-axis labels
- unexpected object placement

Do not let the disruption damage readability or interaction.

---

# 2. Layout Language

## Primary composition

Prefer large editorial compositions over repeated boxed sections.

Typical hero structure:

- large framed canvas or panel
- small navigation tucked into a corner or side rail
- dominant central illustration or object cluster
- oversized headline anchored to the lower-left or lower-middle
- compact CTA group
- decorative objects partially outside the main frame

## Grid

Use a real layout grid underneath the visual chaos.

Recommended desktop foundation:

- 12-column grid
- generous outer margins
- 24–40px internal gaps
- large negative-space zones
- asymmetrical content distribution

Avoid perfectly centered everything.

## Containers

Preferred container styling:

- 1.5–3px solid dark outline
- 20–40px radius for large panels
- flat fill
- little or no shadow
- occasional intentional overflow

Do not overuse cards.

A page should feel like one graphic composition rather than twenty isolated UI rectangles.

---

# 3. Color System

Use a small but loud palette.

A strong default palette:

- ink black: `#0A0A0A`
- warm yellow: `#FFD91A`
- lavender: `#B79CFF`
- electric cyan: `#22DCEB`
- soft periwinkle / pale blue: `#D8E1FF`
- off-white: `#F7F5EF`

The exact values may change by brand.

## Rules

- Use black as the structural color for typography and outlines.
- Use 2–3 vivid accents at most per viewport.
- Prefer large flat color fields over gradients.
- If gradients are used, they should be rare and deliberate.
- Avoid muted corporate palettes.
- Avoid the typical purple-to-blue AI startup gradient.

Color should separate major visual zones, not decorate every element.

---

# 4. Typography

Typography is one of the main visual objects.

## Headings

Use:

- heavy grotesk / neo-grotesk sans serif
- tight tracking
- strong weight contrast
- very large scale

Suggested CSS behavior:

```css
font-weight: 700-900;
letter-spacing: -0.04em;
line-height: 0.9-1.02;
```

Hero headlines should often span multiple lines and occupy a major percentage of the composition.

Good examples of the intended hierarchy:

- 64–120px desktop hero type
- 42–72px tablet
- 38–58px mobile

Use `clamp()` for responsive scaling.

## Body text

Keep body copy simple and functional.

- medium size
- neutral sans serif
- comfortable line height
- narrow measure

Avoid long marketing paragraphs.

## Accent typography

A single word may use:

- an outlined pill treatment
- contrasting fill
- custom underline
- alternate color
- rounded glyph treatment

Do this sparingly.

---

# 5. Illustration Language

Illustration is central to this style.

## Preferred visual style

- flat vector shapes
- heavy dark outlines
- simplified geometry
- slightly exaggerated perspective
- minimal shading
- cartoon-like physical objects
- tech hardware, tools, arrows, coins, folders, cubes, screens, connectors, devices

Illustrations should look designed for the page, not dropped in as stock art.

## Shape behavior

Use:

- tilted boxes
- cubes
- arrows
- loops
- abstract tools
- detached parts
- stickers
- floating tokens
- exaggerated hands
- simplified machines

Combine recognizable objects with abstract geometry.

## Avoid

- generic 3D SaaS blobs
- glossy clay renders
- photorealistic stock art
- stock corporate people
- glassmorphism illustrations
- overly detailed scenes
- repeated AI-generated floating spheres

---

# 6. Linework

Dark linework is critical.

Use black or near-black strokes on:

- illustrations
- buttons
- large containers
- chips
- iconography
- stickers

Recommended stroke impression:

- thin UI line: 1–1.5px
- normal border: 2px
- illustration outline: 2–4px depending on scale

The outline should make elements feel printed, comic-like, and tactile.

---

# 7. Buttons and Controls

Buttons should feel graphic rather than system-default.

Preferred CTA styles:

### Primary

- saturated fill
- dark text
- outlined or borderless depending on surrounding composition
- compact arrow icon
- slightly exaggerated horizontal padding
- modest rounded corners or pill shape

### Secondary

- transparent or pale fill
- 1.5–2px black border
- black text

### Chips / filters

- small pill
- dark outline
- icon or colored miniature square
- tight spacing

Buttons should not have heavy gradients, glass blur, or oversized shadows.

---

# 8. Navigation

Navigation can be unconventional but must remain obvious.

Valid approaches:

- slim vertical rail on desktop
- tiny top-right utility links
- mixed vertical + horizontal navigation
- numbered navigation items
- compact logo mark in a corner

On mobile, collapse into a conventional menu if necessary.

Do not sacrifice usability just to preserve asymmetry.

---

# 9. Controlled Anti-Grid

The design should look like it breaks the grid without actually being unstructured.

Use these techniques:

- artwork rotated `-6deg` to `6deg`
- decorative elements translated outside containers
- labels attached at unusual corners
- object clusters crossing section boundaries
- large empty regions opposite dense illustration clusters
- vertical text or edge labels

Every decorative disruption must have a reason.

If removing an object makes the composition cleaner without losing character, the object was probably unnecessary.

---

# 10. Depth and Effects

This style is mostly flat.

Use depth through:

- overlap
- layering
- scale
- outline thickness
- alternating flat colors

Avoid relying on:

- drop shadows everywhere
- blur
- glassmorphism
- glossy highlights
- heavy 3D rendering

If a shadow is used, use a hard offset shadow rather than a soft floating shadow.

Example:

```css
box-shadow: 6px 6px 0 #0A0A0A;
```

Use sparingly.

---

# 11. Motion

Motion should amplify the playful physicality.

Good motion:

- 2–5px hover translations
- tiny rotations
- arrows nudging forward
- floating decorative objects with slow subtle movement
- illustration pieces reacting independently
- marquee-like editorial labels
- button press states that physically shift

Avoid:

- excessive parallax
- constant large movement
- random bouncing objects
- long cinematic transitions

Animations should generally remain between 150ms and 500ms for interaction states.

Ambient decorative animation can be slower.

Respect `prefers-reduced-motion`.

---

# 12. Responsive Behavior

Do not merely shrink the desktop composition.

On mobile:

- retain the bold headline
- reduce decorative objects
- simplify overlap
- preserve one main illustration cluster
- convert side navigation to top navigation or menu
- stack CTAs when necessary
- keep oversized visual moments where they still work

The mobile composition should feel intentionally redesigned.

Decorative objects may be hidden on small screens if they interfere with hierarchy.

---

# 13. Implementation Defaults

For React / Next.js implementations, prefer:

- semantic HTML
- CSS Grid for structural composition
- Flexbox for local alignment
- absolute positioning only for intentional decorative layers
- SVG for custom illustrations where possible
- responsive `clamp()` typography
- CSS custom properties for palette
- reusable primitives for outlined buttons, pills, frames, and stickers

Example token setup:

```css
:root {
  --ink: #0a0a0a;
  --yellow: #ffd91a;
  --lavender: #b79cff;
  --cyan: #22dceb;
  --periwinkle: #d8e1ff;
  --paper: #f7f5ef;
  --border: 2px solid var(--ink);
  --radius-lg: 32px;
  --radius-sm: 12px;
}
```

---

# 14. Component Vocabulary

Useful reusable components for this style:

- `GraphicFrame`
- `OutlinedButton`
- `AccentButton`
- `PillTag`
- `FloatingSticker`
- `IllustrationCluster`
- `VerticalNav`
- `EditorialHeadline`
- `EdgeLabel`
- `OutlinedCard`
- `MarqueeLabel`

Do not create components solely for abstraction. Reuse only where it improves consistency or maintainability.

---

# 15. Hero Formula

A reliable hero formula for this design language:

1. Large pale or colored page background.
2. Main rounded outlined frame occupying 80–95% of viewport width.
3. Brand mark near top-left.
4. Sparse navigation placed asymmetrically.
5. Dominant custom illustration occupying roughly 40–60% of the hero.
6. Three small category pills above the headline.
7. Massive 2–4 line headline.
8. Primary + secondary CTA near headline.
9. Two to five decorative objects breaking the frame boundary.
10. One accent color used to emphasize a key word or object.

This is a composition recipe, not a mandatory template.

---

# 16. Design Restraint Rules

Do NOT turn every element into a gimmick.

For every viewport, choose only a few visual heroes:

- one major headline
- one major illustration
- one primary color field
- a few supporting decorative elements

Everything else should support those elements.

The page should feel intentional, not noisy.

---

# 17. Anti-Patterns

Reject these unless the product specifically requires them:

- generic centered SaaS hero
- gradient orb backgrounds
- glass cards
- endless three-column feature cards
- random floating emojis
- giant rounded rectangles everywhere
- excessive shadows
- weak gray typography
- generic Lucide icon grids as the main design language
- blue/purple AI gradients
- stock 3D illustrations
- excessive centered text
- every section having identical spacing and structure

If the page looks like it could belong to any startup after swapping the logo, the design has failed.

---

# 18. Originality Rule

When working from a reference:

Preserve:

- visual rhythm
- palette logic
- typography hierarchy
- outline language
- illustration philosophy
- asymmetry
- density
- level of playfulness

Change:

- composition
- illustration subjects
- copy structure
- navigation placement where appropriate
- decorative motifs
- exact colors if brand requirements differ

Never reproduce the source layout pixel-for-pixel.

---

# 19. Build Process

When applying this skill to a new product:

## Step 1 — Understand the product

Identify:

- what the product does
- primary CTA
- brand personality
- audience
- most important product concept to visualize

## Step 2 — Choose the visual metaphor

Create one central illustration concept that explains the product.

Examples:

- automation product → machine routing tasks
- developer tool → modular terminal/device system
- payments product → pipes, coins, connectors, rails
- agent platform → devices or characters exchanging tasks
- infrastructure → machinery, containers, cables, nodes

## Step 3 — Establish palette

Pick:

- 1 neutral background
- 1 dark ink
- 2 primary accents
- optional 1 secondary accent

## Step 4 — Establish hierarchy

Design the headline and hero illustration before secondary sections.

## Step 5 — Add controlled disruption

Only after the core layout works, add:

- floating stickers
- overlaps
- rotations
- boundary-breaking artwork

## Step 6 — Remove noise

Delete decorative elements until the page feels energetic but readable.

---

# 20. Acceptance Checklist

Before considering the frontend complete, verify:

- [ ] The page has a clear visual hierarchy within 2 seconds.
- [ ] The primary CTA is immediately obvious.
- [ ] Typography feels editorial and intentionally oversized.
- [ ] Black linework is used consistently.
- [ ] The palette contains only a few strong colors.
- [ ] The page includes at least one original visual metaphor or illustration cluster.
- [ ] Decorative objects support the composition instead of randomly filling space.
- [ ] The layout is asymmetric without feeling broken.
- [ ] The interface does not look like a generic SaaS template.
- [ ] Cards are not overused.
- [ ] There are no unnecessary gradients or glass effects.
- [ ] Mobile has been recomposed rather than simply scaled down.
- [ ] Text remains readable and interactions remain obvious.
- [ ] Motion is subtle and purposeful.
- [ ] `prefers-reduced-motion` is respected.
- [ ] Accessibility contrast is acceptable.
- [ ] The final work is inspired by the design language, not copied from a reference.

---

# Invocation Shortcut

When using this skill with another coding agent, a short instruction can be:

> Apply `frontend_design/playful_neo_brutalist_web.md` to the frontend. Keep the product UX clear, but make the composition bold, illustrated, asymmetric, outlined, editorial, and distinctly non-generic. Do not copy a reference literally.
