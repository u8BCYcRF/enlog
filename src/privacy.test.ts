import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const repositoryPaths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { cwd: repositoryRoot, encoding: 'utf8' },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)

const repositoryText = repositoryPaths
  .map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'))
  .join('\n')

const deployWorkflow = readFileSync(
  new URL('../.github/workflows/deploy.yml', import.meta.url),
  'utf8',
)

describe('privacy safeguards', () => {
  it('does not contain direct identifiers or repository secrets', () => {
    const directIdentifierPatterns = [
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:070|080|090)[- ]?\d{4}[- ]?\d{4}/,
      /0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}/,
      /〒?\d{3}-\d{4}/,
      /[一-龯ぁ-んァ-ヶ]{2,4}(?:都|道|府|県)[^\n\t]{0,24}[一-龯ぁ-んァ-ヶ]{1,8}(?:市|区|町|村)/,
      /\b(?:LINE|Instagram|Twitter|Facebook|SNS)\b[^\n]{0,12}(?:ID|アカウント)[\s:：]+[A-Za-z0-9_.-]{3,}/i,
      /gh[pousr]_[A-Za-z0-9_]{20,}/,
      /github_pat_[A-Za-z0-9_]{20,}/,
      /AKIA[0-9A-Z]{16}/,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    ]

    directIdentifierPatterns.forEach((pattern) => {
      expect(repositoryText).not.toMatch(pattern)
    })
  })

  it('does not track files likely to contain private source material', () => {
    const forbiddenFilePattern =
      /(?:^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:pem|key|p12|pfx|jpe?g|png|gif|webp|heic|pdf|docx?|xlsx?|zip))$/i
    const forbiddenPaths = repositoryPaths.filter((path) =>
      forbiddenFilePattern.test(path),
    )

    expect(forbiddenPaths).toEqual([])
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

  it('runs privacy tests before packaging explicitly approved public data', () => {
    const privacyCheck = deployWorkflow.indexOf('run: npm test')
    const publicDataCopy = deployWorkflow.indexOf(
      'cp data/timeline.tsv data/costs.tsv dist/data/',
    )

    expect(privacyCheck).toBeGreaterThan(-1)
    expect(publicDataCopy).toBeGreaterThan(privacyCheck)
    expect(deployWorkflow).not.toContain('cp data/*.tsv')
    expect(deployWorkflow).not.toContain('cp -r data')
    expect(deployWorkflow).not.toContain('logs/')
  })
})
