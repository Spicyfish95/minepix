import {uiGet,uiAll,uiQuery} from './ui-surfaces.js';
// One 24 px grid, 1.7 px strokes, and currentColor across the whole interface.
export const ICONS = {
 "brush-square":"<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" fill=\"currentColor\" stroke=\"none\"/>",
 "brush-circle":"<circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"currentColor\" stroke=\"none\"/>",
 "brush-line":"<path d=\"M4 12h16\" stroke-width=\"3\"/>",
 "brush-pattern":"<path d=\"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z\" fill=\"currentColor\" stroke=\"none\"/>",
 "brush-presets":"<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"M7 7h4v4H7z\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"16\" cy=\"9\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"m7 17 4-3M15 15h3v3h-3z\"/>",
 "ink":"<path d=\"M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z\"/><path d=\"M12 8v12a5 5 0 0 0 5-5c0-2-3-5-5-7Z\" fill=\"currentColor\" stroke=\"none\"/>",
 "stabilizer":"<path d=\"M3 7c2-6 4 6 6 0s4 6 6 0h6M3 17h18\"/><circle cx=\"7\" cy=\"17\" r=\"2\" fill=\"var(--surface)\"/><circle cx=\"17\" cy=\"17\" r=\"2\" fill=\"var(--surface)\"/>",
 "pixel-perfect":"<path d=\"M3 19h5v-5h5V9h5V4h3\" stroke-width=\"2\"/><path d=\"M3 14h5v5H3zM8 9h5v5H8zM13 4h5v5h-5z\" fill=\"currentColor\" stroke=\"none\"/>",
 "shape-filled":"<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" fill=\"currentColor\" stroke=\"none\"/>",
 "text-align-left":"<path d=\"M4 4v16M7 5h13M7 10h8M7 15h13M7 20h8\"/>",
 "text-align-center":"<path d=\"M3 5h18M7 10h10M3 15h18M7 20h10\"/>",
 "text-align-right":"<path d=\"M20 4v16M4 5h13M9 10h8M4 15h13M9 20h8\"/>",
 "text-paint":"<path d=\"m5 16 5-12h4l5 12M8 11h8M3 21h18\"/><path d=\"M5 18h14v3H5Z\" fill=\"currentColor\" stroke=\"none\"/>",
 "tiled-mode":"<path d=\"M2 2h8v8H2zM14 2h8v8h-8zM2 14h8v8H2zM14 14h8v8h-8z\"/><path d=\"M5 5h2v2H5zM17 5h2v2h-2zM5 17h2v2H5zM17 17h2v2h-2z\" fill=\"currentColor\" stroke=\"none\"/>",
 "pattern-align":"<path d=\"M12 2v20M2 12h20M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" fill=\"var(--surface)\"/>",

 slice:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke-dasharray="2 2"/>',
  gradient:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M11 3v18M15 3v18M19 3v18"/><path d="M3 3h8v18H3Z" fill="currentColor" opacity=".35"/>',
  'color-rgb':'<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>',
  'color-hsv':'<circle cx="12" cy="12" r="9"/><path d="m12 4 7 12H5L12 4Z"/>',
  repeat:'<path d="M3 8h16l-4-4M21 16H5l4 4M19 8l-4 4M5 16l4-4"/>',
  once:'<path d="m3 5 10 7-10 7V5Z"/><path d="M19 4v16"/>',
  tag:'<path d="M3 3h9l9 9-9 9-9-9V3Z"/><circle cx="8" cy="8" r="1.5"/>',
  detach:'<path d="M13 3h8v8M21 3 10 14M10 3H3v18h18v-7"/>',
  link:'<path d="m10 14 4-4M9 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m0 8a4 4 0 0 0 5 0l5-5a4 4 0 0 0-5-5l-2 2"/>',
  unlink:'<path d="m3 3 18 18M8 9l-5 4a4 4 0 0 0 5 6l3-3M13 8l3-3a4 4 0 0 1 5 6l-3 3M3 8H1M8 3V1M21 16h2M16 21v2"/>',
  folder:'<path d="M3 7V4h6l3 3h9v13H3V7Z"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  alpha:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 9h9M3 15h9M7 3v18"/><path d="M12 3h9v18h-9Z" fill="currentColor" opacity=".4"/>',
  curve:'<path d="M3 18C5 3 19 3 21 18"/><rect x="1" y="16" width="4" height="4"/><rect x="19" y="16" width="4" height="4"/>',
  polygon:'<path d="m5 4 14 2 3 11-11 5-9-9 3-9Z"/><path d="M5 4h.01M19 6h.01M11 22h.01" stroke-width="3"/>',
  contour:'<path d="M6 5c3-4 7 1 10-1s8 5 4 9-2 8-7 8-10-3-10-7 5-4 3-9Z"/>',

  swap:'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
  invert:'<rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="3 2"/><path d="M4 4h8v16H4Z" fill="currentColor" opacity=".35" stroke="none"/>',
  reselect:'<rect x="7" y="5" width="13" height="14" rx="1" stroke-dasharray="3 2"/><path d="M2 12h10"/><path d="m8 9 4 3-4 3"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><rect x="7" y="3" width="3" height="6" rx="1"/><rect x="14" y="9" width="3" height="6" rx="1"/><rect x="8" y="15" width="3" height="6" rx="1"/>',

  merge:'<path d="M6 3v5c0 3 6 3 6 6v7M18 3v5c0 3-6 3-6 6M8 17l4 4 4-4"/>',
  canvas:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M8 8h8v8H8zM3 8h2M3 16h2M19 8h2M19 16h2"/>',
  crop:'<path d="M7 2v15h15M2 7h15v15"/>',

  pencil:'<path d="m4 16 12-12 4 4L8 20H4v-4Z"/><path d="m13 7 4 4M4 16l4 4"/>',
  eraser:'<path d="m4 13 9-9a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3l-9 9H8l-4-4a2 2 0 0 1 0-3Z"/><path d="m9 8 7 7M11 20h10"/>',
  blur:'<path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 16c0 2 1.5 4 4 4" opacity=".65"/>',
  text:'<path d="M4 5V3h16v2M12 3v18M8 21h8"/>',
  fill:'<path d="m4 10 8-7 8 9-8 7-8-9Z"/><path d="M5 11h14M11 3V1M21 16c-3 4-3 6-1 6s3-2 1-6Z"/>',
  eyedropper:'<path d="m4 16 11-11 4 4L8 20H4v-4ZM13 3l8 8M16 2l6 6M4 16l4 4"/>',
  line:'<path d="M5 19 19 5"/><rect x="3" y="17" width="4" height="4" rx=".5"/><rect x="17" y="3" width="4" height="4" rx=".5"/>',
  rect:'<rect x="4" y="5" width="16" height="14" rx="1"/>',
  ellipse:'<ellipse cx="12" cy="12" rx="8" ry="7"/>',
  select:'<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/>',
  'select-rect':'<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><rect x="4" y="4" width="4" height="4"/>',
  'select-ellipse':'<ellipse cx="12" cy="12" rx="8" ry="7" stroke-dasharray="3 3"/>',
  'select-lasso':'<path d="M18 7a8 7 0 1 0-9 13c3 1 7-1 8-4" stroke-dasharray="3 2"/><path d="M9 16c-2 2-3 4-2 6"/>',
  'select-polygon':'<path d="m5 8 7-4 7 5-3 9-9-1Z" stroke-dasharray="3 2"/><circle cx="5" cy="8" r="1.4"/><circle cx="12" cy="4" r="1.4"/><circle cx="19" cy="9" r="1.4"/>',
  'select-wand':'<path d="m4 20 8-8"/><path d="M15 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/><path d="M20 13l.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7.7-1.4Z"/>',
  'select-grid':'<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/><path d="M12 4v16M4 12h16" stroke-dasharray="2 2"/>',
  move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  hand:'<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2 6-6 6h-1c-2 0-4-1-5-3l-4-5a1.5 1.5 0 0 1 2-2l2 2Z"/>',
  zoom:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M8 10.5h5M10.5 8v5"/>',
  'zoom-in':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M8 10.5h5M10.5 8v5"/>',
  'zoom-out':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M8 10.5h5"/>',
  new:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z"/><path d="M14 3v5h5M9 14h6M12 11v6"/>',
  open:'<path d="M3 8V5a1 1 0 0 1 1-1h5l2 3h8a1 1 0 0 1 1 1v2M3 10h18l-3 10H5L3 10Z"/>',
  save:'<path d="M4 3h13l4 4v14H3V4a1 1 0 0 1 1-1Z"/><path d="M7 3v6h10V3M7 21v-8h10v8M14 5v2"/>',
  export:'<path d="M12 15V3m-4 4 4-4 4 4M5 12H3v9h18v-9h-2"/>',
  undo:'<path d="m8 5-5 5 5 5M3 10h11a6 6 0 0 1 0 12"/>',
  redo:'<path d="m16 5 5 5-5 5M21 10H10a6 6 0 0 0 0 12"/>',
  fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 5V3H3v13h2"/>',
  cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  paste:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H5v16h14V5h-3M8 12h8M8 16h6"/>',
  'flip-x':'<path d="M12 3v18" stroke-dasharray="2 3"/><path d="m3 17 5-10v10H3Zm18 0L16 7v10h5Z"/>',
  'flip-y':'<path d="M3 12h18" stroke-dasharray="2 3"/><path d="m7 3 10 5H7V3Zm0 18 10-5H7v5Z"/>',
  clear:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  deselect:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8l8 8M16 8l-8 8"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':'<path d="M3 3 21 21M10 5c6-1 12 7 12 7a23 23 0 0 1-4 4M6 6a24 24 0 0 0-4 6s4 7 10 7c2 0 3-.3 4-1M10 10a3 3 0 0 0 4 4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0M12 14v3"/>',
  'layer-up':'<path d="M12 20V4m-5 5 5-5 5 5"/>',
  'layer-down':'<path d="M12 4v16m-5-5 5 5 5-5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8l10-5ZM3 13l9 5 9-5M3 18l9 5 9-5"/>',
  previous:'<path d="M5 5v14M19 5l-10 7 10 7V5Z"/>',
  next:'<path d="M19 5v14M5 5l10 7-10 7V5Z"/>',
  'play-reverse':'<path d="m17 4-14 8 14 8V4Z"/>',
  play:'<path d="m7 4 14 8-14 8V4Z"/>',
  pause:'<path d="M7 4h3v16H7V4ZM15 4h3v16h-3V4Z"/>',
  frame:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  'frame-add':'<rect x="3" y="4" width="14" height="16" rx="2"/><path d="M7 4v16M3 9h4M3 15h4M14 12h8M18 8v8"/>',
  'frame-copy':'<rect x="3" y="3" width="12" height="14" rx="1"/><rect x="9" y="9" width="12" height="12" rx="1"/><path d="M13 9v12M9 13h4M9 17h4"/>',
  'frame-delete':'<rect x="3" y="4" width="14" height="16" rx="2"/><path d="M7 4v16M3 9h4M3 15h4M14 9l7 7M21 9l-7 7"/>',
  'frame-shift-left':'<rect x="13" y="5" width="8" height="14" rx="1"/><path d="M3 12h10M7 8l-4 4 4 4"/>',
  'frame-shift-right':'<rect x="3" y="5" width="8" height="14" rx="1"/><path d="M11 12h10M17 8l4 4-4 4"/>',
  'frames-reverse':'<rect x="3" y="9" width="5" height="6"/><rect x="10" y="9" width="4" height="6"/><rect x="16" y="9" width="5" height="6"/><path d="M3 5h18l-3-3M21 19H3l3 3"/>',
  'cel-properties':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 16h10M10 5v6M14 13v6"/>',
  'cel-clear':'<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2"/><path d="m7 13 6-6 4 4-6 6H9l-2-2v-2ZM11 17h7M10 10l4 4"/>',
  'cel-link':'<rect x="2" y="4" width="7" height="7" rx="1"/><rect x="15" y="13" width="7" height="7" rx="1"/><path d="m8 15 3-3a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4-4ZM9 15l6-6"/>',
  'cel-unlink':'<rect x="2" y="4" width="7" height="7" rx="1"/><rect x="15" y="13" width="7" height="7" rx="1"/><path d="m7 17 3-3m4-4 3-3M9 11l4 4M12 4l1-2M20 11l2-1"/>',
  fps:'<circle cx="12" cy="12" r="9"/><path d="M12 3v3M3 12h3M18 12h3M12 12l5-5M7 18h10"/><circle cx="12" cy="12" r="1"/>',
  'tag-add':'<path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="7" cy="8" r="1"/><path d="M12 12h6M15 9v6"/>',
  'tag-edit':'<path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="7" cy="8" r="1"/><path d="m10 15 5-5 2 2-5 5h-2v-2Z"/>',
  'tag-delete':'<path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="7" cy="8" r="1"/><path d="m11 11 6 6m0-6-6 6"/>',
  'insert-after':'<rect x="3" y="5" width="9" height="14" rx="1"/><path d="M19 3v18M15 12h8M19 8v8"/>',
  'insert-before':'<rect x="12" y="5" width="9" height="14" rx="1"/><path d="M5 3v18M1 12h8M5 8v8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  'tab-close':'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  'plus-small':'<path d="M12 7v10M7 12h10"/>',
  'collapse-up':'<path d="m6 14 6-6 6 6"/>',
  'collapse-down':'<path d="m6 10 6 6 6-6"/>',
  'window-minimize':'<path d="M6 12h12"/>',
  'window-maximize':'<rect x="6.5" y="6.5" width="11" height="11" rx="1"/>',
  'window-restore':'<rect x="8" y="6" width="10" height="11" rx="1"/><path d="M6 9v9h9"/>',
  'window-close':'<path d="m7 7 10 10M17 7 7 17"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-2 1-2h3a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7 10h.01M10 6.5h.01M15 7h.01M18 10h.01" stroke-width="3"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  'pixel-grid':'<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/>',
  'grid-guide':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9.5h18M3 15h18M9.5 3v18M15 3v18" stroke-dasharray="2.5 2.5"/>',
  'axis-horizontal':'<path d="M3 12h18M12 3v18"/><path d="m7 8-4 4 4 4M17 8l4 4-4 4"/>',
  'clear-all':'<rect x="6" y="6" width="15" height="15" rx="2"/><path d="M17 3H3v14M10 10l7 7M17 10l-7 7"/>',
  'axis-reset':'<path d="M4 7V3m0 4h4M4.5 7a8 8 0 1 1-1 8"/><path d="M12 7v5l3 2"/>',
  tileset:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><rect x="3" y="3" width="6" height="6" fill="currentColor" opacity=".5" stroke="none"/><rect x="15" y="15" width="6" height="6" fill="currentColor" opacity=".5" stroke="none"/>',
  terrain:'<path d="M3 20h18"/><path d="m4 20 5-9 4 5 3-4 4 8"/><path d="M14 4h6v6"/>',
  onion:'<path d="M12 3c0 5-8 5-8 11a8 8 0 0 0 16 0c0-6-8-6-8-11Z"/><path d="M12 7c0 5-4 5-4 9a4 4 0 0 0 8 0c0-4-4-4-4-9ZM10 3h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon:'<path d="M20 14a8 8 0 0 1-10-10A9 9 0 1 0 20 14Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  chevron:'<path d="m8 10 4 4 4-4"/>'
};

