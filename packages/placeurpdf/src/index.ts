import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join, relative } from 'node:path'
import { jsPDF } from 'jspdf'
import { placeur, type Bin, type Block } from 'placeur'

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

export function generatePdf(options: PlaceurPdfOptions): void {
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
  } = options

  let pw = pageWidth
  let ph = pageHeight
  if (orientation === 'landscape' && pw < ph) {
    ;[pw, ph] = [ph, pw]
  } else if (orientation === 'portrait' && pw > ph) {
    ;[pw, ph] = [ph, pw]
  }

  const sections = findFiles(inputDir, inputDir)
  if (sections.length === 0) {
    throw new Error('No .txt files found in ' + inputDir)
  }

  const doc = new jsPDF({ unit: 'mm', format: [pw, ph] })
  const usableWidth = pw - margin * 2
  const usableHeight = ph - margin * 2

  doc.setFontSize(titleFontSize)
  const titleLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  doc.setFontSize(fontSize)
  const bodyLineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  const bin: Bin = {
    width: usableWidth,
    height: usableHeight,
    columns: columns > 1
      ? { count: columns, gutter }
      : undefined,
  }

  const blocks: Block[] = sections.map((s) => ({
    id: s.title,
    heightForWidth(w: number) {
      const titleHeight = titleLineHeight + 4
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(s.content, w)
      const bodyHeight = lines.length * bodyLineHeight
      return titleHeight + bodyHeight
    },
  }))

  const result = placeur({ bins: [bin, bin, bin, bin, bin], blocks })

  let pageIndex = 0
  for (const placedBin of result.bins) {
    if (pageIndex > 0) doc.addPage()
    pageIndex++

    for (const pb of placedBin.blocks) {
      const section = sections.find((s) => s.title === pb.block.id)
      if (!section) continue

      const x = margin + pb.x
      const y = margin + pb.y

      doc.setFontSize(titleFontSize)
      const titleLines = doc.splitTextToSize(section.title, pb.width)
      doc.text(titleLines, x, y + titleLineHeight)

      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(section.content, pb.width)
      doc.text(lines, x, y + titleLineHeight + 4 + bodyLineHeight)
    }
  }

  if (result.unpacked.length > 0) {
    for (const block of result.unpacked) {
      const section = sections.find((s) => s.title === block.id)
      if (!section) continue

      doc.addPage()
      doc.setFontSize(titleFontSize)
      const titleLines = doc.splitTextToSize(section.title, usableWidth)
      doc.text(titleLines, margin, margin + titleLineHeight)

      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(section.content, usableWidth)
      doc.text(lines, margin, margin + titleLineHeight + 4 + bodyLineHeight)
    }
  }

  doc.save(output)
}
