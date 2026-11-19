import {colorValue} from './model.js';
import {modeOf} from './color-modes.js';
import {DEFAULT_TOLERANCE} from './color-replace.js';

// 色板选项用颜色本身做底色，文字按亮度取黑或白，便于在下拉列表中直接辨认。
const optionStyle = color => {
  const value = colorValue(color), luma = (value >>> 24) * .299 + ((value >>> 16) & 255) * .587 + ((value >>> 8) & 255) * .114;
  return `background:${color};color:${(value & 255) < 128 || luma > 140 ? '#000' : '#fff'}`;
};

export async function replacementColorDialog({doc, modal, from, to, fromIndex = 0, toIndex = 0, frame = 0, layer = 0, selection = null, preview = null, restore = null}) {
  const indexed = modeOf(doc) === 'indexed';
  const paletteOptions = (indexed?doc.palette.slice(0,65536):doc.palette).map((color, index) => `<option value="${index}" style="${optionStyle(color)}">${index}: ${color}${indexed && index === doc.transparentIndex ? '（透明索引）' : ''}</option>`).join('');
  const colorField = (name, label) => indexed
    ? `<label>${label}索引 <select name="${name}Index">${paletteOptions}</select></label>`
    : `<label>${label} <input name="${name}" type="color" required></label><label>${label}色板 <select name="${name}Palette"><option value="">手动颜色</option>${paletteOptions}</select></label>`;
  const html = '<div class="sheet-fields replace-color-fields">' + colorField('from', '原颜色') + colorField('to', '新颜色')
    + (indexed ? '' : `<label>容差 <input name="tolerance" type="number" min="0" max="255" value="${DEFAULT_TOLERANCE}" required></label>`)
    + '<label>范围 <select name="scope"><option value="cel">当前 cel</option><option value="layer">当前层全部帧</option><option value="sprite">整个精灵</option></select></label></div><p>'
    + (indexed ? '仅替换原索引对应的像素为目标索引，保留色板及重复颜色。' : '可手动输入颜色或从色板选择原颜色与新颜色；色板颜色保留透明度。容差 0 表示必须完全相等，255 命中任意颜色，按 RGBA 四通道最大差值判定。')
    + '画布实时预览替换结果，确定后才应用；仅影响选区内像素（如有选区）。可撤销。</p>';
  const validate = values => {
    if (indexed) {
      if ([values.fromIndex, values.toIndex].some(value => !/^\d+$/.test(value) || +value >= Math.min(65536,doc.palette.length))) throw new Error('替换颜色索引无效');
    } else if (!Number.isInteger(+values.tolerance) || +values.tolerance < 0 || +values.tolerance > 255) throw new Error('容差需在 0-255 之间');
  };
  const options = values => ({...(indexed ? {fromIndex: +values.fromIndex, toIndex: +values.toIndex} : {
    from: values.fromPalette === '' ? values.from : doc.palette[+values.fromPalette],
    to: values.toPalette === '' ? values.to : doc.palette[+values.toPalette],
    tolerance: +values.tolerance
  }), scope: values.scope, frame, layer, selection});
  const values = await modal('替换颜色', html, form => {
    const read = () => Object.fromEntries(['from', 'to', 'fromPalette', 'toPalette', 'fromIndex', 'toIndex', 'tolerance', 'scope'].filter(name => form.elements[name]).map(name => [name, form.elements[name].value]));
    const update = () => {
      const current = read();
      // 下拉框本身按当前选中色槽着色，作为选中后的颜色预览；RGBA 的颜色按钮已显示实际颜色。
      for (const name of ['from', 'to']) {
        const select = form.elements[name + (indexed ? 'Index' : 'Palette')], color = doc.palette[+select.value];
        select.style.cssText = select.value === '' || !color ? '' : optionStyle(color);
      }
      if (!preview) return;
      try { validate(current); } catch { restore(); return; }
      preview(options(current));
    };
    for (const [name, color, index] of [['from', from, fromIndex], ['to', to, toIndex]]) {
      if (indexed) form.elements[name + 'Index'].value = index;
      else {
        const input = form.elements[name], palette = form.elements[name + 'Palette'];
        input.value = color.slice(0, 7);
        const match = doc.palette.findIndex(entry => colorValue(entry) === colorValue(color));
        palette.value = match < 0 ? '' : String(match);
        palette.onchange = () => { if (palette.value !== '') input.value = doc.palette[+palette.value].slice(0, 7); };
        input.oninput = () => { palette.value = ''; };
      }
    }
    form.oninput = update;
    form.onchange = update;
    update();
  }, validate);
  restore?.();
  if (!values) return null;
  validate(values);
  return options(values);
}
