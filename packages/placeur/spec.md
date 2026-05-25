# placeur — spec

## Problem

Laying out text blocks on a page (e.g. A4) is not a fixed-rectangle bin-packing
problem: a block's height depends on the width it is rendered at. Line breaks
are non-linear — the same paragraph may be 10 lines at 300 px and 12 lines at
290 px. We need a bin packer that accounts for this variable height.

## Design

Stay agnostic: the library does **not** perform text layout itself. Instead,
each block exposes a `heightForWidth(width)` callback that the packer calls to
discover what height the block would occupy at a given width.

The discrete widths to try are not defined per block — they come from the
**bin's layout scheme** (e.g. columns, grid cells). A bin defines a set of
available slot widths, and blocks are assigned to those slots. This matches
real page layout: you have an A4 page, you decide on a column grid (2-col,
3-col, …), and blocks flow into those columns.

## Core types

```typescript
interface Block {
  /** Returns the height of this block when laid out at `width`. */
  heightForWidth(width: number): number

  /** Hard constraints (optional). */
  minWidth?: number
  maxWidth?: number
}

interface Bin {
  width: number
  height: number
  /** Defines the available slot widths within this bin. */
  columns?: ColumnLayout
}

interface ColumnLayout {
  /** Number of equal-width columns (gutter is subtracted from each). */
  count: number
  /** Gap between columns, in same unit as bin dimensions. */
  gutter: number
}

/** A block that has been assigned a specific width and placed. */
interface PlacedBlock {
  readonly block: Block
  readonly width: number
  readonly height: number
  readonly x: number
  readonly y: number
}

interface PlacedBin {
  readonly bin: Bin
  readonly blocks: PlacedBlock[]
  readonly efficiency: number
}

interface PlaceurResult {
  readonly bins: PlacedBin[]
  readonly unpacked: Block[]
}
```

The column width for equal-width columns is derived as:
```
columnWidth = (bin.width - gutter * (count - 1)) / count
```

## API

```typescript
import { placeur } from 'placeur'

const result = placeur({
  bins: [
    {
      width: 210, height: 297,         // A4 in mm
      columns: { count: 2, gutter: 20 },
    },
  ],
  blocks: [
    {
      heightForWidth(w) { return measureText(content, w) },
    },
    // …
  ],
})
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bins` | `Bin[]` | required | Available containers |
| `blocks` | `Block[]` | required | Blocks to place |

## Algorithm

A bin that has `columns` produces `count` placement slots, each with a fixed
width. The bin is also subdivided vertically: each column acts as a vertical
strip where blocks stack from top to bottom.

1. **Column widths** — Compute column width from `columns.count` and
   `columns.gutter`. All columns share the same width.
2. **Placement** — For each block, in descending order of max-area:
   - For each column (left to right), call `heightForWidth(columnWidth)`.
   - If the block fits in the remaining vertical space of that column, place it
     and advance the column's y-offset.
   - If no column fits, open a new bin.
3. **Result** — Return placed positions and any blocks that could not be placed.

### Bins without columns

If a bin has no `columns`, the packer falls back to standard 2D bin packing
with the block's `maxWidth` (or `bin.width` if unset) as the box width.

## Edge cases

- **Block wider than column** — candidate rejected; block cannot be placed in
  this bin layout.
- **Block taller than bin** — cannot fit; returned as `unpacked`.
- **`heightForWidth` returns 0 or negative** — treated as invalid.
- **`columns.count === 0` or negative** — treated as no columns (fallback).

## Future work

- Explicit column-width arrays (not just equal-width).
- Row / grid layouts (not just vertical stacking).
- Mixed column layouts within one bin.
- Multi-bin optimisation (minimise total pages).
- Integration with text-measurement libraries (jspdf, etc.).