export const ACTION_ICONS = {input:'settings',keymap:'settings',slices:'select',
  'cel-properties':'cel-properties','link-cels':'cel-link','unlink-cels':'cel-unlink','pen-settings':'pencil','reference-import':'image','reference-settings':'move','toggle-reference':'image','toggle-background':'canvas','group-layer':'folder','ungroup-layer':'layers','layer-parent':'folder','recent-files':'clock','rename-layer':'pencil',
  'copy-cels':'copy','cut-cels':'cut','paste-cels':'paste','clear-cels':'clear','move-cels':'move','transform-cels':'canvas','flip-cels-x':'flip-x','flip-cels-y':'flip-y','deselect-cels':'deselect',
  'onion-settings':'onion','slice-properties':'slice','delete-active-slice':'clear','clear-slices':'clear-all',
  'frame-fps':'fps','frame-left':'frame-shift-left','frame-right':'frame-shift-right','reverse-frames':'frames-reverse','add-tag':'tag-add','edit-tag':'tag-edit','delete-tag':'tag-delete',
  'invert-selection':'invert','reselect':'reselect','select-content':'select','transform-selection':'move',
  'capture-brush':'select','brush-presets':'settings','replace-color':'swap','tileset-toggle':'tileset','sprite-size':'canvas','grid-settings':'grid','palette-editor':'settings','import-palette':'open','export-palette':'save','extract-palette':'eyedropper','merge-down':'merge','merge-visible':'layers','canvas-size':'canvas','crop-selection':'crop','trim-canvas':'crop',new:'new',open:'open',save:'save',export:'export',undo:'undo',redo:'redo',fit:'fit',
  copy:'copy',paste:'paste','flip-x':'flip-x','flip-y':'flip-y',clear:'clear',deselect:'deselect',
  'zoom-in':'zoom-in','zoom-out':'zoom-out','add-layer':'plus','layer-up':'layer-up','layer-down':'layer-down',
  'duplicate-layer':'copy','delete-layer':'clear',previous:'previous',next:'next',play:'play',
  'add-frame':'frame-add','duplicate-frame':'frame-copy','delete-frame':'frame-delete',shortcuts:'keyboard',
  'save-palette':'copy','delete-palette':'clear','remap-indices':'repeat','save-pattern-brush':'save','delete-pattern-brush':'clear'
};

