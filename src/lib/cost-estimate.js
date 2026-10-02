// Image model catalog with a rough per-attempt cost in USD (1K output + typical reference-image input),
// from Google's published prices. Drives the model dropdowns and story cost estimates.
export const IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image', price: 0.035, note: 'rẻ nhất, chất lượng thấp hơn' },
  { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', price: 0.07, note: 'cân bằng' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', price: 0.146, note: 'đẹp nhất, đắt nhất' },
];

// Fallback for model ids outside the catalog (e.g. preview versions typed in via .env).
const PRICE_PATTERNS = [
  [/lite/i, 0.035],
  [/pro/i, 0.146],
  [/2\.5-flash-image/i, 0.041],
];

export function imageCostPerAttempt(model = '') {
  const known = IMAGE_MODELS.find((m) => m.id === model);
  if (known) return known.price;
  const hit = PRICE_PATTERNS.find(([re]) => re.test(model));
  return hit ? hit[1] : 0.07;
}

export const formatUsd = (value) => `$${value.toFixed(2)}`;
