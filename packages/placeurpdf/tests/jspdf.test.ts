import { beforeEach, expect, test } from 'vitest'
import { existsSync, writeFileSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { generatePdf } from '../src/index.js'

beforeEach(() => {
  if (!existsSync('test-output')) mkdirSync('test-output')
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'placeurpdf-test-'))
}

function file(dir: string, name: string, content: string) {
  writeFileSync(join(dir, name), content, 'utf-8')
}

function textXPositions(pdfPath: string, textFilter: string): string[] {
  const pdf = readFileSync(pdfPath, 'utf-8')
  return [...new Set(
    pdf.split('Tj')
      .filter(b => b.includes(textFilter))
      .map(p => p.match(/([\d.]+) ([\d.]+) Td[^)]/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(m => (parseFloat(m[1]) / 2.8346).toFixed(1))
  )].sort((a, b) => parseFloat(a) - parseFloat(b))
}

// --- orientation ---

test('defaults to landscape', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Hello')
  const doc = generatePdf({ inputDir: dir, output: '/dev/null' })
  expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight())
})

test('portrait', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Hello')
  const doc = generatePdf({ inputDir: dir, output: '/dev/null', orientation: 'portrait' })
  expect(doc.internal.pageSize.getWidth()).toBeLessThan(doc.internal.pageSize.getHeight())
})

// --- overflow ---

test('long content overflows to multiple pages', () => {
  const dir = tmpDir()
  file(dir, 'x.txt', 'Words to fill pages. '.repeat(400))
  const doc = generatePdf({ inputDir: dir, output: '/dev/null' })
  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
})

// --- multi-column spreading ---

test('short articles each start in a different column', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Article A. '.repeat(4))
  file(dir, 'b.txt', 'Article B. '.repeat(4))
  file(dir, 'c.txt', 'Article C. '.repeat(4))

  const doc = generatePdf({ inputDir: dir, output: 'test-output/spread.pdf', columns: 4, gutter: 2 })

  const x1 = textXPositions('test-output/spread.pdf', 'Article A')
  const x2 = textXPositions('test-output/spread.pdf', 'Article B')
  expect(x1.length).toBe(1)
  expect(x2.length).toBe(1)
  expect(x1[0]).not.toBe(x2[0])
})

// --- lyric-spanning: pick narrowest width where no line wraps ---

test('lyrics with 2-word lines stay in 1 column', () => {
  const dir = tmpDir()
  const lines = Array.from({ length: 8 }, (_, i) => `Two word${i}`).join('\n')
  file(dir, 'short.txt', lines)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/lyric-short.pdf', columns: 4, gutter: 2 })

  const xs = textXPositions('test-output/lyric-short.pdf', 'word')
  // 2-word lines fit in 1 column without wrapping → all at same x
  expect(xs.length).toBe(1)
})

test('lyrics with 5-word lines use 2 columns', () => {
  const dir = tmpDir()
  const lines = Array.from({ length: 8 }, (_, i) => `five fresh happy words line ${i}`).join('\n')
  file(dir, 'med.txt', lines)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/lyric-med.pdf', columns: 4, gutter: 2 })

  const xs = textXPositions('test-output/lyric-med.pdf', 'words')
  // 5-word lines wrap at 1-col, fit at 2-col → single x position (span from col 0)
  expect(xs.length).toBe(1)
})

test('lyrics with 10-word lines use 4 columns', () => {
  const dir = tmpDir()
  const lines = Array.from({ length: 8 }, (_, i) => `one two three four five six seven eight nine ${i}`).join('\n')
  file(dir, 'long.txt', lines)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/lyric-long.pdf', columns: 4, gutter: 2 })

  const xs = textXPositions('test-output/lyric-long.pdf', 'one two')
  // 10-word lines need 4-col width to avoid wrapping → single x position
  expect(xs.length).toBe(1)
})

test('long text with no line breaks spans wider width (fewer wrapped lines)', () => {
  const dir = tmpDir()
  const longLine = Array.from({ length: 60 }, (_, i) => `LongWord${i}`).join(' ')
  file(dir, 'x.txt', longLine.repeat(6))
  file(dir, 'y.txt', 'Short filler')

  const doc = generatePdf({ inputDir: dir, output: 'test-output/span-width.pdf', columns: 4, gutter: 2 })

  const xs = textXPositions('test-output/span-width.pdf', 'LongWord')
  // At 1-col width (~360 lines) this would overflow to multiple x positions.
  // With width-spanning the lines are far fewer → single x for the span.
  expect(xs.length).toBe(1)
})

// --- custom dimensions ---

test('custom portrait dimensions', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Hello')
  const doc = generatePdf({ inputDir: dir, output: '/dev/null', pageWidth: 100, pageHeight: 200, orientation: 'portrait' })
  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(100)
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(200)
})

test('custom dimensions swap for landscape', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Hello')
  const doc = generatePdf({ inputDir: dir, output: '/dev/null', pageWidth: 100, pageHeight: 200 })
  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(200)
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(100)
})
