import type { Bin, Block, PlacedBlock } from "./api-types.js";

import { pack2D, type Box2D } from 'binpackingjs/2d'

export interface IntrinsicBlock extends Block {
  getLineSizes(): number[]
}

export function packIntrinsicWidth(page: Bin, blocks: IntrinsicBlock[]): PlacedBlock[][] {
  type Entry = { block: IntrinsicBlock; w: number; h: number }

  let bestResult: PlacedBlock[][] = []
  let bestEfficiency = -1

  for (const leeway of [0.5,0.6, 0.8, 0.9, 1]) {
    const entries: Entry[] = blocks.map(block => {
      const lineSizes = block.getLineSizes()
      const w = Math.min(intrinsicWidthThreshold(lineSizes, leeway), page.width)
      const h = block.heightForWidth(w)
      return { block, w, h }
    })

    const pages: PlacedBlock[][] = []
    let remaining = [...entries]

    while (remaining.length > 0) {
      const boxToEntry = new Map<Box2D, Entry>()
      const packBoxes: Box2D[] = remaining.map(e => {
        const box: Box2D = { width: e.w, height: e.h, constrainRotation: true }
        boxToEntry.set(box, e)
        return box
      })

      const result = pack2D({
        bins: [{ width: page.width, height: page.height }, { width: page.width, height: page.height }],
        boxes: packBoxes,
      })

      const pageBlocks: PlacedBlock[] = []
      const packedSet = new Set<Entry>()

      const packedBin = result.packedBins[0]
      if (packedBin) {
        for (const pb of packedBin.boxes) {
          const entry = boxToEntry.get(pb.sourceBox as Box2D)
          if (entry) {
            pageBlocks.push({
              block: entry.block,
              width: pb.width,
              height: pb.height,
              x: pb.x,
              y: pb.y,
            })
            packedSet.add(entry)
          }
        }
      }

      pages.push(pageBlocks)
      remaining = remaining.filter(e => !packedSet.has(e))
    }

    const totalUsed = pages.reduce((sum, pageBlocks) =>
      sum + pageBlocks.reduce((s, pb) => s + pb.width * pb.height, 0), 0)
    const totalBinArea = pages.length * page.width * page.height
    const efficiency = totalBinArea > 0 ? totalUsed / totalBinArea : 0

    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency
      bestResult = pages
    }
  }

  return bestResult
}

export function intrinsicWidthThreshold(sizes: number[], leeway: number) {
  if (leeway <= 0 || leeway > 1) {
    throw Error()
  }
  const sortedSizes = sizes
 .filter(s => s>0)
  .toSorted((a,b)=>a-b)
  const idx = Math.ceil(leeway * sortedSizes.length) - 1
  return sortedSizes[idx]
}

export function sizeCounts(sizes: number[]) {
  const buckets = new Map<number, number>()

  for (const size of sizes) {
    const count = buckets.get(size) ?? 0
    buckets.set(size, count + 1)
  }

  return buckets
}
