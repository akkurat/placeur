import { beforeAll, expect, test } from 'vitest'
import { jsPDF } from 'jspdf'
import { existsSync, mkdirSync } from 'node:fs'

import { placeur, type Bin, type Block } from 'placeur'

function makeMeasureText(text: string, fontSize: number) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(fontSize)
  const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor

  return (width: number): number => {
    const lines = doc.splitTextToSize(text, width)
    return lines.length * lineHeight
  }
}

beforeAll(()=> {
  if(!existsSync('test-output') ) {
    mkdirSync('test-output')
  }
})

test('heightForWidth returns correct measured height', () => {
  const text = 'Hello world'

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(12)
  const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor
  const lines = doc.splitTextToSize(text, 100)
  const expectedHeight = lines.length * lineHeight

  const block: Block = {
    id: 'measure',
    heightForWidth: makeMeasureText(text, 12),
  }

  expect(block.heightForWidth(100)).toBe(expectedHeight)
})

test('places jspdf-measured blocks into columns', () => {
  const bin: Bin = {
    width: 210,
    height: 10,
    columns: { count: 2, gutter: 10 },
  }

  const blocks: Block[] = [
    {
      id: 'a',
      heightForWidth: makeMeasureText(
        'Placeur is a layout algorithm for variable-height blocks.',
        12,
      ),
    },
    {
      id: 'b',
      heightForWidth: makeMeasureText(
        'Unlike traditional bin packing, this approach accounts for ' +
          'non-linear line breaks.',
        12,
      ),
    },
  ]

  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.unpacked).toHaveLength(0)
  expect(result.bins[0].blocks).toHaveLength(2)

  const colW = (210 - 10) / 2
  expect(result.bins[0].blocks[0].x).toBe(0)
  expect(result.bins[0].blocks[1].x).toBe(colW + 10)
  expect(result.bins[0].blocks[0].width).toBe(colW)
  expect(result.bins[0].blocks[1].width).toBe(colW)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFontSize(12)
  pdf.setFillColor(240, 240, 240)
  pdf.setDrawColor(200, 200, 200)

  for (const pb of result.bins[0].blocks) {
    pdf.rect(pb.x, pb.y, pb.width, pb.height, 'DF')
  }

  pdf.save('test-output/jspdf-columns.pdf')
})

test('short blocks all stack in first column', () => {
  const bin: Bin = {
    width: 210,
    height: 297,
    columns: { count: 2, gutter: 10 },
  }

  const blocks: Block[] = [
    { id: 's1', heightForWidth: makeMeasureText('Short text A.', 12) },
    { id: 's2', heightForWidth: makeMeasureText('Short text B.', 12) },
    { id: 's3', heightForWidth: makeMeasureText('Short text C.', 12) },
  ]

  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.bins[0].blocks).toHaveLength(3)
  for (const pb of result.bins[0].blocks) {
    expect(pb.x).toBe(0)
  }
  expect(result.bins[0].blocks[0].y).toBe(0)
  expect(result.bins[0].blocks[1].y).toBeGreaterThan(0)
  expect(result.bins[0].blocks[2].y).toBeGreaterThan(
    result.bins[0].blocks[1].y,
  )
})

test('places long text across multiple A4 pages', () => {
  const bin: Bin = {
    width: 210,
    height: 297,
    columns: { count: 2, gutter: 8 },
  }
  const shortBin: Bin = { ...bin, height: 10 }

  const blocks: Block[] = [
    { id: 'short', heightForWidth: makeMeasureText('Short text.', 12) },
    {
      id: 'long',
      heightForWidth: makeMeasureText(
        'A long text block. '.repeat(80) +
          'This wraps to a second page.',
        12,
      ),
    },
    { id: 'last', heightForWidth: makeMeasureText('Last block.', 12) },
  ]

  const result = placeur({
    bins: [shortBin, bin],
    blocks,
  })

  expect(result.bins).toHaveLength(2)
  expect(result.unpacked).toHaveLength(0)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  for (let i = 0; i < result.bins.length; i++) {
    if (i > 0) pdf.addPage()

    pdf.setFontSize(12)
    pdf.setFillColor(240, 240, 240)
    pdf.setDrawColor(200, 200, 200)

    for (const pb of result.bins[i].blocks) {
      pdf.rect(pb.x, pb.y, pb.width, pb.height, 'DF')
    }
  }

  pdf.save('test-output/jspdf-multipage.pdf')
})

