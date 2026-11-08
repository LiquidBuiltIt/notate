/**
 * Shared helpers for the release scripts. No dependencies, so a release never
 * has to execute anything from node_modules.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The Chrome manifest holds the version users have; package.json has lagged behind it.
export const VERSION_SOURCE = 'src/Static/manifest.chrome.json';
export const VERSION_TARGETS = ['package.json', VERSION_SOURCE];
export const CONFIG_DIR = join(homedir(), '.config', 'notate');
export const CWS_TOKEN_FILE = '.cws-token';

export function readClientSecret(root) {
  const file = readdirSync(root).find((name) => /^client_secret_.*\.json$/.test(name));
  if (!file) throw new Error('No client_secret_*.json in the project root. Download Desktop OAuth credentials from Google Cloud.');
  return JSON.parse(readFileSync(join(root, file), 'utf8')).installed;
}

export const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], { cwd, encoding: 'utf8' }).trim();

export function versionOf(jsonText) {
  return JSON.parse(jsonText).version;
}

export function nextVersion(current, type) {
  // The store version has two parts ("1.1"), so a missing patch counts as 0.
  const [major, minor, patch = 0] = current.split('.').map(Number);
  if (![major, minor, patch].every(Number.isInteger)) throw new Error(`Cannot parse version "${current}"`);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump type "${type}"`);
}

// Text replace, not JSON rewrite, so the diff is one line in each file.
export function setVersion(jsonText, next) {
  if (versionOf(jsonText) === undefined) throw new Error('File has no top-level version');
  return jsonText.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${next}"`);
}

export function bumpLockfile(lockText, next) {
  const lock = JSON.parse(lockText);
  lock.version = next;
  lock.packages[''].version = next;
  return JSON.stringify(lock, null, 2) + '\n';
}

/** A release must start from a clean tree on `main`. `force` skips only the branch check. */
export function assertCleanMain(cwd, { force = false } = {}) {
  const branch = git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (!force && branch !== 'main') {
    throw new Error(`Release bumps run on main, but the current branch is "${branch}". Pass --force to skip the branch check.`);
  }
  const dirty = git(cwd, 'status', '--porcelain');
  if (dirty) throw new Error(`Working tree is not clean — commit or stash first:\n${dirty}`);
}

/** Anything the API does not name as success or in progress is a failure. */
export function uploadOutcome(state) {
  if (state === 'SUCCEEDED') return 'done';
  if (typeof state === 'string' && state.includes('IN_PROGRESS')) return 'wait';
  return 'failed';
}

export const PUBLISH_OK_STATES = ['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'];
