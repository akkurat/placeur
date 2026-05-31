import { expect, test, describe } from 'vitest'
import { AsciiBlock, maxClamp } from '../src/placement-block.js'
import { intrinsicWidthThreshold, packIntrinsicWidth, sizeCounts } from '../src/pack-noai.js'
import type { PlacedBlock } from '../src/api-types.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const text1= `
Es war vor vielen Jahren, ich war noch so jung
F G
es war die Zeit der ersten Liebe
ich spürte den Schmerz den er ging durch mein Herz
und der Wind ging leicht durch die Bäume
da sah ich es stehn und ich sagte hallo!
du bist schön aber ich kann nicht reiten
es hob seinen Kopf und es wieherte laut
ich sagte nein ich kann dich nicht begleiten
C em
Unbekanntes Pferd lauf heim
am F G
es ist schon spät, die ersten Sterne strahlen
C em
Unbekanntes Pferd lauf heim
am F
laß mich allein, es muß so sein
dm G
ich kann dich nicht behalten
da trabte es los, es war schwarz und groß
und ich schaute ihm lange noch nach
der Mond war schon da und die Nacht war so nah
eine Fledermaus flog durch das Dunkel
C em
Unbekanntes Pferd lauf heim
F
jemand wartet auf dich
G
jemand kennt deinen Namen
F G
und ruft ihn die ganze Zeit
`
        const text2 = `[Strophe 1]
Im Zweifel für den Zweifel
Das Zaudern und den Zorn
Im Zweifel fürs Zerreißen
Der eigenen Uniform
Im Zweifel für den Zweifel
Und für die Pubertät
Im Zweifel gegen Zweisamkeit
Und Normativität
Im Zweifel für den Zweifel
Und gegen allen Zwang
Im Zweifel für den Teufel
Und den zügellosen Drang

Tocotronic is a German rock band formed in 1993. Similar to Blumfeld or Die Sterne they are considered a part of the Hamburger Schule (Hamburg School) ...
`
        const text3 = `
Genug ist nicht genug

Konstantin Wecker

Daß der Himmel heut so hoch steht,
kann doch wirklich kein Versehen sein.
Und es ist bestimmt kein Zufall,
daß die Lichter sich vom Dunst befrein.

Ich sitz regungslos am Fenster,
ein paar Marktfraun fangen sich ein Lächeln ein.
Irgendwo da draußen pulst es,
und ich hab es satt, ein Abziehbild zu sein.

Nichts wie runter auf die Straße,
und dann renn ich jungen Hunden hinterher.
An den Häusern klebt der Sommer,
und die U-Bahnschächte atmen schwer.

Dieser Stadt schwillt schon der Bauch,
und ich bin zum großen Knall bereit.
Auf den Häusern hockt ein satter Gott
und predigt von Genügsamkeit.`

describe('Ascii Block', () => {

    test('natural width assesment', () => {


        const block = new AsciiBlock(text2)

        let result = intrinsicWidthThreshold(block.getLineSizes(), 0.9)
        expect(result).toEqual(28)
        result = intrinsicWidthThreshold(block.getLineSizes(), 1)
        expect(result).toEqual(154)
        result = intrinsicWidthThreshold(block.getLineSizes(), 0.1)
        expect(result).toEqual(16)
    })

    test('pack with intrinsic widths and layout output', () => {
        const texts = [
            text1,text2,text3,
            `Kurz und knapp.
Nächste Zeile.
Und noch eine.`,
            `A bit more text here that spans multiple lines.
Each line is a bit longer than the last one in this second block.
And here is a really really long line that goes on and on forever and ever.`,
            `short`,
            `Medium length line here.
Another medium line.
Third one.`,
        ]

        const blocks = texts.map((t, i) => new AsciiBlock(t, `block-${i}`))

        const pageW = 80
        const pageH = 50
        const pages = packIntrinsicWidth({ width: pageW, height: pageH }, blocks)

        

        const ascii = renderAsciiPages(pages, pageW, pageH)
        const outDir = join(__dirname, 'test-output')
        mkdirSync(outDir, { recursive: true })
        writeFileSync(join(outDir, 'pack-intrinsic-widths.txt'), ascii, 'utf-8')
    })

    test('sizeCounts aggregates correctly', () => {
        const counts = sizeCounts([1, 2, 2, 3, 3, 3])
        expect(counts.get(1)).toBe(1)
        expect(counts.get(2)).toBe(2)
        expect(counts.get(3)).toBe(3)
    })

    test('intrinsicWidthThreshold throws on invalid leeway', () => {
        expect(() => intrinsicWidthThreshold([10, 20], 0)).toThrow()
        expect(() => intrinsicWidthThreshold([10, 20], 1.1)).toThrow()
    })
})

function renderAsciiPages(pages: PlacedBlock[][], pageW: number, pageH: number): string {
    const sb: string[] = []

    for (let pi = 0; pi < pages.length; pi++) {
        const grid: string[][] = Array.from({ length: pageH }, () =>
            Array.from({ length: pageW }, () => ' '))

        for (const pb of pages[pi]) {
            const block = pb.block as unknown as AsciiBlock
            const fitting = block.height(pb.width)
            for (let li = 0; li < fitting.content.length; li++) {
                const row = pb.y + li
                if (row >= pageH) break
                const line = fitting.content[li]
                for (let ci = 0; ci < line.length; ci++) {
                    const col = pb.x + ci
                    if (col >= pageW) break
                    grid[row][col] = line[ci]
                }
            }
        }

        sb.push('+' + '─'.repeat(pageW) + '+')
        for (let y = 0; y < pageH; y++) {
            sb.push('│' + grid[y].join('') + '│')
        }
        sb.push('+' + '─'.repeat(pageW) + '+')
        sb.push(` Page ${pi + 1} `)
        sb.push('')
    }

    return sb.join('\n')
}
