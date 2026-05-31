import { expect, test, describe } from 'vitest'
import { AsciiBlock, maxClamp } from '../src/placement-block.js'

test('simple clamping', () => {
    const line = "acb adfs asf"
    const result = maxClamp(line, 4)
    expect(result).toEqual(['acb', 'adfs', 'asf'])
})

test('overword clamping', () => {
    const line = "acbasdf adfs asf"
    const result = maxClamp(line, 4)
    expect(result).toEqual(['acba', 'sdf', 'adfs', 'asf'])
})
test('overword clamping', () => {
    const line = "z acbasdfehb adfs asf"
    const result = maxClamp(line, 4)
    expect(result).toEqual(['z', 'acba', 'sdfe', 'hb', 'adfs', 'asf'])
})

describe('Ascii Block', () => {
    test('simple', () => {
        const text = `Hans grossenbacher von Pferdi
    juerg`
        const ascii = new AsciiBlock(text)
        const result = ascii.height(10)
        console.log(result)
        const result2 = ascii.height(50)
        console.log(result2)
    })




})
