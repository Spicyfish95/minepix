import {generateNormalMapWithEstimate} from './normal-map.js';

self.onmessage=({data:{image,settings}})=>{
 try{self.postMessage({status:'processing'});const result=generateNormalMapWithEstimate(image,settings);self.postMessage({result},[result.data.buffer]);}
 catch(error){self.postMessage({error:error.message});}
};
