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

  const line = 'This is a moderately long text line that helps fill a page quickly when repeated enough times. '
  file(dir, 'long.txt', line.repeat(80))

  const doc = generatePdf({ inputDir: dir, output: 'test-output/multipage.pdf' })

  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
})

test('handles large content overflow gracefully', () => {
  const dir = tmpDir()

  const line = 'Overflow content that keeps going until it fills multiple pages with wrapped lines. '
  file(dir, 'overflow.txt', line.repeat(100))

  const doc = generatePdf({ inputDir: dir, output: 'test-output/overflow.pdf', debug: true })

  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  expect(existsSync('test-output/overflow.pdf')).toBe(true)
})

test('multi-column layout with 3 content types', () => {
  const dir = tmpDir()

  function unbreakable(i: number) {
    return `block${i} https://example.com/verylongpath/${'x'.repeat(20)}`
  }

  function lyrics(i: number) {
    const verses = [
      'Verse one line one',
      'Verse one line two',
      'Verse one line three',
      '',
      'Chorus never gonna',
      'give you up',
      'let you down',
      '',
      'Verse two line one',
      'turn around',
      'and hurt you',
    ]
    return verses.map(l => `${l} ${i}`).join('\n')
  }

  function normal(i: number) {
    return `Article ${i}. ` + 'A normal paragraph with wrapped text that reads naturally across the column width. '.repeat(8)
  }

  for (let i = 1; i <= 3; i++) {
    file(dir, `unbreakable-${i}.txt`, unbreakable(i))
    file(dir, `lyric-${i}.txt`, lyrics(i))
    file(dir, `article-${i}.txt`, normal(i))
  }

  const doc = generatePdf({ inputDir: dir, output: 'test-output/columns.pdf', columns: 4, gutter: 2, debug: true })

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
