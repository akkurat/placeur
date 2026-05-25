import { beforeAll, expect, test } from 'vitest'
import { mkdirSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { jsPDF } from 'jspdf'

import { generatePdf } from '../src/index.js'

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'placeurpdf-test-'))
}

function file(dir: string, name: string, content: string) {
  writeFileSync(join(dir, name), content, 'utf-8')
}

beforeAll(() => {
  if (!existsSync('test-output')) {
    mkdirSync('test-output')
  }
})

test('generates a PDF from a single text file', () => {
  const dir = tmpDir()
  file(dir, 'hello.txt', 'Hello world')

  const doc = generatePdf({ inputDir: dir, output: 'test-output/single.pdf' })

  expect(existsSync('test-output/single.pdf')).toBe(true)
  expect(doc.getNumberOfPages()).toBe(1)
})

test('defaults to landscape orientation', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')

  const doc = generatePdf({ inputDir: dir, output: 'test-output/landscape.pdf' })

  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  expect(w).toBeGreaterThan(h)
})

test('portrait orientation produces portrait page', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')

  const doc = generatePdf({
    inputDir: dir,
    output: 'test-output/portrait.pdf',
    orientation: 'portrait',
  })

  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  expect(w).toBeLessThan(h)
})

test('long content spans multiple pages', () => {
  const dir = tmpDir()
  file(dir, 'long.txt', 'A long text block. '.repeat(800))

  const doc = generatePdf({ inputDir: dir, output: 'test-output/multipage.pdf' })

  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
})

test('multi-column layout with multiple files', () => {
  const dir = tmpDir()

  const long = (i: number) =>
    `Article ${i}. This is a longer paragraph that fills multiple lines ` +
    `of text spanning the column width. `.repeat(20)

  const short = (i: number) => `Short note ${i}. Just a brief line.`

  for (let i = 1; i <= 30; i++) {
    const content = i % 5 === 0 ? short(i) : long(i)
    file(dir, `article-${i}.txt`, content)
  }

  const doc = generatePdf({ inputDir: dir, output: 'test-output/columns.pdf', columns: 7, gutter: 8, debug: true })

  expect(existsSync('test-output/columns.pdf')).toBe(true)
  expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
})

test('handles unpacked content overflow gracefully', () => {
  const dir = tmpDir()
  file(dir, 'overflow.txt', 'Overflow content. '.repeat(2000))

  const doc = generatePdf({ inputDir: dir, output: 'test-output/overflow.pdf' })

  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  expect(existsSync('test-output/overflow.pdf')).toBe(true)
})

test('respects custom page dimensions', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')

  const doc = generatePdf({
    inputDir: dir,
    output: 'test-output/custom.pdf',
    pageWidth: 100,
    pageHeight: 200,
    orientation: 'portrait',
  })

  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(100)
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(200)
})

test('respects custom page dimensions in landscape', () => {
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')

  const doc = generatePdf({
    inputDir: dir,
    output: 'test-output/custom-landscape.pdf',
    pageWidth: 100,
    pageHeight: 200,
  })

  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(200)
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(100)
})
