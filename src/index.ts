import { pack2D, type Box2D } from 'binpackingjs/2d'
import type { Bin, Block, PlacedBin, PlacedBlock, PlaceurOptions, PlaceurResult } from './api-types'


function packColumns(bin: Bin, blocks: Block[]): { placed: PlacedBlock[], remaining: Block[] } {
  const { count, gutter } = bin.columns!
  const columnWidth = (bin.width - gutter * (count - 1)) / count
  if (columnWidth <= 0) {
    return { placed: [], remaining: [...blocks] }
  }

  const cols = Array.from({ length: count }, (_, i) => ({
    x: i * (columnWidth + gutter),
    y: 0,
  }))

  const sorted = [...blocks].sort((a, b) => {
    const areaA = columnWidth * a.heightForWidth(columnWidth)
    const areaB = columnWidth * b.heightForWidth(columnWidth)
    return areaB - areaA
  })

  const placed: PlacedBlock[] = []
  const remaining: Block[] = []

  for (const block of sorted) {
    const h = block.heightForWidth(columnWidth)
    if (h <= 0) {
      remaining.push(block)
      continue
    }

    let placedIn = false
    for (const col of cols) {
      if (col.y + h <= bin.height) {
        placed.push({
          block,
          width: columnWidth,
          height: h,
          x: col.x,
          y: col.y,
        })
        col.y += h
        placedIn = true
        break
      }
    }

    if (!placedIn) {
      remaining.push(block)
    }
  }

  return { placed, remaining }
}

function packSimple(bin: Bin, blocks: Block[]): { placed: PlacedBlock[], remaining: Block[] } {
  type Entry = { block: Block; w: number; h: number }
  const entries: Entry[] = blocks.map((block) => {
    const w = Math.min(block.maxWidth ?? bin.width, bin.width)
    const h = block.heightForWidth(w)
    return { block, w, h }
  })

  const boxToEntry = new Map<Box2D, Entry>()
  const packBoxes: Box2D[] = entries.map((e) => {
    const box: Box2D = { width: e.w, height: e.h }
    boxToEntry.set(box, e)
    return box
  })

  const result = pack2D({
    bins: [{ width: bin.width, height: bin.height }],
    boxes: packBoxes,
  })

  const placed: PlacedBlock[] = []
  const placedSet = new Set<Block>()

  const packedBin = result.packedBins[0]
  if (packedBin) {
    for (const pb of packedBin.boxes) {
      const entry = boxToEntry.get(pb.sourceBox as Box2D)
      if (entry) {
        placed.push({
          block: entry.block,
          width: pb.width,
          height: pb.height,
          x: pb.x,
          y: pb.y,
        })
        placedSet.add(entry.block)
      }
    }
  }

  const remaining = blocks.filter((b) => !placedSet.has(b))
  return { placed, remaining }
}

function packBin(bin: Bin, blocks: Block[]): { placed: PlacedBlock[], remaining: Block[] } {
  if (bin.columns) {
    return packColumns(bin, blocks)
  }
  return packSimple(bin, blocks)
}

function computeEfficiency(bin: Bin, placed: PlacedBlock[]): number {
  const binArea = bin.width * bin.height
  if (binArea <= 0) return 0
  const used = placed.reduce((sum, b) => sum + b.width * b.height, 0)
  return (used * 100) / binArea
}

export function placeur(options: PlaceurOptions): PlaceurResult {
  const { bins, blocks } = options
  const placedBins: PlacedBin[] = []
  let remaining = [...blocks]

  for (const bin of bins) {
    if (remaining.length === 0) break
    const result = packBin(bin, remaining)
    if (result.placed.length > 0) {
      placedBins.push({
        bin,
        blocks: result.placed,
        efficiency: computeEfficiency(bin, result.placed),
      })
    }
    remaining = result.remaining
  }

  return { bins: placedBins, unpacked: remaining }
}

export type { Bin, Block, PlacedBin, PlacedBlock, PlaceurOptions, PlaceurResult } 
