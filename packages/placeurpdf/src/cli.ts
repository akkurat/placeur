#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { generatePdf } from './index.js'

const args = process.argv.slice(2)

function printHelp() {
  console.log(`
Usage: placeurpdf <input-dir> [options]

Options:
  -o, --output <file>     Output PDF file (default: output.pdf)
  -c, --columns <number>  Number of columns (default: 1)
  -g, --gutter <number>   Column gutter in mm (default: 8)
  --font-size <number>    Body font size (default: 11)
  --title-size <number>   Title font size (default: 14)
  -h, --help              Show this help
  `)
}

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  printHelp()
  process.exit(0)
}

const inputDir = resolve(args[0])

if (!existsSync(inputDir)) {
  console.error('Error: input directory does not exist:', inputDir)
  process.exit(1)
}

if (!statSync(inputDir).isDirectory()) {
  console.error('Error: input path is not a directory:', inputDir)
  process.exit(1)
}

const opts: Record<string, string> = {}
for (let i = 1; i < args.length; i++) {
  const arg = args[i]
  if (arg === '-o' || arg === '--output') {
    opts.output = args[++i]
  } else if (arg === '-c' || arg === '--columns') {
    opts.columns = args[++i]
  } else if (arg === '-g' || arg === '--gutter') {
    opts.gutter = args[++i]
  } else if (arg === '--font-size') {
    opts.fontSize = args[++i]
  } else if (arg === '--title-size') {
    opts.titleSize = args[++i]
  }
}

try {
  generatePdf({
    inputDir,
    output: opts.output,
    columns: opts.columns ? Number(opts.columns) : undefined,
    gutter: opts.gutter ? Number(opts.gutter) : undefined,
    fontSize: opts.fontSize ? Number(opts.fontSize) : undefined,
    titleFontSize: opts.titleSize ? Number(opts.titleSize) : undefined,
  })
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
