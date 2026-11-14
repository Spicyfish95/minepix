export const PROJECT_VERSION=2;
export const SUPPORTED_FEATURES=new Set(['cel-properties','slice-keyframes','slices','layer-blending','layer-groups','layer-types','linked-cels','color-modes','reference-board','tileset']);
export function normalizeProject(input){
  if(!input||input.format!=='pixel-studio')throw new Error('不是 MinePix 项目');
  if(input.version!==PROJECT_VERSION)throw new Error(`不支持项目版本 ${input.version}，请使用匹配版本的应用`);
  const project={
    ...input,
    requiredFeatures:(input.requiredFeatures??[]),
    layers:Array.isArray(input.layers)?input.layers.map(layer=>layer&&typeof layer==='object'?{...layer}:layer):input.layers,
    frames:Array.isArray(input.frames)?input.frames.map(frame=>frame&&typeof frame==='object'?{...frame,cels:Array.isArray(frame.cels)?frame.cels.map(cel=>Array.isArray(cel)?cel.slice():cel):frame.cels}:frame):input.frames
  };
  const required=project.requiredFeatures;
  if(!Array.isArray(required)||required.some(feature=>!SUPPORTED_FEATURES.has(feature)))throw new Error('项目包含当前版本不支持的必需功能');
  return{...project,version:PROJECT_VERSION,requiredFeatures:[...required]};
}
