import {initSync} from '../node_modules/@xprite/pixelate/wasm/pixelfixer_detect.js';
import {preloadWasm} from '../node_modules/@xprite/pixelate/dist/index.js';
import {repairPixels} from './pixel-repair.js';

self.onmessage=async({data:{image,settings,wasm}})=>{
 try{
  initSync({module:wasm});await preloadWasm();
  self.postMessage({status:'processing'});
  const result=repairPixels(image,settings);
  self.postMessage({result},[result.data.buffer]);
 }catch(error){self.postMessage({error:error.message});}
};
