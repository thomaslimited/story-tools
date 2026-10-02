// Publishing metadata for posting a story manually on TikTok (photo carousel).

export const TIKTOK_MAX_PHOTOS = 35;

export const PUBLISH_STATUSES = [
  { id: 'draft', label: 'Nháp' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'posted', label: 'Đã đăng' },
];

export const DEFAULT_PUBLISH = {
  status: 'draft',
  title: '',
  caption: '',
  hashtags: '',
  musicMood: '',
  musicKeywords: '',
  postedAt: null,
};

export const statusLabel = (id) => PUBLISH_STATUSES.find((s) => s.id === id)?.label || 'Nháp';

/** Caption followed by hashtags, the text pasted into TikTok's description field. */
export const postText = (publish) => [publish.caption?.trim(), publish.hashtags?.trim()].filter(Boolean).join('\n\n');
