#!/usr/bin/env node
// Leak gate: refuses to let personal or private data reach the public repository.
//
//   node scripts/leak-gate.mjs          full gate (maintainer, before every push): generic rules + private denylist
//                                        + commit identities and messages. Fails if the denylist is missing.
//   node scripts/leak-gate.mjs --ci      generic rules only (CI has no private denylist).
//
// The private denylist lives OUTSIDE the repository, one literal per line or /regex/flags, '#' for comments:
//   $LEAK_DENYLIST_FILE, else ~/.config/bcr32-studio/leak-denylist.txt
// Findings are reported as file + rule only: the matched text is never printed.
// A self-test plants every rule in a temporary file first; the gate refuses to pass if any planted sample is missed.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ci = process.argv.includes('--ci')
const artifactIndex = process.argv.indexOf('--artifact')
const artifactArg = artifactIndex < 0 ? null : process.argv[artifactIndex + 1]
if (artifactIndex >= 0 && (!artifactArg || artifactArg.startsWith('--'))) throw Error('--artifact requires a directory')
const root = new URL('..', import.meta.url).pathname

// Generic rules: shapes that never belong in this repository, whoever the maintainer is. Each carries a sample used by
// the self-test (built by concatenation so that this file does not trip its own rules).
const at = '@', slash = '/'
const generic = [
  { name: 'home-directory path', re: /(?:\/Users\/|\/home\/)[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\/g, sample: slash + 'Users' + slash + 'someone' + slash + 'x' },
  { name: 'e-mail address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, sample: 'someone' + at + 'example.org',
    allow: m => /@users\.noreply\.github\.com$|@anthropic\.com$|^(noreply|support)@github\.com$/.test(m) }, // bots' sign-off lines
  { name: 'private IPv4 address', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, sample: '192.' + '168.1.20' },
  { name: 'Cloudflare account id', re: /account_id"?\s*[:=]\s*"?[0-9a-f]{32}/gi, sample: 'account_id = "' + 'a'.repeat(32) + '"' },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, sample: 'ghp' + '_' + 'A'.repeat(36) },
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, sample: '-----BEGIN ' + 'PRIVATE KEY-----' },
  { name: 'bearer/API token assignment', re: /\b(?:api[_-]?token|api[_-]?key|secret)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/gi, sample: 'api_token = "' + 'x'.repeat(30) + '"' },
]
// Files whose content is binary: embedded metadata blocks (EXIF, XMP, GPS) are refused, plus the denylist (literal bytes).
const embedded = [{ name: 'embedded image metadata (EXIF/XMP/GPS)', re: /Exif\x00\x00|<x:xmpmeta|GPSLatitude/g, sample: 'Exif' + '\x00\x00' }]
const binary = /\.(png|jpe?g|webp|gif|ico|ttf|otf|woff2?|pdf)$/i

function loadDenylist() {
  const file = process.env.LEAK_DENYLIST_FILE || join(homedir(), '.config', 'bcr32-studio', 'leak-denylist.txt')
  if (!existsSync(file)) return { file, rules: null }
  const rules = readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map((line, i) => {
    const regex = /^\/(.+)\/([a-z]*)$/.exec(line)
    return { name: `denylist entry #${i + 1}`, re: regex ? new RegExp(regex[1], regex[2].includes('g') ? regex[2] : regex[2] + 'g') : new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), literal: regex ? null : line }
  })
  return { file, rules }
}

function scanText(text, rules) {
  const hits = []
  for (const rule of rules) {
    rule.re.lastIndex = 0
    const matches = [...text.matchAll(rule.re)].map(m => m[0]).filter(m => !rule.allow?.(m))
    if (matches.length) hits.push({ rule: rule.name, count: matches.length })
  }
  return hits
}

