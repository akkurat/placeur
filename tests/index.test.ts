import { expect, test } from 'vitest'
import { placeur, type Block, type Bin } from '../src'

let nextId = 0;

function rect(w: number, h: number): Block {
  return { id: nextId++ + "", heightForWidth: () => h }
}

test('places blocks into two columns', () => {
  const bin: Bin = { width: 200, height: 100, columns: { count: 2, gutter: 10 } }
  const blocks = [rect(50, 80), rect(50, 60)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.unpacked).toHaveLength(0)
  expect(result.bins[0].blocks).toHaveLength(2)

  const colW = 95
  const [a, b] = result.bins[0].blocks
  expect(a.x).toBe(0)
  expect(a.y).toBe(0)
  expect(a.width).toBe(colW)
  expect(b.x).toBe(colW + 10)
  expect(b.y).toBe(0)
})
test('long and short lines', () => {
  const bin: Bin = { width: 200, height: 200, columns: { count: 4, gutter: 0 } }
  const blocks: Block[] = [{ id: 'bigefficient', heightForWidth: w => w < 195 ? 300 : 100 },
  ...[...Array(5).keys()].map(i => ({ id: `smallefficient${i}`, heightForWidth: (w: number) => w > 40 ? 90 : 40 / w * 90 }))

  ]
  const result = placeur({ bins: [bin], blocks })
  expect(result.unpacked).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'smallefficient4' })]))

})

test('stacks blocks vertically in same column (sorted by height descending)', () => {
  const bin: Bin = { width: 200, height: 200, columns: { count: 1, gutter: 0 } }
  const blocks = [rect(200, 50), rect(200, 70), rect(200, 30)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.unpacked).toHaveLength(0)

  const placed = result.bins[0].blocks
  // sorted by height desc: h=70, h=50, h=30
  expect(placed[0].y).toBe(0)
  expect(placed[1].y).toBe(70)
  expect(placed[2].y).toBe(120)
})

test('overflows to a second bin', () => {
  const bin: Bin = { width: 100, height: 100, columns: { count: 1, gutter: 0 } }
  const blocks = [rect(100, 80), rect(100, 80)]
  const result = placeur({ bins: [bin, bin], blocks })

  expect(result.bins).toHaveLength(2)
  expect(result.unpacked).toHaveLength(0)

  expect(result.bins[0].blocks).toHaveLength(1)
  expect(result.bins[1].blocks).toHaveLength(1)
})

test('returns unpacked blocks when no bin fits', () => {
  const bin: Bin = { width: 100, height: 10, columns: { count: 1, gutter: 0 } }
  const blocks = [rect(100, 20), rect(100, 20)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(0)
  expect(result.unpacked).toHaveLength(2)
})

test('uses heightForWidth callback with column width', () => {
  const bin: Bin = { width: 200, height: 200, columns: { count: 1, gutter: 0 } }

  let calledWith = 0
  const block: Block = {
    id: 'callback-test',
    heightForWidth(w) {
      calledWith = w
      return 50
    },
  }

  placeur({ bins: [bin], blocks: [block] })
  expect(calledWith).toBe(200)
})

test('sorts blocks by area descending so tallest is placed first', () => {
  const bin: Bin = { width: 100, height: 300, columns: { count: 1, gutter: 0 } }

  const blocks: Block[] = [
    { id: 'a', heightForWidth: () => 50 },
    { id: 'b', heightForWidth: () => 100 },
    { id: 'c', heightForWidth: () => 75 },
  ]

  const placed = placeur({ bins: [bin], blocks }).bins[0]?.blocks ?? []
  expect(placed).toHaveLength(3)
  // sorted by height desc: h=100, h=75, h=50
  expect(placed[0].y).toBe(0)
  expect(placed[1].y).toBe(100)
  expect(placed[2].y).toBe(175)
})

test('packs blocks without columns using binpackingjs', () => {
  const bin: Bin = { width: 100, height: 100 }
  const blocks = [rect(50, 50), rect(50, 50)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.unpacked).toHaveLength(0)
  expect(result.bins[0].blocks).toHaveLength(2)
})

test('handles blocks that fit column width', () => {
  const bin: Bin = { width: 100, height: 100, columns: { count: 2, gutter: 0 } }
  const blocks = [rect(50, 20)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.unpacked).toHaveLength(0)
  expect(result.bins[0].blocks).toHaveLength(1)
  expect(result.bins[0].blocks[0].width).toBe(50)
})

test('reports efficiency', () => {
  const bin: Bin = { width: 100, height: 100, columns: { count: 1, gutter: 0 } }
  const blocks = [rect(100, 50)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins[0].efficiency).toBe(50)
})

test('places blocks in next column when first column is full', () => {
  const bin: Bin = { width: 210, height: 50, columns: { count: 2, gutter: 10 } }
  // column width = 100
  const blocks = [rect(100, 40), rect(100, 40)]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.bins[0].blocks).toHaveLength(2)
  // block 2 goes to column 1 because column 0 is full
  expect(result.bins[0].blocks[1].x).toBe(110)
})

test('negative heightForWidth skips block', () => {
  const bin: Bin = { width: 100, height: 100, columns: { count: 1, gutter: 0 } }
  const blocks = [{ id: 'neg', heightForWidth: () => -1 }]
  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(0)
  expect(result.unpacked).toHaveLength(1)
})
