import { pack2D, type Box2D } from 'binpackingjs/2d'
import type { Bin, Block, PlacedBlock } from './api-types.js'

type Entry = { block: Block; w: number; h: number }

export function packSimple(bin: Bin, blocks: Block[]): { placed: PlacedBlock[], remaining: Block[] } {
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
