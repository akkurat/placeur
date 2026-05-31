import type { Bin, PlacedBlock } from "./api-types.js";
import type { AsciiBlock } from "./placement-block.js";

import { pack2D, type Box2D } from 'binpackingjs/2d'


export interface PlacedAsciiBlock {
  block: AsciiBlock
  x: number
  y: number
  width: number
  height: number
}
export function packIntrinsicWidth(page: Bin, blocks: AsciiBlock[]): PlacedAsciiBlock[] {




  pack2D()

  return []
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
    buckets.set(size, size + 1)
  }

  return buckets

}