export function iconMarkup(name){
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${name}">${ICONS[name]}</svg>`;
}

export function setButtonIcon(button,name,label=''){
  if(button.closest('[popover]')){
    const text=label||button.getAttribute('aria-label')||button.title||button.textContent.trim();
    button.classList.remove('visual-button','icon-button');button.textContent=text;return;
  }
  button.innerHTML=iconMarkup(name);
  if(button.classList.contains('visual-button')){if(label){button.title=label;button.setAttribute('aria-label',label);}return;}
  if(label){const text=document.createElement('span');text.textContent=label;button.append(text);}
}

export function decorateInterface(){
  uiAll('[data-action]').forEach(button=>{
    const action=button.dataset.action;
    const label=button.textContent.trim().replace(/^[＋↶↷↑↓−]+\s*/,'').replace(/\s*↗$/,'');
    const iconOnly=['previous','next','zoom-in','zoom-out','add-layer','layer-up','layer-down','rename-layer','duplicate-layer','delete-layer','palette-editor'].includes(action)&&!button.closest('.context-popover');
    const key=button.querySelector('kbd')?.textContent;
    setButtonIcon(button,ACTION_ICONS[action],iconOnly?'':(label.replace(/Ctrl S$/,'').trim()||button.title));
    if(key){const kbd=document.createElement('kbd');kbd.textContent=key;button.append(kbd);}
    if(iconOnly){button.classList.add('icon-button');button.setAttribute('aria-label',button.title||action);}
  });
  uiAll('.document-tab>button:last-child').forEach(button=>{button.title='关闭文档';button.setAttribute('aria-label','关闭文档');setButtonIcon(button,'tab-close');});
  const plus=uiGet('document-menu-trigger');if(plus){plus.title='新建或打开文档';plus.setAttribute('aria-label','新建或打开文档');plus.classList.add('icon-button');setButtonIcon(plus,'plus-small');}
  uiAll('[data-heading-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',iconMarkup(el.dataset.headingIcon)));
  const close=uiQuery('[aria-label="关闭"]');setButtonIcon(close,'close');
  uiAll('.modal-actions button').forEach(button=>button.insertAdjacentHTML('afterbegin',iconMarkup(button.value==='ok'?'check':'close')));
  setButtonIcon(uiGet('add-color'),'plus','添加到色板');
}
