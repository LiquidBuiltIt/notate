#!/usr/bin/env node
/**
 * Release prep. Bumps the version in package.json, package-lock.json and the
 * Chrome manifest, then commits.
 *
 * Usage:
 *   npm run version.bump patch "fix a bug"
 *   npm run version.bump minor "update dependencies"
 *   npm run version.bump major "breaking changes"
 *   npm run version.bump rollback    # undo the last unpushed bump
 *
 * Requires a clean working tree on `main`. `--force` skips the branch check
 * only, for running from a worktree. A dirty tree always aborts.
 *
 * Tagging happens in `npm run publish`, so tags exist only for shipped versions.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION_SOURCE, VERSION_TARGETS, git, versionOf, nextVersion, setVersion, bumpLockfile, assertCleanMain } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((a) => a !== '--force');
const bumpType = positional[0];
const blurb = positional.slice(1).join(' ').trim();

function abort(message) {
  console.error(message);
  console.error('Nothing was modified.');
  process.exit(1);
}

if (!['patch', 'minor', 'major', 'rollback'].includes(bumpType)) {
  abort('Usage: npm run version.bump <patch|minor|major|rollback> <blurb> [--force]');
}

if (bumpType === 'rollback') {
  const lastMsg = git(root, 'log', '-1', '--format=%s');
  const match = lastMsg.match(/^v(\d+\.\d+\.\d+)/);
  if (!match) abort(`Last commit is not a version bump: "${lastMsg}"`);
  if (!git(root, 'log', '--oneline', 'origin/main..HEAD')) abort('The last bump is already pushed. Use git revert instead.');
  git(root, 'reset', '--keep', 'HEAD~1');
  console.log(`Rolled back v${match[1]} to v${versionOf(read(VERSION_SOURCE))}`);
  process.exit(0);
}

if (!blurb) abort(`A release blurb is required: npm run version.bump ${bumpType} "short summary"`);

let current, next, lockContent;
try {
  assertCleanMain(root, { force });
  current = versionOf(read(VERSION_SOURCE));
  next = nextVersion(current, bumpType);
  // Computed before any write, so a malformed lockfile leaves the tree untouched.
  lockContent = bumpLockfile(read('package-lock.json'), next);
} catch (err) {
  abort(err.message);
}

for (const rel of VERSION_TARGETS) writeFileSync(join(root, rel), setVersion(read(rel), next));
writeFileSync(join(root, 'package-lock.json'), lockContent);

git(root, 'add', '--', ...VERSION_TARGETS, 'package-lock.json');
git(root, 'commit', '-m', `v${next} — ${blurb}`);

console.log(`Committed v${next} (was ${current}). To ship:`);
console.log('  1. Run the production build sealed, then commit dist/');
console.log('  2. npm run publish -- --dry');
console.log('  3. npm run publish');