function selfTest(rules) {
  const dir = mkdtempSync(join(tmpdir(), 'leak-gate-'))
  try {
    const missed = []
    for (const rule of rules) {
      const sample = rule.sample ?? rule.literal ?? null
      if (sample === null) continue // regex denylist entries carry no sample
      const file = join(dir, 'probe.txt'); writeFileSync(file, `before ${sample} after\n`)
      if (!scanText(readFileSync(file, 'utf8'), [rule]).length) missed.push(rule.name)
    }
    // And the allow-list must not swallow a real address.
    if (scanText('no-reply' + at + 'users.noreply.github.com', generic).length) missed.push('noreply allow-list')
    return missed
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const findings = []
const { file: denyFile, rules: deny } = loadDenylist()
if (!ci && !deny) { console.error(`FAIL: private denylist not found (${denyFile}). Create it or set LEAK_DENYLIST_FILE; use --ci for generic rules only.`); process.exit(1) }
const rules = ci ? generic : [...generic, ...deny]
const missed = selfTest([...rules, ...embedded])
if (missed.length) { console.error(`FAIL: self-test missed ${missed.length} rule(s): ${missed.join(', ')}. The gate cannot be trusted.`); process.exit(1) }

// 1. Every file that would be published: tracked + untracked-but-not-ignored.
const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).filter(f => existsSync(join(root, f)))
for (const f of files) {
  if (f === 'scripts/leak-gate.mjs') continue // carries the rule shapes themselves
  const buffer = readFileSync(join(root, f))
  const text = binary.test(f) ? buffer.toString('latin1') : buffer.toString('utf8')
  const hits = scanText(text, binary.test(f) ? [...embedded, ...(ci ? [] : deny)] : rules)
  for (const h of hits) findings.push(`${f}: ${h.rule} (${h.count})`)
}
// Also inspect the exact built assets, which are deliberately ignored by Git.
let artifactFiles = 0
if (artifactArg) {
  const directory = resolve(root, artifactArg)
  const visit = (relative = '') => {
    for (const entry of readdirSync(join(directory, relative), {withFileTypes:true})) {
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw Error('Artifact symlinks are not accepted')
      if (entry.isDirectory()) { visit(name); continue }
      const buffer = readFileSync(join(directory, name)); artifactFiles++
      const isBinary = binary.test(name)
      for (const hit of scanText(buffer.toString(isBinary ? 'latin1' : 'utf8'), isBinary ? [...embedded, ...(ci ? [] : deny)] : rules)) findings.push(`artifact/${name}: ${hit.rule} (${hit.count})`)
    }
  }
  visit()
}
// 2. Commit identities and messages (absent before the first commit).
let commits = ''
try { commits = git(['log', '--all', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x01']) } catch { /* no commit yet */ }
for (const record of commits.split('\x01').map(r => r.trim()).filter(Boolean)) {
  const [hash, an, ae, cn, ce, message] = record.split('\x00')
  for (const [who, email] of [['author', ae], ['committer', ce]]) if (!/@users\.noreply\.github\.com$/.test(email) && email !== 'noreply@github.com') findings.push(`commit ${hash.slice(0, 10)}: ${who} e-mail is not a GitHub noreply address`)
  for (const h of scanText(`${an}\n${cn}\n${message}`, rules)) findings.push(`commit ${hash.slice(0, 10)}: ${h.rule} (${h.count}) in identity or message`)
}
// 3. Local git identity that the next commit would use.
if (!ci) {
  let email = ''
  try { email = git(['config', 'user.email']).trim() } catch { /* unset */ }
  if (!/@users\.noreply\.github\.com$/.test(email)) findings.push('git config user.email is not a GitHub noreply address')
}

const scope = ci ? 'generic rules' : `generic rules + ${deny.length} private denylist entries`
if (findings.length) { console.error(`FAIL leak gate (${scope}), ${findings.length} finding(s):\n- ${findings.join('\n- ')}`); process.exit(1) }
console.log(`PASS leak gate (${scope}): ${files.length} source files, ${artifactFiles} artifact files, ${commits ? commits.split('\x01').filter(r => r.trim()).length : 0} commits, self-test ${rules.length - rules.filter(r => !r.sample && !r.literal).length} rules`)
