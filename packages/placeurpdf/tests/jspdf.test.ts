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

// --- lyric-spanning: all 3 types together in one document, one page ---

test('mixed lyrics: each song spanning its appropriate width', () => {
  const dir = tmpDir()

  // Song 1:  2 words×3chars/line → fits in 1 column (span=1)
  const shortLines = Array.from({ length: 6 }, (_, i) => `xx xx ${i}`).join('\n')
  file(dir, 'sht.txt', shortLines)
  file(dir, 'sht1.txt', shortLines)
  file(dir, 'sht2.txt', shortLines)

  // Song 2:  5 words×6chars/line → wraps at 1-col, fits at 2-col (span=2)
  const medLines = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 5 }, () => 'bbbbbb').join(' ') + ` ${i}`
  ).join('\n')
  file(dir, 'med.txt', medLines)
  file(dir, 'med1.txt', medLines)

  // Song 3: 10 words×5chars/line → needs span=4 to avoid wrapping
  const longLines = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 10 }, () => 'ccccc').join(' ') + ` ${i}`
  ).join('\n')
  file(dir, 'lng.txt', longLines)
  file(dir, 'lng2.txt', longLines)
  file(dir, 'lng3.txt', longLines)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/mixed-lyrics.pdf', columns: 7, gutter: 2, debug: true })
  expect(doc.getNumberOfPages()).toBe(1)

  // Each song intact (no line wrapping within each song)
  const pdf = readFileSync('test-output/mixed-lyrics.pdf', 'utf-8')
  const blocks = pdf.split('Tj')

  // 3 short songs x 6 lines
  expect(blocks.filter(b => b.includes('xx xx')).length).toBe(18)
  // 2 medium songs x 6 lines
  expect(blocks.filter(b => b.includes('bbbbbb')).length).toBe(12)
  // 3 long songs x 6 lines
  expect(blocks.filter(b => b.includes('ccccc')).length).toBe(18)

  // Songs span across different column positions
  const xs = textXPositions('test-output/mixed-lyrics.pdf', 'xx xx')
  const xm = textXPositions('test-output/mixed-lyrics.pdf', 'bbbbbb')
  const xl = textXPositions('test-output/mixed-lyrics.pdf', 'ccccc')
  // Long songs all in first 4 columns (one unique positon)
  expect(xl.length).toBe(1)
  // Short songs spread across multiple columns
  expect(xs.length).toBeGreaterThan(1)
  // Medium songs spread across multiple columns
  expect(xm.length).toBeGreaterThan(1)
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
