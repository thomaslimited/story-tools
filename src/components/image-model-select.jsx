import { IMAGE_MODELS, formatUsd, imageCostPerAttempt } from '../lib/cost-estimate.js';

/** Image model dropdown showing the estimated price per image, plus the cost for `frames` images when given. */
export default function ImageModelSelect({ value, onChange, frames = 0, disabled = false, stacked = false }) {
  // Keep a model set outside the catalog selectable instead of silently switching it.
  const options =
    !value || IMAGE_MODELS.some((m) => m.id === value)
      ? IMAGE_MODELS
      : [...IMAGE_MODELS, { id: value, label: value, price: imageCostPerAttempt(value), note: 'model đang cấu hình' }];

  return (
    <span className={stacked ? 'stack tight' : 'row wrap'}>
      <label className={stacked ? '' : 'inline'}>
        Model ảnh
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={stacked ? { width: '100%' } : undefined}>
          {options.map((m) => (
            <option key={m.id} value={m.id}>{`${m.label} – ~$${m.price.toFixed(3)}/ảnh (${m.note})`}</option>
          ))}
        </select>
      </label>
      {frames > 0 && (
        <span className="muted small">
          ≈ {formatUsd(frames * imageCostPerAttempt(value))} cho {frames} khung (mỗi khung vẽ 1 lần, chưa tính vẽ lại)
        </span>
      )}
    </span>
  );
}
