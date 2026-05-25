import type { Bin, Block, PlacedBlock } from './api-types'

export function packColumns(bin: Bin, blocks: Block[]): { placed: PlacedBlock[], remaining: Block[] } {
  const { count, gutter } = bin.columns!
  const colWidth = (bin.width - gutter * (count - 1)) / count
  if (colWidth <= 0) {
    return { placed: [], remaining: [...blocks] }
  }

  const cols = new Array<number>(count).fill(0)

  const sorted = [...blocks].sort((a, b) => {
    const areaA = colWidth * a.heightForWidth(colWidth)
    const areaB = colWidth * b.heightForWidth(colWidth)
    return areaB - areaA
  })

  const placed: PlacedBlock[] = []
  const remaining: Block[] = []

  for (const block of sorted) {
    let placedIn = false

    for (let span = 1; span <= count; span++) {
      const w = span * colWidth + (span - 1) * gutter
      const h = block.heightForWidth(w)
      if (h <= 0) continue

      for (let start = 0; start <= count - span; start++) {
        let maxY = 0
        for (let c = start; c < start + span; c++) {
          if (cols[c] > maxY) maxY = cols[c]
        }

        if (maxY + h <= bin.height) {
          const x = start * (colWidth + gutter)
          placed.push({ block, width: w, height: h, x, y: maxY })
          for (let c = start; c < start + span; c++) {
            cols[c] = maxY + h
          }
          placedIn = true
          break
        }
      }

      if (placedIn) break
    }

    if (!placedIn) {
      remaining.push(block)
    }
  }

  return { placed, remaining }
}
