// Canvas pixel storage plus retained encoded data; DOM-visible canvases may outlive
// an evicted entry, but the cache must not keep closed documents alive indefinitely.
export class ReferenceCanvasCache extends Map{
 constructor(budget=64*1024*1024){super();this.budget=budget;}
 get memoryBytes(){let bytes=0;for(const {canvas,data}of this.values())bytes+=canvas.width*canvas.height*4+(data?.length||0)*2;return bytes;}
 get(key){const value=super.get(key);if(value){super.delete(key);super.set(key,value);}return value;}
 set(key,value){super.delete(key);super.set(key,value);while(this.memoryBytes>this.budget&&this.size)super.delete(this.keys().next().value);return this;}
 retain(keys){for(const key of this.keys())if(!keys.has(key))super.delete(key);}
}
