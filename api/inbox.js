// August — file d'import (Vercel Blob privé)
// POST /api/inbox  { url, app }        → met le lien en file : inbox/<app>/<code>.json
// GET  /api/inbox?app=x&codes=a,b      → statut de chaque lien : pending | done | failed
// Le Mac (august-import) dépile la file, rédige la fiche, déploie, puis écrit done/<code>.json.
import { put, head } from '@vercel/blob';

const APPS = ['maman', 'pwa'];
const ALLOWED = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|youtube\.com|youtu\.be|m\.youtube\.com)\//i;

function codeOf(url) {
  const m = url.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/) || url.match(/\/video\/(\d+)/)
    || url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]+)/) || url.match(/tiktok\.com\/([A-Za-z0-9]+)\/?$/);
  return m ? m[1] : null;
}

async function readJson(pathname) {
  try {
    const meta = await head(pathname);
    const r = await fetch(meta.downloadUrl || meta.url, {
      headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { url: raw, app } = req.body || {};
    const url = String(raw || '').trim().split('?')[0];
    if (!APPS.includes(app)) return res.status(400).json({ error: 'app inconnue' });
    if (!ALLOWED.test(url) || url.length > 300) return res.status(400).json({ error: 'Colle un lien Instagram, TikTok ou YouTube' });
    const code = codeOf(url) || Buffer.from(url).toString('base64url').slice(-16);
    const done = await readJson(`done/${app}/${code}.json`);
    if (done) return res.status(200).json({ code, ...done });
    await put(`inbox/${app}/${code}.json`, JSON.stringify({ url, app, code, at: new Date().toISOString() }), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    return res.status(200).json({ code, status: 'pending' });
  }

  if (req.method === 'GET') {
    const app = APPS.includes(req.query.app) ? req.query.app : 'maman';
    const codes = String(req.query.codes || '').split(',').filter(Boolean).slice(0, 20);
    const out = {};
    for (const code of codes) out[code] = (await readJson(`done/${app}/${code}.json`)) || { status: 'pending' };
    return res.status(200).json(out);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
