import { flowLayout, type FlowLayoutOptions } from 'placeur'
import { jsPDF } from 'jspdf'
import { findFiles } from './io.js'
import { sectionsToBlocks, type BlockMeta } from './layout.js'

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
  breakPenalty?: number
  wastePenalty?: number
}

export { findFiles } from './io.js'
export type { Section } from './io.js'

function renderPage(
  doc: jsPDF,
  page: readonly { block: { id: string }; x: number; y: number; width: number; height: number }[],
  meta: Map<string, BlockMeta>,
  margin: number,
  titleFontSize: number,
  fontSize: number,
  debug: boolean,
) {
  doc.setFontSize(titleFontSize)
  const titleLineHeight = doc.getLineHeight() / doc.internal.scaleFactor
  const titlePad = 4

  doc.setFontSize(fontSize)
  const bodyLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  for (const pb of page) {
    const d = meta.get(pb.block.id)
    if (!d) continue

    const x = margin + pb.x
    const y = margin + pb.y

    if (debug) {
      doc.setFillColor(245, 245, 245)
      doc.setDrawColor(200, 200, 200)
      doc.rect(x, y, pb.width, pb.height, 'DF')
    }

    if (d.title !== null) {
      doc.setFontSize(titleFontSize)
      const titleLines = doc.splitTextToSize(d.title, pb.width)
      doc.text(titleLines, x, y + titleLineHeight)
      doc.setFontSize(fontSize)
      doc.text(d.lines, x, y + titleLineHeight + titlePad + bodyLineHeight)
    } else {
      doc.setFontSize(fontSize)
      doc.text(d.lines, x, y + bodyLineHeight)
    }
  }
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

  const colWidth = columns > 1
    ? (usableWidth - gutter * (columns - 1)) / columns
    : usableWidth

  const { blocks, meta } = sectionsToBlocks(
    sections, doc, columns, colWidth, gutter, usableHeight,
    fontSize, titleFontSize,
  )

  const bin = { width: usableWidth, height: usableHeight, columns: { count: columns, gutter } }
  const flowOptions: FlowLayoutOptions = {}
  if (options.breakPenalty !== undefined) flowOptions.breakPenalty = options.breakPenalty
  if (options.wastePenalty !== undefined) flowOptions.wastePenalty = options.wastePenalty
  const result = flowLayout(bin, blocks, flowOptions)

  for (let pi = 0; pi < result.pages.length; pi++) {
    if (pi > 0) doc.addPage()
    renderPage(doc, result.pages[pi], meta, margin, titleFontSize, fontSize, debug)
  }

  doc.save(output)
  return doc
}
