import { AsciiBlock } from '../src/placement-block.js'


export function renderAsciiLayout(
  blocks: PlacedAsciiBlock[],
  binWidth: number,
  binHeight: number,
): string {
  const grid: string[][] = Array.from({ length: binHeight }, () =>
    Array(binWidth).fill(" "),
  )

  for (const pb of blocks) {
    const fitting = pb.block.height(pb.width)
    for (let row = 0; row < fitting.height && pb.y + row < binHeight; row++) {
      const line = fitting.content[row] ?? ""
      for (let col = 0; col < line.length && pb.x + col < binWidth; col++) {
        grid[pb.y + row][pb.x + col] = line[col]
      }
    }
  }

  return grid.map(row => row.join("")).join("\n")
}
