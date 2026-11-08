#!/usr/bin/env node
/**
 * One-time OAuth setup for the Chrome Web Store API. Captures Google consent
 * through a local server and saves the refresh token outside the repo.
 *
 * Prerequisite: Google OAuth Desktop credentials at
 * ~/.config/notate/cws-client-secret.json, with the Chrome Web Store API enabled.
 *
 * Usage: npm run cws.auth
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { CONFIG_DIR } from './helpers.mjs';

const tokenPath = join(CONFIG_DIR, 'cws-token.json');
const { client_id, client_secret } = JSON.parse(readFileSync(join(CONFIG_DIR, 'cws-client-secret.json'), 'utf8')).installed;
const REDIRECT_URI = 'http://localhost:8085';

const authUrl = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
  client_id,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/chromewebstore',
  access_type: 'offline',
  prompt: 'consent',
});

function finish(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(`${message}\n`);
  console.log(message);
  process.exitCode = status === 200 ? 0 : 1;
  server.close();
  server.closeAllConnections();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) return finish(res, 400, `Authorization failed: ${error}`);
  if (!code) {
    res.writeHead(400);
    return res.end('No authorization code received.\n');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id, client_secret, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
  });
  const data = await tokenRes.json();
  if (data.error) return finish(res, 400, `Token exchange failed: ${data.error_description || data.error}`);
  if (!data.refresh_token) return finish(res, 400, 'No refresh token returned. Revoke app access and retry.');

  writeFileSync(tokenPath, JSON.stringify({ refresh_token: data.refresh_token }, null, 2) + '\n', { mode: 0o600 });
  finish(res, 200, `Authorization successful. Token saved to ${tokenPath}. You can close this tab.`);
});

server.listen(8085, '127.0.0.1', () => {
  console.log(`Open this URL in your browser:\n\n${authUrl}\n`);
  execFile('xdg-open', [authUrl], () => {});
});
