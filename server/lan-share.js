// Temporary read-only share page on the local Wi-Fi so a phone can save the story images and copy the caption.
// Runs as a separate HTTP server on 0.0.0.0 that only serves /s/<token>; the main tool API stays bound to 127.0.0.1.
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import QRCode from 'qrcode';

const SHARE_PORT = Number(process.env.SHARE_PORT) || 5175;
const TTL_MS = 30 * 60 * 1000;
const VIRTUAL_ADAPTER = /vethernet|virtual|vmware|hyper-v|wsl|docker|loopback|tailscale|zerotier|vpn/i;

let share = null; // { projectId, token, title, text, music, files: Buffer[], links, expiresAt, server, timer }

/** IPv4 LAN addresses, real Wi-Fi/Ethernet adapters and home-network ranges first. */
function lanAddresses() {
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      list.push({ name, ip: a.address });
    }
  }
  const score = ({ name, ip }) =>
    (VIRTUAL_ADAPTER.test(name) ? 10 : 0) + (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return list.sort((a, b) => score(a) - score(b));
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function tokenMatches(candidate) {
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(share.token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function copyBlock(id, label, value, rows) {
  if (!value) return '';
  return `<section><div class="label">${label}</div>
<textarea id="${id}" rows="${rows}" readonly>${escapeHtml(value)}</textarea>
<button data-copy="${id}">Copy ${label.toLowerCase()}</button></section>`;
}

function sharePage(s) {
  const base = `/s/${s.token}`;
  const figures = s.files
    .map(
      (_, i) => `<figure><img src="${base}/${i + 1}.png" alt="Ảnh ${i + 1}" loading="lazy">
<figcaption>Ảnh ${i + 1}/${s.files.length} · <a href="${base}/${i + 1}.png?download=1" download="anh-${i + 1}.png">Tải ảnh</a></figcaption></figure>`,
    )
    .join('');
  const expires = new Date(s.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(s.title || 'Truyện')}</title>
<style>
body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#f5f1e8;color:#2b2118}
h1{font-size:1.3rem;margin:0 0 8px}.tip{font-size:.9rem;color:#6b5d48;margin:0 0 16px}
section{background:#fffdf8;border:1px solid #e2d9c6;border-radius:12px;padding:12px;margin-bottom:12px}
.label{font-weight:600;margin-bottom:6px}textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid #e2d9c6;border-radius:8px;padding:8px}
button{margin-top:8px;font:inherit;font-weight:600;padding:10px 14px;border-radius:8px;border:0;background:#c8621e;color:#fff;width:100%}
figure{margin:0 0 20px}img{width:100%;border-radius:8px;display:block}
figcaption{padding:6px 2px;font-size:.95rem}a{color:#c8621e;font-weight:600}
</style></head><body>
<h1>${escapeHtml(s.title || 'Truyện')}</h1>
<p class="tip">iPhone: nhấn giữ ảnh → "Lưu vào Ảnh". Android: bấm "Tải ảnh". Lưu theo thứ tự 1 → ${s.files.length}, rồi trong TikTok chọn ảnh đúng thứ tự. Trang tự tắt lúc ${expires}.</p>
${copyBlock('title', 'Tiêu đề', s.title, 2)}
${copyBlock('text', 'Caption', s.text, 6)}
${copyBlock('music', 'Gợi ý nhạc', s.music, 3)}
${figures}
<script>
document.querySelectorAll('[data-copy]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var el = document.getElementById(btn.dataset.copy);
    el.focus(); el.select(); el.setSelectionRange(0, 999999);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    btn.textContent = ok ? 'Đã copy ✓' : 'Chữ đã được chọn, nhấn giữ để copy';
  });
});
</script></body></html>`;
}

function handleRequest(req, res) {
  const parts = new URL(req.url, 'http://lan').pathname.split('/').filter(Boolean);
  if (!share || parts[0] !== 's' || !tokenMatches(parts[1]) || Date.now() > share.expiresAt) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Link đã hết hạn hoặc không tồn tại.');
  }
  if (parts.length === 2) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(sharePage(share));
  }
  const index = Number(/^(\d+)\.png$/.exec(parts[2] || '')?.[1]) - 1;
  const file = share.files[index];
  if (parts.length !== 3 || !file) {
    res.writeHead(404);
    return res.end();
  }
  const download = new URL(req.url, 'http://lan').searchParams.has('download');
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': file.length,
    'Cache-Control': 'no-store',
    ...(download ? { 'Content-Disposition': `attachment; filename="anh-${index + 1}.png"` } : {}),
  });
  res.end(file);
}

export function shareStatus() {
  if (!share) return { active: false };
  return { active: true, projectId: share.projectId, links: share.links, expiresAt: share.expiresAt, count: share.files.length };
}

export async function stopShare() {
  if (!share) return;
  const { server, timer } = share;
  share = null;
  clearTimeout(timer);
  await new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

/** Replaces any running share with a new one and returns links + QR codes for each LAN address. */
export async function startShare({ projectId, title, text, music, files }) {
  await stopShare();
  const addresses = lanAddresses();
  if (!addresses.length) {
    const err = new Error('Không tìm thấy mạng Wi-Fi/LAN trên máy này.');
    err.status = 409;
    throw err;
  }

  const server = http.createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        err.message = `Cổng ${SHARE_PORT} đang bị dùng. Đổi SHARE_PORT trong file .env.`;
        err.status = 409;
      }
      reject(err);
    });
    server.listen(SHARE_PORT, '0.0.0.0', resolve);
  });

  const token = crypto.randomBytes(18).toString('hex');
  const links = await Promise.all(
    addresses.map(async ({ name, ip }) => {
      const url = `http://${ip}:${SHARE_PORT}/s/${token}`;
      return { name, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 260 }) };
    }),
  );
  const timer = setTimeout(() => stopShare().catch(() => {}), TTL_MS);
  timer.unref();
  share = { projectId, token, title, text, music, files, links, expiresAt: Date.now() + TTL_MS, server, timer };
  return shareStatus();
}
