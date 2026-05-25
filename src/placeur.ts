import type { Bin, Block, PlacedBin, PlacedBlock, PlaceurOptions, PlaceurResult } from './api-types.js'
import { packColumns } from './pack-columns.js'
import { packSimple } from './pack-simple.js'

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
