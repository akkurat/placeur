import { expect, test } from 'vitest'
import { jsPDF } from 'jspdf'
import { placeur, type Bin, type Block } from '../src'

function makeMeasureText(text: string, fontSize: number) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(fontSize)
  const lineH = doc.getTextDimensions('M').h

  return (width: number): number => {
    const lines = doc.splitTextToSize(text, width)
    return lines.length * lineH
  }
}

test('heightForWidth returns correct measured height', () => {
  const text = 'Hello world'

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFontSize(12)
  const lineH = doc.getTextDimensions('M').h
  const lines = doc.splitTextToSize(text, 100)
  const expectedHeight = lines.length * lineH

  const block: Block = {
    heightForWidth: makeMeasureText(text, 12),
  }

  expect(block.heightForWidth(100)).toBe(expectedHeight)
})

test('places jspdf-measured blocks into columns', () => {
  // bin height just fits one block per column to force spillover
  const bin: Bin = {
    width: 210,
    height: 10,
    columns: { count: 2, gutter: 10 },
  }

  const blocks: Block[] = [
    {
      heightForWidth: makeMeasureText(
        'Placeur is a layout algorithm for variable-height blocks.',
        12,
      ),
    },
    {
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
  pdf.setDrawColor(200, 200, 200)

  for (const pb of result.bins[0].blocks) {
    pdf.rect(pb.x, pb.y, pb.width, pb.height)
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
    { heightForWidth: makeMeasureText('Short text A.', 12) },
    { heightForWidth: makeMeasureText('Short text B.', 12) },
    { heightForWidth: makeMeasureText('Short text C.', 12) },
  ]

  const result = placeur({ bins: [bin], blocks })

  expect(result.bins).toHaveLength(1)
  expect(result.bins[0].blocks).toHaveLength(3)
  // all in column 0 because they're short
  for (const pb of result.bins[0].blocks) {
    expect(pb.x).toBe(0)
  }
  // stacked vertically
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
    columns: { count: 1, gutter: 0 },
  }

  const blocks: Block[] = [
    { heightForWidth: makeMeasureText('Short text.', 12) },
    {
      heightForWidth: makeMeasureText(
        'A long text block. '.repeat(60) +
          'This exceeds one page so it wraps to a second bin.',
        12,
      ),
    },
    { heightForWidth: makeMeasureText('Last block.', 12) },
  ]

  const result = placeur({
    bins: [bin, { ...bin }],
    blocks,
  })

  expect(result.bins.length).toBeGreaterThanOrEqual(1)
  expect(result.unpacked).toHaveLength(0)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  for (let i = 0; i < result.bins.length; i++) {
    if (i > 0) pdf.addPage()
    const placed = result.bins[i].blocks

    pdf.setFontSize(12)
    pdf.setDrawColor(200, 200, 200)

    for (const pb of placed) {
      pdf.rect(pb.x, pb.y, pb.width, pb.height)
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
    `Breaking News: Scientists Discover New Species in Deep Ocean.

      A team of marine biologists has identified a previously unknown species
      of bioluminescent jellyfish in the Mariana Trench. The discovery was
      made during a routine deep-sea exploration mission. The new species,
      named Aurelia abyssi, emits a blue-green glow that researchers believe
      is used for communication and attracting prey. This is a remarkable
      find that highlights how much we still have to learn about our oceans,
      said Dr. Maria Santos, lead researcher.`,

    `Technology: Quantum Computing Milestone Achieved.

      Researchers at the Quantum Computing Institute have successfully
      demonstrated a 1000-qubit quantum processor that maintains coherence
      for over 10 seconds. This breakthrough brings us closer to practical
      quantum computers capable of solving problems that are intractable
      for classical machines. The team used a novel error-correction
      technique that significantly reduces decoherence.`,

    `Sports: Underdog Team Wins Championship.

      In a stunning upset, the underdog team clinched the championship
      title last night with a last-minute goal that sent the crowd into
      a frenzy. The team, which was ranked last at the beginning of the
      season, overcame incredible odds to secure their victory. We never
      gave up hope, said the captain. This is a dream come true.`,

    `Weather: Unusual Heatwave Sweeps Across Continent.

      Meteorologists are warning residents to stay hydrated as an unusual
      heatwave continues to break temperature records across the continent.
      Temperatures have soared to 45°C in some regions, prompting health
      officials to issue emergency guidelines. The heatwave is expected
      to persist for another week.`,

    `Business: Startup Valued at $1 Billion After Series C Funding.

      A local tech startup has reached unicorn status after raising
      $200 million in Series C funding. The company, which develops
      AI-powered logistics software, plans to use the investment to
      expand into international markets and double its engineering team.
      We are just getting started, said the CEO.`,
  ]

  const blocks: Block[] = articles.map((text) => ({
    heightForWidth: makeMeasureText(text, 10),
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

    pdf.setDrawColor(220, 220, 220)

    for (const pb of placed) {
      const articleIdx = blocks.indexOf(pb.block)
      const text = articles[articleIdx]
      if (text) {
        const lines = pdf.splitTextToSize(text, pb.width - 4)
        pdf.text(lines, pb.x + 2, pb.y + 4)
      }
      pdf.rect(pb.x, pb.y, pb.width, pb.height)
    }
  }

  pdf.save('test-output/jspdf-newspaper.pdf')
})
