#!/usr/bin/env node
/**
 * Release pipeline: tags and pushes to GitHub, then submits to the Chrome Web Store.
 *
 * Usage:
 *   npm run publish                 # GitHub + store submission
 *   npm run publish -- --dry        # pre-flight checks only, nothing leaves the machine
 *   npm run publish -- --draft      # store upload only: no GitHub push, no submission
 *   npm run publish -- --no-github  # store submission without the GitHub push
 *
 * This script never builds. It ships the committed dist/chrome, which must come
 * from a sealed production build, because dependency code is not trusted on the host.
 *
 * Store credentials live in the main checkout, both ignored by git: client_secret_*.json
 * and .cws-token (from `npm run cws.auth`). ~/.config/notate/ holds CWS_PUBLISHER_ID
 * and GITHUB_TOKEN.
 */

import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CONFIG_DIR, CWS_TOKEN_FILE, PUBLISH_OK_STATES, credentialRoot, VERSION_SOURCE, git, readClientSecret, versionOf, uploadOutcome } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = join(root, 'dist', 'chrome');
const credRoot = credentialRoot(root);
const githubTokenPath = join(CONFIG_DIR, 'GITHUB_TOKEN');

const EXTENSION_ID = 'mienhcnmknnplcaheeelfggdagmighap';
const CWS_API = 'https://chromewebstore.googleapis.com';
const COUNTDOWN_SECONDS = 10;

const flags = process.argv.slice(2);
const isDry = flags.includes('--dry');
const isDraft = flags.includes('--draft');
const skipGithub = isDraft || flags.includes('--no-github');

