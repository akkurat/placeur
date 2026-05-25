import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join, relative } from 'node:path'
import { jsPDF } from 'jspdf'

export interface Section {
  title: string
  content: string
}

export type Orientation = 'portrait' | 'landscape'

export interface PlaceurPdfOptions {
  inputDir: string
  output?: string
  columns?: number
  gutter?: number
  fontSize?: number
  titleFontSize?: number
  pageWidth?: number
  pageHeight?: number
  margin?: number
  orientation?: Orientation
  debug?: boolean
}

interface FlowItem {
  x: number
  y: number
  width: number
  height: number
  title: string | null
  bodyLines: string[]
}

function findFiles(dir: string, baseDir: string): Section[] {
  const sections: Section[] = []
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a: Dirent, b: Dirent) =>
    a.name.localeCompare(b.name)
  )
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      sections.push(...findFiles(full, baseDir))
    } else if (entry.isFile() && entry.name.endsWith('.txt')) {
      const rel = relative(baseDir, full)
      const title = rel.replace(/\.txt$/i, '')
      const content = readFileSync(full, 'utf-8')
      sections.push({ title, content })
    }
  }
  return sections
}

function flowLayout(
  sections: Section[],
  usableWidth: number,
  usableHeight: number,
  columns: number,
  gutter: number,
  doc: jsPDF,
  fontSize: number,
  titleFontSize: number,
): FlowItem[][] {
  const colCount = columns || 1
  const colWidth = colCount > 1
    ? (usableWidth - gutter * (colCount - 1)) / colCount
    : usableWidth

  doc.setFontSize(titleFontSize)
  const titleLineHeight = doc.getLineHeight() / doc.internal.scaleFactor
  const titleHeight = titleLineHeight + 4

  doc.setFontSize(fontSize)
  const bodyLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  const pages: FlowItem[][] = [[]]
  let colCursors = new Array(colCount).fill(0)
  let curCol = 0

  function advanceCol() {
    curCol++
    if (curCol >= colCount) {
      pages.push([])
      colCursors = new Array(colCount).fill(0)
      curCol = 0
    }
  }

  function columnFree(): number {
    return usableHeight - colCursors[curCol]
  }

  const sorted = [...sections].sort((a, b) => b.content.length - a.content.length)

  for (const section of sorted) {
    const srcLines = section.content.split('\n')

    // --- span selection: pick the narrowest span whose wrapped lines fit entirely ---
    const maxSpan = colCount - curCol
    let chosenSpan = 1
    let chosenWrapped: string[][] = []
    let bestLines = Infinity

    doc.setFontSize(fontSize)
    for (let span = 1; span <= maxSpan; span++) {
      const spanWidth = span * colWidth + (span - 1) * gutter
      const w = srcLines.map(line =>
        line.length === 0 ? [''] : doc.splitTextToSize(line, spanWidth),
      )
      const totalLines = w.reduce((s, a) => s + a.length, 0)
      const totalHeight = titleHeight + totalLines * bodyLineHeight
      const spanEnd = curCol + span - 1
      const maxCursor = Math.max(...colCursors.slice(curCol, spanEnd + 1))
      const freeSpace = usableHeight - maxCursor
      if (totalHeight <= freeSpace) {
        chosenSpan = span
        chosenWrapped = w
        break
      }
      // fallback candidate: widest span (fewest lines) if nothing fits entirely
      if (totalLines < bestLines) {
        bestLines = totalLines
        chosenSpan = span
        chosenWrapped = w
      }
    }

    // fallback: chosenSpan already set to the span with fewest lines

    // --- place section at chosenSpan width ---
    const spanWidth = chosenSpan * colWidth + (chosenSpan - 1) * gutter
    const wrapped = chosenWrapped
    const spanEnd = curCol + chosenSpan - 1

    let lineIdx = 0
    let placedTitle = false

    while (lineIdx < wrapped.length || !placedTitle) {
      if (!placedTitle) {
        const firstBody = wrapped.length > 0 ? wrapped[0] : []
        const minKeep = titleHeight + bodyLineHeight

        if (minKeep > columnFree()) {
          advanceCol()
          continue
        }

        const maxBody = Math.floor((columnFree() - titleHeight) / bodyLineHeight)
        const renderBody = maxBody > 0 && firstBody.length > 0 ? firstBody.slice(0, maxBody) : []
        const bh = renderBody.length * bodyLineHeight

        const x = curCol * (colWidth + gutter)
        pages[pages.length - 1].push({
          x, y: colCursors[curCol], width: spanWidth, height: titleHeight + bh,
          title: section.title,
          bodyLines: renderBody,
        })
        // update all spanned columns' cursors
        const cursorVal = colCursors[curCol] + titleHeight + bh
        for (let c = curCol; c <= spanEnd && c < colCount; c++) {
          colCursors[c] = cursorVal
        }
        placedTitle = true

        if (renderBody.length < firstBody.length) {
          lineIdx = 0
          wrapped[0] = firstBody.slice(maxBody)
        } else {
          lineIdx = 1
        }

        if (lineIdx >= wrapped.length && renderBody.length === 0) {
          break
        }
      } else {
        while (lineIdx < wrapped.length) {
          const bl = wrapped[lineIdx]
          const bh = bl.length * bodyLineHeight

          if (bh > columnFree()) {
            if (bh > usableHeight) {
              if (columnFree() < bodyLineHeight) {
                advanceCol()
              }
              const maxLines = Math.max(1, Math.floor(columnFree() / bodyLineHeight))
              const renderBl = bl.slice(0, maxLines)
              const remainingBl = bl.slice(maxLines)
              if (remainingBl.length === 0) {
                lineIdx++
              } else {
                wrapped[lineIdx] = remainingBl
              }
              const rx = curCol * (colWidth + gutter)
              const cursorVal = colCursors[curCol] + maxLines * bodyLineHeight
              pages[pages.length - 1].push({
                x: rx, y: colCursors[curCol], width: spanWidth, height: maxLines * bodyLineHeight,
                title: null,
                bodyLines: renderBl,
              })
              for (let c = curCol; c <= spanEnd && c < colCount; c++) {
                colCursors[c] = cursorVal
              }
            }
            advanceCol()
            break
          }

          const x = curCol * (colWidth + gutter)
          const cursorVal = colCursors[curCol] + bh
          pages[pages.length - 1].push({
            x, y: colCursors[curCol], width: spanWidth, height: bh,
            title: null,
            bodyLines: bl,
          })
          for (let c = curCol; c <= spanEnd && c < colCount; c++) {
            colCursors[c] = cursorVal
          }
          lineIdx++
        }
      }
    }

    // advance past the spanned columns
    const si = sorted.indexOf(section)
    if (colCount > 1 && si < sorted.length - 1) {
      curCol += chosenSpan
      if (curCol >= colCount) {
        pages.push([])
        colCursors = new Array(colCount).fill(0)
        curCol = 0
      }
    }
  }

  return pages
}

