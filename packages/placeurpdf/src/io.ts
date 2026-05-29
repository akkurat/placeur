import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join, relative } from 'node:path'

export interface Section {
  title: string
  content: string
}

export function findFiles(dir: string, baseDir: string): Section[] {
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
