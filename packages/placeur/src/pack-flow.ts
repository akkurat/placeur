import type { Bin, Block, FlowLayoutResult, PlacedBlock } from './api-types.js'

export function flowLayout(bin: Bin, blocks: Block[]): FlowLayoutResult {
  const colCount = bin.columns?.count ?? 1
  const gutter = bin.columns?.gutter ?? 0
  const colWidth = (bin.width - gutter * (colCount - 1)) / colCount
  if (colWidth <= 0) {
    return { pages: [], unpacked: [...blocks] }
  }

  const cursor = new Array<number>(colCount).fill(0)
  const pages: PlacedBlock[][] = []
  const unpacked: Block[] = []
  let page: PlacedBlock[] = []
  let curCol = 0

  for (const block of blocks) {
    const span = Math.max(1, Math.min(block.span ?? 1, colCount))
    const w = span * colWidth + (span - 1) * gutter
    const h = block.heightForWidth(w)
    if (h <= 0) {
      unpacked.push(block)
      continue
    }

    let placed: PlacedBlock | null = null

    if (h <= bin.height) {
      // Try starting at curCol (left-to-right flow)
      for (let start = curCol; start <= colCount - span; start++) {
        let maxY = 0
        for (let c = start; c < start + span; c++) {
          if (cursor[c] > maxY) maxY = cursor[c]
        }
        if (maxY + h <= bin.height) {
          const x = start * (colWidth + gutter)
          placed = { block, width: w, height: h, x, y: maxY }
          for (let c = start; c < start + span; c++) {
            cursor[c] = maxY + h
          }
          curCol = start + span
          break
        }
      }

      // Back-fill: try starting from column 0 (below existing content)
      if (!placed) {
        const limit = Math.min(curCol, colCount - span)
        for (let start = 0; start <= limit; start++) {
          let maxY = 0
          for (let c = start; c < start + span; c++) {
            if (cursor[c] > maxY) maxY = cursor[c]
          }
          if (maxY + h <= bin.height) {
            const x = start * (colWidth + gutter)
            placed = { block, width: w, height: h, x, y: maxY }
            for (let c = start; c < start + span; c++) {
              cursor[c] = maxY + h
            }
            curCol = start + span
            break
          }
        }
      }
    }

    if (!placed) {
      if (page.length > 0) {
        pages.push(page)
      }
      page = []
      cursor.fill(0)
      curCol = 0

      if (h <= bin.height) {
        placed = { block, width: w, height: h, x: 0, y: 0 }
        for (let c = 0; c < span; c++) {
          cursor[c] = h
        }
        curCol = span
      }
    }

    if (placed) {
      page.push(placed)
    } else {
      unpacked.push(block)
    }
  }

  if (page.length > 0) {
    pages.push(page)
  }

  return { pages, unpacked }
}
