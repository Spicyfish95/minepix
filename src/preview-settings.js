// 地形预览画布的格子数：内部设置项，默认 10 × 10 格，与项目画布尺寸解耦。
export const PREVIEW_SETTINGS_KEY = 'pixpix-terrain-preview-v1';
export const DEFAULT_PREVIEW_SIZE = {cols: 10, rows: 10};
export const PREVIEW_MIN = 1, PREVIEW_MAX = 64;

export function validatePreviewSize(value) {
  const size = {cols: Math.round(+value?.cols), rows: Math.round(+value?.rows)};
  if (!Number.isFinite(size.cols) || !Number.isFinite(size.rows)) throw new Error('地形预览格子数必须是数字');
  if (size.cols < PREVIEW_MIN || size.cols > PREVIEW_MAX || size.rows < PREVIEW_MIN || size.rows > PREVIEW_MAX) throw new Error(`地形预览格子数必须在 ${PREVIEW_MIN} 到 ${PREVIEW_MAX} 之间`);
  return size;
}

export function loadPreviewSize(storage) {
  try {
    const stored = JSON.parse(storage?.getItem(PREVIEW_SETTINGS_KEY) || 'null');
    return validatePreviewSize({...DEFAULT_PREVIEW_SIZE, ...stored});
  } catch {
    return {...DEFAULT_PREVIEW_SIZE};
  }
}

export function savePreviewSize(storage, size) {
  storage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(size));
}