export function generatePdf(options: PlaceurPdfOptions): jsPDF {
  const {
    inputDir,
    output = 'output.pdf',
    columns = 1,
    gutter = 8,
    fontSize = 11,
    titleFontSize = 14,
    pageWidth = 210,
    pageHeight = 297,
    margin = 20,
    orientation = 'landscape',
    debug = false,
  } = options

  const sections = findFiles(inputDir, inputDir)
  if (sections.length === 0) {
    throw new Error('No .txt files found in ' + inputDir)
  }

  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, pageHeight], orientation })
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2
  const usableHeight = doc.internal.pageSize.getHeight() - margin * 2

  const pages = flowLayout(sections, usableWidth, usableHeight, columns, gutter, doc, fontSize, titleFontSize)

  doc.setFontSize(titleFontSize)
  const titleLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  doc.setFontSize(fontSize)
  const bodyLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) doc.addPage()

    for (const item of pages[pi]) {
      const x = margin + item.x
      const y = margin + item.y

      if (debug) {
        doc.setFillColor(245, 245, 245)
        doc.setDrawColor(200, 200, 200)
        doc.rect(x, y, item.width, item.height, 'DF')
      }

      if (item.title !== null) {
        doc.setFontSize(titleFontSize)
        const titleLines = doc.splitTextToSize(item.title, item.width)
        doc.text(titleLines, x, y + titleLineHeight)
        doc.setFontSize(fontSize)
        doc.text(item.bodyLines, x, y + titleLineHeight + 4 + bodyLineHeight)
      } else {
        doc.setFontSize(fontSize)
        doc.text(item.bodyLines, x, y + bodyLineHeight)
      }
    }
  }

  doc.save(output)
  return doc
}
