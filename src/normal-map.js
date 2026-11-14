export {defaultNormalMapOptions,generateNormalMap,NORMAL_MAP_LIMITS} from '../node_modules/@xprite/lighter/dist/index.js';

import {createNormalMapGenerator} from '../node_modules/@xprite/lighter/dist/index.js';
export function generateNormalMapWithEstimate(image,settings={}){
 const generator=createNormalMapGenerator(image),result=generator.generate(settings);
 return{...result,estimatedAngle:settings.paintedLightAngle===undefined?generator.suggestPaintedLightAngle():null};
}
