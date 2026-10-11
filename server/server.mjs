// A small upload endpoint plus a static file server for the built Angular app.
//
//   POST /api/upload?delay=2000   reads the whole body, waits `delay` ms, answers 200 JSON
//        &fail=1                  answers 500 after the delay instead
//        &kbps=4000               reads the body slowly (kilobytes per second), so "sending" lasts
//   GET  /api/log                 what the server saw: received, answered, aborted (and when)
//   POST /api/log/reset           clears that log
//
// Everything else is served from dist/angular-upload-progress-bar-demo/browser.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 4370);
const ROOT = fileURLToPath(new URL('../dist/angular-upload-progress-bar-demo/browser/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon' };

let log = [];
let nextId = 1;
const t0 = Date.now();
const now = () => Date.now() - t0;

function upload(req, res, url) {
  const id = nextId++;
  const delay = Number(url.searchParams.get('delay') ?? 2000);
  const fail = url.searchParams.get('fail') === '1';
  const kbps = Number(url.searchParams.get('kbps') ?? 0);
  const entry = { id, contentLength: Number(req.headers['content-length'] ?? -1), bytes: 0, startedAt: now() };
  log.push(entry);

  let received = false;
  let answered = false;

  req.on('data', (chunk) => {
    entry.bytes += chunk.length;
    if (kbps > 0) {
      // Pause long enough that this chunk took chunk.length / kbps to "arrive".
      req.pause();
      setTimeout(() => req.resume(), (chunk.length / (kbps * 1024)) * 1000);
    }
  });

  req.on('end', () => {
    received = true;
    entry.receivedAt = now();
    // The "work": a virus scan, an image resize, a database write. Here, a timer.
    setTimeout(() => {
      if (res.destroyed) return;
      answered = true;
      entry.answeredAt = now();
      res.writeHead(fail ? 500 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fail ? { error: 'scan failed' } : { id, bytes: entry.bytes }));
    }, delay);
  });

  // 'close' on the response fires when the socket goes away. Before we answered, that is an abort.
  res.on('close', () => {
    if (answered) return;
    entry.abortedAt = now();
    entry.abortedWhile = received ? 'processing' : 'receiving';
  });
}

async function serveStatic(res, pathname) {
  const file = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\]+/, '');
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(join(ROOT, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api/upload') return upload(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/log') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(log));
  }
  if (req.method === 'POST' && url.pathname === '/api/log/reset') {
    log = [];
    res.writeHead(204);
    return res.end();
  }
  return serveStatic(res, url.pathname);
}).listen(PORT, () => console.log(`upload demo on http://localhost:${PORT}`));
