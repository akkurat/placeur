import type { Block } from 'placeur'
import { jsPDF } from 'jspdf'
import type { Section } from './io.js'

export interface BlockMeta {
  title: string | null
  lines: string[]
}

function determineSpan(
  srcLines: string[],
  doc: jsPDF,
  colWidth: number,
  gutter: number,
  maxSpan: number,
  fontSize: number,
): number {
  doc.setFontSize(fontSize)

  for (let span = 1; span <= maxSpan; span++) {
    const spanWidth = span * colWidth + (span - 1) * gutter
    const w = srcLines.map(line =>
      line.length === 0 ? [''] : doc.splitTextToSize(line, spanWidth),
    )
    const anyWraps = w.some((lines, i) => srcLines[i] !== '' && lines.length > 1)
    if (!anyWraps) return span
  }

  let bestSpan = 1
  let fewestLines = Infinity

  for (let span = 1; span <= maxSpan; span++) {
    const spanWidth = span * colWidth + (span - 1) * gutter
    const w = srcLines.map(line =>
      line.length === 0 ? [''] : doc.splitTextToSize(line, spanWidth),
    )
    const totalLines = w.reduce((s, a) => s + a.length, 0)
    if (totalLines < fewestLines) {
      fewestLines = totalLines
      bestSpan = span
    }
  }

  return bestSpan
}

export function sectionsToBlocks(
  sections: Section[],
  doc: jsPDF,
  colCount: number,
  colWidth: number,
  gutter: number,
  usableHeight: number,
  fontSize: number,
  titleFontSize: number,
): { blocks: Block[]; meta: Map<string, BlockMeta> } {
  doc.setFontSize(titleFontSize)
  const titleLineHeight = doc.getLineHeight() / doc.internal.scaleFactor
  const titleHeight = titleLineHeight + 4

  doc.setFontSize(fontSize)
  const bodyLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  const blocks: Block[] = []
  const meta = new Map<string, BlockMeta>()

  const sorted = [...sections].sort((a, b) => b.content.length - a.content.length)

  for (const section of sorted) {
    const srcLines = section.content.split('\n')
    const span = determineSpan(srcLines, doc, colWidth, gutter, colCount, fontSize)
    const spanWidth = span * colWidth + (span - 1) * gutter

    const allLines = srcLines.flatMap(line =>
      line.length === 0 ? [''] : doc.splitTextToSize(line, spanWidth),
    )

    const maxBodyHeight = usableHeight - titleHeight
    const linesPerChunk = Math.max(1, Math.floor(maxBodyHeight / bodyLineHeight))

    let lineIdx = 0
    let chunkIdx = 0

    while (lineIdx < allLines.length) {
      const chunkLines = allLines.slice(lineIdx, lineIdx + linesPerChunk)
      const bodyHeight = chunkLines.length * bodyLineHeight
      const isFirst = chunkIdx === 0
      const totalHeight = isFirst ? titleHeight + bodyHeight : bodyHeight

      const id = `${section.title}#${chunkIdx}`
      blocks.push({
        id,
        heightForWidth: () => totalHeight,
        span,
      })
      meta.set(id, {
        title: isFirst ? section.title : null,
        lines: chunkLines,
      })

      lineIdx += linesPerChunk
      chunkIdx++
    }
  }

  return { blocks, meta }
}
