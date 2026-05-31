interface BlockFitting {
    height: number;
    /** counting by original lines (input) */
    linesBroken: number;
    /** counting by output lines*/
    numberWrappedLines: number
   content: string[] 
}
interface FlowBlock {

    height(width: number): BlockFitting

}

// maybe this belongs to testing only

export class AsciiBlock implements FlowBlock {
    text: string;
    readonly originalLines: string[];

    constructor(text: string) {
        this.text = text
        this.originalLines = this.text.split("\n")
    }
    getLineSizes() {
       // in ascii width exactly equal to character count 
        const sizes = this.originalLines.map(l=>l.length)
        return sizes
    }
    
    // we take as a with just the number of blocks
    // and height is the lines its using



    height(width: number): BlockFitting {
        const wrapped = []

        let linesBroken = 0, numberWrappedLines = 0;

        for (const originalLine of this.originalLines) {
            const clampedLines = maxClamp(originalLine, width)
            wrapped.push(...clampedLines)

            if (clampedLines.length > 1) {
                linesBroken++;
                numberWrappedLines += clampedLines.length
            }
        }

        return {
            height: wrapped.length,
            content: wrapped,
            linesBroken,
            numberWrappedLines
        }

    }
} 

/**
 * 
 * splits the text into chunks of lines <= width
 * if possible split at whites space only
 * if not possible, words will be hardbroken after width 
 * 
 * @param text 
 * @param width number of characters / int 
 */
export function maxClamp(text: string, width: number): string[] {
    if (width <= 0) return []
    if (text.length <= width) return [text]

    const words = text.split(/\W/)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
        if (word.length > width) {
            if (current.length > 0) {
                lines.push(current)
                current = ""
            }
            for (let i = 0; i < word.length; i += width) {
                lines.push(word.slice(i, i + width))
            }
        } else {
            const candidate = current.length > 0 ? current + " " + word : word
            if (candidate.length <= width) {
                current = candidate
            } else {
                lines.push(current)
                current = word
            }
        }
    }

    if (current.length > 0) {
        lines.push(current)
    }

    return lines
}

