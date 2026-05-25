import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generatePdf } from '../dist/index.js'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'placeurpdf-test-'))
}

function file(dir, name, content) {
  writeFileSync(join(dir, name), content, 'utf-8')
}

mkdirSync('test-output', { recursive: true })

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (!condition) {
    console.log(`  FAIL: ${msg}`)
    failed++
  } else {
    console.log(`  PASS: ${msg}`)
    passed++
  }
}

// Test 1: single file
{
  const dir = tmpDir()
  file(dir, 'hello.txt', 'Hello world')
  const doc = generatePdf({ inputDir: dir, output: 'test-output/single.pdf' })
  assert(existsSync('test-output/single.pdf'), 'single file exists')
  assert(doc.getNumberOfPages() === 1, 'single file: 1 page')
}

// Test 2: landscape default
{
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')
  const doc = generatePdf({ inputDir: dir, output: 'test-output/landscape.pdf' })
  assert(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight(), 'landscape default')
}

// Test 3: portrait
{
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')
  const doc = generatePdf({ inputDir: dir, output: 'test-output/portrait.pdf', orientation: 'portrait' })
  assert(doc.internal.pageSize.getWidth() < doc.internal.pageSize.getHeight(), 'portrait')
}

// Test 4: long content
{
  const dir = tmpDir()
  const line = 'This is a moderately long text line that helps fill a page quickly when repeated enough times. '
  file(dir, 'long.txt', line.repeat(200))
  const doc = generatePdf({ inputDir: dir, output: 'test-output/multipage.pdf' })
  assert(doc.getNumberOfPages() > 1, 'long content: multiple pages')
  assert(existsSync('test-output/multipage.pdf'), 'multipage file exists')
}

// Test 5: multi-column with all 3 content types

// Test 6: overflow
{
  const dir = tmpDir()
  const line = 'Overflow content that keeps going until it fills multiple pages with wrapped text lines. '
  file(dir, 'overflow.txt', line.repeat(250))
  const doc = generatePdf({ inputDir: dir, output: 'test-output/overflow.pdf', debug: true })
  assert(doc.getNumberOfPages() > 1, 'overflow: multiple pages')
  assert(existsSync('test-output/overflow.pdf'), 'overflow file exists')
}

// Test 5: multi-column — articles spread across columns + long content uses wider span
{
  const dir = tmpDir()

  // Three short articles that should each start in a different column
  file(dir, 'article-1.txt', 'Article 1. A short paragraph for column tests. '.repeat(3))
  file(dir, 'article-2.txt', 'Article 2. A short paragraph for column tests. '.repeat(3))
  file(dir, 'article-3.txt', 'Article 3. A short paragraph for column tests. '.repeat(3))

  // One long content block that needs >1 column width to fit without overflowing
  const longText = Array.from({length:60}, (_,i) => 'LongWord_' + i).join(' ') + ' '
  file(dir, 'long.txt', longText.repeat(8))

  // A lyrics block with many short atomic lines
  const lyricsBlock = Array.from({length:30}, (_,i) => 'Lyric line ' + (i+1) + ' of thirty').join('\n')
  file(dir, 'lyrics.txt', lyricsBlock)

  const doc = generatePdf({ inputDir: dir, output: 'test-output/columns.pdf', columns: 4, gutter: 2, debug: true })
  assert(existsSync('test-output/columns.pdf'), 'columns pdf exists')
  // Read raw PDF to check which x-positions (in points) contain text
  const pdfContent = readFileSync('test-output/columns.pdf', 'utf-8')
  const xPositions = [...pdfContent.matchAll(/(\d+\.?\d*) (\d+\.?\d*) Td/g)]
    .map(m => parseFloat(m[1]))
    .filter((x, i, a) => a.indexOf(x) === i)
    .sort((a, b) => a - b)
  assert(xPositions.length >= 2, 'columns: text appears in at least 2 different x positions (' + xPositions.length + ' found)')
  // Verify columns are distinct (each ~one colWidth+gutter apart)
  if (xPositions.length >= 2) {
    const gaps = xPositions.slice(1).map((x, i) => x - xPositions[i])
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
    assert(avgGap > 50, 'columns: average gap between columns > 50pts (' + avgGap.toFixed(1) + 'pts)')
  }
  // Verify that the long text spans a wider width: fewer lines than 1-col would produce
  const longBlocks = pdfContent.split('Tj').filter(b => b.includes('LongWord'))
  assert(longBlocks.length < 60, 'columns: long text spans wider width (' + longBlocks.length + ' lines, expected < 60)')
  // Verify articles are spread across distinct x positions
  const article1X = new Set(pdfContent.split('Tj').filter(b => b.includes('Article 1')).map(p => {
    const m = p.match(/([\d.]+) ([\d.]+) Td[^)]/);
    return m ? (parseFloat(m[1])/2.8346).toFixed(1) : null
  }).filter(Boolean))
  const article2X = new Set(pdfContent.split('Tj').filter(b => b.includes('Article 2')).map(p => {
    const m = p.match(/([\d.]+) ([\d.]+) Td[^)]/);
    return m ? (parseFloat(m[1])/2.8346).toFixed(1) : null
  }).filter(Boolean))
  assert(article1X.size === 1 && article2X.size === 1, 'columns: each article in one column')
  const a1x = [...article1X][0], a2x = [...article2X][0]
  assert(a1x && a2x && a1x !== a2x, 'columns: articles are in different columns (' + a1x + ' vs ' + a2x + ')')
}

// Test 6: single page
{
  const dir = tmpDir()
  const line = 'Overflow content that keeps going. '
  file(dir, 'overflow.txt', line.repeat(100))
  const doc = generatePdf({ inputDir: dir, output: 'test-output/overflow.pdf', debug: true })
  assert(doc.getNumberOfPages() === 1, 'overflow: single page (fits in column)')
  assert(existsSync('test-output/overflow.pdf'), 'overflow file exists')
}

// Test 7: custom portrait dimensions
{
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')
  const doc = generatePdf({ inputDir: dir, output: 'test-output/custom.pdf', pageWidth: 100, pageHeight: 200, orientation: 'portrait' })
  assert(Math.abs(doc.internal.pageSize.getWidth() - 100) < 0.01, 'custom width')
  assert(Math.abs(doc.internal.pageSize.getHeight() - 200) < 0.01, 'custom height')
}

// Test 8: custom landscape dimensions
{
  const dir = tmpDir()
  file(dir, 'a.txt', 'Content')
  const doc = generatePdf({ inputDir: dir, output: 'test-output/custom-landscape.pdf', pageWidth: 100, pageHeight: 200 })
  assert(Math.abs(doc.internal.pageSize.getWidth() - 200) < 0.01, 'custom landscape width')
  assert(Math.abs(doc.internal.pageSize.getHeight() - 100) < 0.01, 'custom landscape height')
}

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`)
process.exit(failed > 0 ? 1 : 0)
