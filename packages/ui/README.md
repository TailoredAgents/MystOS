# @myst-os/ui

## Button component quick reference

```tsx
import { Button } from "@myst-os/ui";

<Button variant="primary">Schedule Estimate</Button>
```

- Variants: `primary`, `secondary`, `ghost`
- Sizes: `sm`, `md`, `lg`
- Motion & accessibility: built-in hover/press lift, `focus-visible` ring, and disabled state handling.
- Icon spacing: buttons include a default `gap-2`, so icons can sit comfortably next to text: ` <Button><Icon />Call</Button>`
- Surface tone (`tone` prop): control the ring offset color when a button sits on dark or tinted surfaces.

```tsx
<Button tone="dark">Hero CTA</Button>
<Button variant="secondary" tone="sand">Schedule</Button>
<Button variant="ghost" tone="light">Learn more</Button>
```

### Focus ring tones

| `tone` value | Ring offset |
|--------------|-------------|
| `light`      | `focus-visible:ring-offset-white` |
| `dark`       | `focus-visible:ring-offset-primary-900` |
| `sand`       | `focus-visible:ring-offset-sand-100` |
| `transparent`| `focus-visible:ring-offset-transparent` |

All variants pick sensible defaults (`primary` → `dark`, `secondary` → `sand`, `ghost` → `light`), but you can override per usage with the `tone` prop.
