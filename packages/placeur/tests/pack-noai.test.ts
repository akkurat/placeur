import { expect, test, describe } from 'vitest'
import { AsciiBlock, maxClamp } from '../src/placement-block.js'
import { intrinsicWidthThreshold, packIntrinsicWidth } from '../src/pack-noai.js'

describe('Ascii Block', () => {

    test('natural width assesment', () => {

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


        const block = new AsciiBlock(text2)

        let result = intrinsicWidthThreshold(block.getLineSizes(), 0.9)
        expect(result).toEqual(28)
        result = intrinsicWidthThreshold(block.getLineSizes(), 1)
        expect(result).toEqual(154)
        result = intrinsicWidthThreshold(block.getLineSizes(), 0.1)
        expect(result).toEqual(16)

    })

    test('basic', () => {
        // actually whe should mock the call to other libary...


        const output = packIntrinsicWidth()
    })



})