const read = (path) => readFileSync(path, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (msg) => console.log(`  ok  ${msg}`);

function die(message) {
  console.error(`\nFAILED: ${message}\n`);
  process.exit(1);
}

// ── Chrome Web Store (API V2) ─────────────────────────────────

async function cwsFetch(url, token, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status} ${text}`);
  return JSON.parse(text);
}

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data.access_token;
}

function packageExtension(version) {
  const dir = mkdtempSync(join(tmpdir(), 'notate-release-'));
  const zipPath = join(dir, `notate-${version}.zip`);
  // Run from inside dist/chrome: the store needs manifest.json at the zip root.
  execFileSync('zip', ['-q', '-r', '-X', zipPath, '.', '-x', '*.DS_Store'], { cwd: distDir });
  return zipPath;
}

async function uploadToStore(token, itemName, zipPath) {
  let data = await cwsFetch(`${CWS_API}/upload/v2/${itemName}:upload`, token, { method: 'POST', body: readFileSync(zipPath) });
  let state = data.uploadState;

  for (let attempt = 0; uploadOutcome(state) === 'wait' && attempt < 24; attempt++) {
    await sleep(5000);
    data = await cwsFetch(`${CWS_API}/v2/${itemName}:fetchStatus`, token);
    state = data.lastAsyncUploadState;
  }

  if (uploadOutcome(state) !== 'done') throw new Error(`Upload did not succeed (state: ${state}): ${JSON.stringify(data)}`);
  ok(`Uploaded to the store${data.crxVersion ? ` as ${data.crxVersion}` : ''}`);
}

async function submitToStore(token, itemName) {
  const data = await cwsFetch(`${CWS_API}/v2/${itemName}:publish`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!PUBLISH_OK_STATES.includes(data.state)) throw new Error(`Submission refused (state: ${data.state}): ${JSON.stringify(data)}`);
  ok(`Submitted to the store (state: ${data.state})`);
}

// ── Pre-flight ────────────────────────────────────────────────

async function preflight() {
  console.log('\nPre-flight checks\n');

  for (const path of [join(credRoot, CWS_TOKEN_FILE), join(CONFIG_DIR, 'CWS_PUBLISHER_ID')]) {
    if (!existsSync(path)) die(`${path} not found. See the header of this script.`);
  }
  let clientId, clientSecret;
  try {
    ({ client_id: clientId, client_secret: clientSecret } = readClientSecret(credRoot));
  } catch (err) {
    die(err.message);
  }
  const { refresh_token: refreshToken } = JSON.parse(read(join(credRoot, CWS_TOKEN_FILE)));
  const publisherId = read(join(CONFIG_DIR, 'CWS_PUBLISHER_ID')).trim();
  const token = await getAccessToken({ clientId, clientSecret, refreshToken }).catch((err) => die(err.message));
  ok('Store credentials valid');

  const version = versionOf(read(join(root, VERSION_SOURCE)));
  const versions = {
    [VERSION_SOURCE]: version,
    'package.json': versionOf(read(join(root, 'package.json'))),
    'dist/chrome/manifest.json': versionOf(read(join(distDir, 'manifest.json'))),
  };
  if (new Set(Object.values(versions)).size !== 1) {
    die(`Version mismatch. Run version.bump, then rebuild dist/ sealed:\n${JSON.stringify(versions, null, 2)}`);
  }
  ok(`All version files and dist/ at v${version}`);

  if (skipGithub) {
    console.log('  --   Skipping git checks');
  } else {
    if (!existsSync(githubTokenPath)) die(`${githubTokenPath} not found.`);
    const dirty = git(root, 'status', '--porcelain');
    if (dirty) die(`Working tree is dirty:\n${dirty}`);
    ok('Working tree clean');

    // An existing tag must point at HEAD, or this version number was already used.
    let tagSha = null;
    try { tagSha = git(root, 'rev-parse', '--verify', '--quiet', `refs/tags/v${version}^{commit}`); } catch { /* no tag yet */ }
    if (tagSha && tagSha !== git(root, 'rev-parse', 'HEAD')) die(`Tag v${version} exists on another commit. Bump to a new version.`);
    ok(tagSha ? `Tag v${version} already on HEAD` : `No conflicting tag for v${version}`);
  }

  return { version, token, itemName: `publishers/${publisherId}/items/${EXTENSION_ID}` };
}

// ── Pipeline ──────────────────────────────────────────────────

function pushToGitHub(version) {
  const tag = `v${version}`;
  let createdTag = false;
  try { git(root, 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}`); } catch {
    git(root, 'tag', tag);
    createdTag = true;
  }

  const helper = `!f() { echo username=LiquidBuiltIt; echo "password=$(cat ${githubTokenPath})"; }; f`;
  try {
    git(root, '-c', 'credential.helper=', '-c', `credential.helper=${helper}`, 'push', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}`);
    ok(`Pushed main and ${tag}`);
  } catch (err) {
    // A stale local tag would make a retry think this version already shipped.
    if (createdTag) git(root, 'tag', '-d', tag);
    throw err;
  }
}

async function main() {
  const { version, token, itemName } = await preflight();

  if (isDry) {
    console.log('\nAll pre-flight checks passed. Nothing left this machine.\n');
    return;
  }

  const targets = [skipGithub ? null : 'GitHub', isDraft ? 'store upload (draft)' : 'Chrome Web Store submission'].filter(Boolean);
  console.log(`\nAbout to release v${version} to: ${targets.join(' + ')}`);
  console.log(`Press Ctrl-C within ${COUNTDOWN_SECONDS} seconds to abort.\n`);
  await sleep(COUNTDOWN_SECONDS * 1000);

  // GitHub goes first: a failed push stops the release before the store sees it.
  if (!skipGithub) pushToGitHub(version);

  const zipPath = packageExtension(version);
  try {
    await uploadToStore(token, itemName, zipPath);
    if (!isDraft) await submitToStore(token, itemName);
  } finally {
    rmSync(dirname(zipPath), { recursive: true, force: true });
  }

  console.log(isDraft
    ? '\nDraft uploaded. Review it at https://chrome.google.com/webstore/devconsole\n'
    : `\nv${version} submitted. Users get it after the store review finishes.\n`);
}

main().catch((err) => die(err.message));
