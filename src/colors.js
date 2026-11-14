export function normalizeColor(value) {
  let hex=String(value).trim().replace(/^#/,'').toLowerCase();
  if(!/^(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(hex))throw new Error('颜色需为 HEX，例如 #EDB75B 或 #EDB75B80');
  if(hex.length<6)hex=[...hex].map(c=>c+c).join('');
  if(hex.length===8&&hex.endsWith('ff'))hex=hex.slice(0,6);
  return '#'+hex;
}
export function rgba(hex) {
  hex=normalizeColor(hex).slice(1).padEnd(8,'f');
  return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16),a:parseInt(hex.slice(6,8),16)};
}
export function fromRgba({r,g,b,a=255}) {
  return normalizeColor('#'+[r,g,b,a].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join(''));
}
export function hsv(hex) {
  const rgb=rgba(hex),r=rgb.r/255,g=rgb.g/255,b=rgb.b/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  let h=0;if(delta){if(max===r)h=((g-b)/delta)%6;else if(max===g)h=(b-r)/delta+2;else h=(r-g)/delta+4;h=(h*60+360)%360;}
  return {h:Math.round(h),s:Math.round(max?delta/max*100:0),v:Math.round(max*100)};
}
export function fromHsv({h,s,v,a=255}) {
  const hue=((h%360)+360)%360/60,sat=s/100,value=v/100,c=value*sat,x=c*(1-Math.abs(hue%2-1)),m=value-c;
  const [r,g,b]=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x];
  return fromRgba({r:(r+m)*255,g:(g+m)*255,b:(b+m)*255,a});
}
export function parsePalette(text) {
  let colors;
  if(text.trimStart().startsWith('GIMP Palette')){
    colors=text.split(/\r?\n/).flatMap(line=>{
      const match=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)(?:\s|$)/);if(!match)return [];
      const [r,g,b]=match.slice(1).map(Number);if([r,g,b].some(v=>v>255))throw new Error('GPL 色板中的 RGB 超出范围');return [fromRgba({r,g,b})];
    });
  }else{const value=JSON.parse(text);colors=Array.isArray(value)?value:value.colors;}
  if(!Array.isArray(colors)||colors.length<1||colors.length>256)throw new Error('色板需包含 1–256 个颜色');
  return colors.map(normalizeColor);
}
export function extractPalette(pixels) {
  const counts=new Map();for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3])continue;const color=fromRgba({r:pixels[i],g:pixels[i+1],b:pixels[i+2],a:pixels[i+3]});counts.set(color,(counts.get(color)||0)+1);}
  return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,256).map(([color])=>color);
}
