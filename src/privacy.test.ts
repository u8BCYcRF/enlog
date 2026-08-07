import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const recordPaths = [
  '../data/timeline.tsv',
  '../data/costs.tsv',
  '../logs/activity.md',
  '../articles/outline.md',
  '../articles/note_draft.md',
]

const recordText = recordPaths
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')

describe('privacy safeguards', () => {
  it('does not contain obvious contact identifiers', () => {
    const directIdentifierPatterns = [
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:070|080|090)[- ]?\d{4}[- ]?\d{4}/,
      /0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}/,
      /〒?\d{3}-\d{4}/,
    ]

    directIdentifierPatterns.forEach((pattern) => {
      expect(recordText).not.toMatch(pattern)
    })
  })

  it('does not place exact activity dates in public article drafts', () => {
    const articleText = ['../articles/outline.md', '../articles/note_draft.md']
      .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
      .join('\n')

    expect(articleText).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/)
  })

  it('keeps source data out of the Docker image', () => {
    const dockerfile = readFileSync(
      new URL('../Dockerfile', import.meta.url),
      'utf8',
    )
    const dockerignore = readFileSync(
      new URL('../.dockerignore', import.meta.url),
      'utf8',
    )

    expect(dockerfile).not.toMatch(/^COPY\s+data\b/m)
    expect(dockerignore.split(/\r?\n/)).toContain('data')
  })
})
