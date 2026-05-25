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

// --- lyric-spanning: all 3 types together in one document ---

test('mixed lyrics: each song spanning its appropriate width', () => {
  const dir = tmpDir()

  // Song 1:  2 words/line → fits in 1 column (span=1)
  const shortLines = Array.from({ length: 10 }, (_, i) => `short line${i}`).join('\n')
  file(dir, 'song-short.txt', shortLines)

  // Song 2:  5 words/line → wraps at 1-col, fits at 2-col (span=2)
  const words5 = Array.from({ length: 10 }, (_, i) => `medium length words for line ${i}`).join('\n')
  file(dir, 'song-medium.txt', words5)

  // Song 3: 10 words/line → wraps at 1/2-col, fits at 3-col (span=3)
  // Use repeated 8-char words: 'xxxxxxxx'
  const longLines = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 10 }, () => 'xxxxxxxx').join(' ') + ` ${i}`
  ).join('\n')
  file(dir, 'song-long.txt', longLines)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/mixed-lyrics.pdf', columns: 4, gutter: 2, debug: true })
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)

  // Each song should be intact (no line wrapping within each song)
  const pdf = readFileSync('test-output/mixed-lyrics.pdf', 'utf-8')
  const blocks = pdf.split('Tj')

  const shortBlocks = blocks.filter(b => b.includes('short line'))
  const medBlocks   = blocks.filter(b => b.includes('medium length'))
  const longBlocks  = blocks.filter(b => b.includes('xxxxxxxx'))

  expect(shortBlocks.length).toBe(10)
  expect(medBlocks.length).toBe(10)
  expect(longBlocks.length).toBe(6)

  // Each song starts at a different x position (spread across columns)
  // Long song spans 3 cols → x=20mm, medium song at col 3 → x=214mm
  // Short song on next page at col 0 → x=20mm but different page
  const shortX = textXPositions('test-output/mixed-lyrics.pdf', 'short line')
  const medX   = textXPositions('test-output/mixed-lyrics.pdf', 'medium length')
  const longX  = textXPositions('test-output/mixed-lyrics.pdf', 'xxxxxxxx')

  expect(shortX.length).toBe(1)
  expect(medX.length).toBe(1)
  expect(longX.length).toBe(1)
  expect(medX[0]).not.toBe(longX[0])
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
