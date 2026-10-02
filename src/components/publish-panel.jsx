import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { downloadBlob, pngBlobsToPdf, slugify } from '../lib/export.js';
import { DEFAULT_PUBLISH, PUBLISH_STATUSES, TIKTOK_MAX_PHOTOS, postText } from '../lib/publish.js';

/** Approval status, caption/music suggestion, phone share (QR) and file export for manual TikTok posting. */
export default function PublishPanel({ project, update, blobs, missingFrames }) {
  const publish = { ...DEFAULT_PUBLISH, ...project.publish };
  const setPublish = (patch) => update((p) => ({ publish: { ...DEFAULT_PUBLISH, ...p.publish, ...patch } }));
  const [busy, setBusy] = useState(''); // 'caption' | 'share' | 'export'
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [share, setShare] = useState(null);
  const [linkIndex, setLinkIndex] = useState(0);

  useEffect(() => {
    api.getShare().then(setShare).catch(() => {});
  }, []);

  const text = postText(publish);
  const sharingHere = share?.active && share.projectId === project.id && share.expiresAt > Date.now();
  const link = sharingHere ? share.links[Math.min(linkIndex, share.links.length - 1)] : null;

  async function run(kind, fn) {
    setBusy(kind);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const writeCaption = () =>
    run('caption', async () => {
      if ((publish.caption || publish.hashtags) && !confirm('Ghi đè tiêu đề, caption và gợi ý nhạc hiện tại?')) return;
      const data = await api.generateCaption(project.id, {
        title: project.title,
        storyIdea: project.idea,
        slides: project.slides.map((s) => ({
          idea: s.idea,
          dialogues: s.frames.flatMap((f) => f.dialogues.map((d) => d.text)).filter(Boolean),
        })),
      });
      setPublish(data);
    });

  async function copy(key, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('Không copy được, hãy chọn chữ và copy thủ công.');
    }
  }

  const setStatus = (status) =>
    setPublish({ status, postedAt: status === 'posted' ? publish.postedAt || new Date().toISOString() : null });

  const startShare = () =>
    run('share', async () => {
      const form = new FormData();
      form.append('projectId', project.id);
      form.append('title', publish.title || project.title);
      form.append('text', text);
      form.append('music', [publish.musicMood, publish.musicKeywords && `Tìm: ${publish.musicKeywords}`].filter(Boolean).join('\n'));
      blobs.forEach((blob, i) => form.append('files', blob, `anh-${i + 1}.png`));
      setShare(await api.startShare(form));
      setLinkIndex(0);
    });

  const stopShare = () => run('share', async () => setShare(await api.stopShare()));

  const exportFiles = (asPdf) =>
    run('export', async () => {
      const base = slugify(project.title);
      if (asPdf) downloadBlob(await pngBlobsToPdf(blobs), `${base}.pdf`);
      else blobs.forEach((blob, i) => downloadBlob(blob, `${base}-anh-${i + 1}.png`));
    });

  const field = (key, label, props = {}) => (
    <label>
      {label}
      <input value={publish[key]} onChange={(e) => setPublish({ [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <section className="card stack">
      <div className="row wrap between">
        <h3>Duyệt & đăng TikTok</h3>
        <div className="row">
          {PUBLISH_STATUSES.map((s) => (
            <button key={s.id} className={`tab ${publish.status === s.id ? 'active' : ''}`} onClick={() => setStatus(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="small checklist">
        <li className={missingFrames ? 'warning' : ''}>
          {missingFrames ? `Còn ${missingFrames} khung chưa có ảnh` : '✓ Tất cả khung đã có ảnh'}
        </li>
        <li className={blobs.length > TIKTOK_MAX_PHOTOS ? 'warning' : ''}>
          {blobs.length > TIKTOK_MAX_PHOTOS
            ? `TikTok chỉ cho tối đa ${TIKTOK_MAX_PHOTOS} ảnh mỗi bài (truyện đang có ${blobs.length})`
            : `✓ ${blobs.length} ảnh (TikTok tối đa ${TIKTOK_MAX_PHOTOS})`}
        </li>
        <li className={text ? '' : 'warning'}>{text ? '✓ Đã có caption' : 'Chưa có caption'}</li>
        {publish.postedAt && <li>Đã đăng lúc {new Date(publish.postedAt).toLocaleString('vi-VN')}</li>}
      </ul>

      <div className="publish-grid">
        <div className="stack">
          {field('title', `Tiêu đề (${publish.title.length}/90)`, { maxLength: 90 })}
          <label>
            Caption
            <textarea rows={4} value={publish.caption} onChange={(e) => setPublish({ caption: e.target.value })} />
          </label>
          {field('hashtags', 'Hashtag', { placeholder: '#truyentranh #cam_dong' })}
          <div className="row wrap">
            <button className="primary" disabled={Boolean(busy) || !project.slides.length} onClick={writeCaption}>
              {busy === 'caption' ? 'Gemini đang viết…' : '✨ Gemini viết caption'}
            </button>
            <button disabled={!publish.title} onClick={() => copy('title', publish.title)}>
              {copied === 'title' ? 'Đã copy ✓' : 'Copy tiêu đề'}
            </button>
            <button disabled={!text} onClick={() => copy('text', text)}>
              {copied === 'text' ? 'Đã copy ✓' : 'Copy caption + hashtag'}
            </button>
          </div>
          {field('musicMood', 'Gợi ý nhạc nền')}
          {field('musicKeywords', 'Từ khoá tìm nhạc trong TikTok')}
        </div>

        <div className="stack">
          <div className="label">Đưa ảnh sang điện thoại</div>
          {sharingHere ? (
            <>
              <img className="qr" src={link.qr} alt="Mã QR" />
              {share.links.length > 1 && (
                <select value={linkIndex} onChange={(e) => setLinkIndex(Number(e.target.value))}>
                  {share.links.map((l, i) => (
                    <option key={l.url} value={i}>{l.name} – {new URL(l.url).host}</option>
                  ))}
                </select>
              )}
              <code className="small break">{link.url}</code>
              <p className="muted small">
                Quét bằng camera điện thoại cùng Wi-Fi. Trang có ảnh, tiêu đề, caption và gợi ý nhạc. Tự tắt lúc{' '}
                {new Date(share.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Nếu sửa truyện, bấm chia sẻ lại.
                Không quét được thì thử địa chỉ khác trong danh sách.
              </p>
              <div className="row wrap">
                <button disabled={Boolean(busy)} onClick={startShare}>Chia sẻ lại</button>
                <button className="danger" disabled={Boolean(busy)} onClick={stopShare}>Dừng chia sẻ</button>
              </div>
            </>
          ) : (
            <>
              {share?.active && share.expiresAt > Date.now() && (
                <p className="warning small">Đang chia sẻ một truyện khác, bấm chia sẻ sẽ thay thế.</p>
              )}
              <div>
                <button className="primary" disabled={Boolean(busy) || !blobs.length} onClick={startShare}>
                  {busy === 'share' ? 'Đang mở…' : '📱 Chia sẻ qua Wi-Fi (mã QR)'}
                </button>
              </div>
              <p className="muted small">
                Mở một trang chỉ đọc trong 30 phút, có link bí mật. Lần đầu Windows có thể hỏi quyền mạng cho Node.js, chọn cho phép mạng
                Private.
              </p>
            </>
          )}

          <div className="label">Hoặc tải về máy</div>
          <div className="row wrap">
            <button disabled={Boolean(busy)} onClick={() => exportFiles(false)}>Tải PNG tất cả ảnh</button>
            <button disabled={Boolean(busy)} onClick={() => exportFiles(true)}>Xuất PDF</button>
          </div>
        </div>
      </div>

      {error && <p className="error small">{error}</p>}
      <ol className="small muted checklist">
        <li>Lưu ảnh vào điện thoại theo thứ tự 1 → {blobs.length}.</li>
        <li>TikTok → + → Tải lên → chọn các ảnh theo đúng thứ tự.</li>
        <li>Thêm âm thanh: tìm theo từ khoá gợi ý.</li>
        <li>Dán tiêu đề và caption, rồi đăng.</li>
        <li>Quay lại đây đánh dấu "Đã đăng".</li>
      </ol>
    </section>
  );
}