test('generates A4 page with realistic newspaper-style columns', () => {
  const bin: Bin = {
    width: 210,
    height: 297,
    columns: { count: 3, gutter: 8 },
  }

  const articles = [
    {
      id: 'news',
      text: `Breaking News: Scientists Discover New Species in Deep Ocean.

      A team of marine biologists has identified a previously unknown species
      of bioluminescent jellyfish in the Mariana Trench. The discovery was
      made during a routine deep-sea exploration mission. The new species,
      named Aurelia abyssi, emits a blue-green glow that researchers believe
      is used for communication and attracting prey. This is a remarkable
      find that highlights how much we still have to learn about our oceans,
      said Dr. Maria Santos, lead researcher.`,
    },
    {
      id: 'tech',
      text: `Technology: Quantum Computing Milestone Achieved.

      Researchers at the Quantum Computing Institute have successfully
      demonstrated a 1000-qubit quantum processor that maintains coherence
      for over 10 seconds. This breakthrough brings us closer to practical
      quantum computers capable of solving problems that are intractable
      for classical machines. The team used a novel error-correction
      technique that significantly reduces decoherence.`,
    },
    {
      id: 'sports',
      text: `Sports: Underdog Team Wins Championship.

      This
      Are 
      None
      Very Short
      Very Very
      Short
      Lines
      no point
      in making
      more
      than 
      1 
      column
      no
      no 
      very no
      no
      Very Short
      Very Very
      Short
      Lines
      no point
      in making
      more
      than 
      1 
      column
      no
      no 
      very no
      no
`,
    },
    {
      id: 'weather',
      text: `Weather: Unusual Heatwave Sweeps Across Continent.

      Meteorologists are warning residents to stay hydrated as an unusual
      heatwave continues to break temperature records across the continent.
      Temperatures have soared to 45°C in some regions, prompting health
      officials to issue emergency guidelines. The heatwave is expected
      to persist for another week.
      Meteorologists are warning residents to stay hydrated as an unusual
      heatwave continues to break temperature records across the continent.
      Temperatures have soared to 45°C in some regions, prompting health
      officials to issue emergency guidelines. The heatwave is expected
      to persist for another week.
      Meteorologists are warning residents to stay hydrated as an unusual
      heatwave continues to break temperature records across the continent.
      Temperatures have soared to 45°C in some regions, prompting health
      officials to issue emergency guidelines. The heatwave is expected
      to persist for another week.
      Meteorologists are warning residents to stay hydrated as an unusual
      heatwave continues to break temperature records across the continent.
      Temperatures have soared to 45°C in some regions, prompting health
      officials to issue emergency guidelines. The heatwave is expected
      to persist for another week.
      `,
    },
    {
      id: 'business',
      text: `Business: Startup Valued at $1 Billion After Series C Funding.

      A local tech startup has reached unicorn status after raising
      $200 million in Series C funding. The company, which develops
      AI-powered logistics software, plans to use the investment to
      expand into international markets and double its engineering team.
      We are just getting started, said the CEO.`,
    },
  ]

  const blocks: Block[] = articles.map((a) => ({
    id: a.id,
    heightForWidth: makeMeasureText(a.text, 10),
  }))

  const result = placeur({
    bins: [bin, { ...bin }, { ...bin }],
    blocks,
  })

  expect(result.unpacked).toHaveLength(0)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFontSize(10)

  for (let i = 0; i < result.bins.length; i++) {
    if (i > 0) pdf.addPage()
    const placed = result.bins[i].blocks

    for (const pb of placed) {
      const article = articles.find((a) => a.id === pb.block.id)
      pdf.setDrawColor(220, 220, 220)
      pdf.setFillColor(245, 245, 245)
      pdf.rect(pb.x, pb.y, pb.width, pb.height, 'DF')
      if (article) {
        const lines = pdf.splitTextToSize(article.text, pb.width - 4)
        pdf.text(lines, pb.x + 2, pb.y + 4)
      }
    }
  }

  pdf.save('test-output/jspdf-newspaper.pdf')
})
