import {playbackSequence} from '../playback.js';
const frameName=index=>'frame-'+String(index).padStart(4,'0');
export function engineAnimations(metadata){
 const groups=[{name:'all',from:0,to:metadata.frames.length-1,direction:'forward'},...(metadata.tags||[])],used=new Set();
 return groups.map(group=>{const base=group.name||'animation';let name=base,suffix=2;while(used.has(name))name=base+'-'+suffix++;used.add(name);const indices=playbackSequence(Array.from({length:group.to-group.from+1},(_,i)=>group.from+i),group.direction);return{name,indices};});
}
export function phaserAtlas(metadata){return{frames:Object.fromEntries(metadata.frames.map((frame,i)=>[frameName(i),{frame:{...frame.frame},rotated:false,trimmed:!!frame.trimmed,spriteSourceSize:frame.spriteSourceSize||{x:0,y:0,w:frame.frame.w,h:frame.frame.h},sourceSize:frame.sourceSize||{w:frame.frame.w,h:frame.frame.h},duration:frame.duration}])),meta:{app:'pixel-studio',version:'1',image:metadata.image,format:'RGBA8888',size:{...metadata.size},scale:'1',frameTags:metadata.tags||[],pixelStudio:metadata}};}
export function phaserAnimations(metadata,textureKey){return{anims:engineAnimations(metadata).map(group=>{const base=Math.min(...group.indices.map(i=>metadata.frames[i].duration));return{key:group.name,frameRate:1000/base,repeat:-1,frames:group.indices.map(i=>({key:textureKey,frame:frameName(i),duration:metadata.frames[i].duration-base}))};}),globalTimeScale:1};}
export function godotSpriteFrames(metadata){
 const quote=value=>JSON.stringify(value),lines=[`[gd_resource type="SpriteFrames" load_steps=${metadata.frames.length+2} format=3]`,'',`[ext_resource type="Texture2D" path=${quote('./'+metadata.image)} id="1"]`];
 metadata.frames.forEach((frame,i)=>{const r=frame.frame,s=frame.spriteSourceSize||{x:0,y:0,w:r.w,h:r.h},size=frame.sourceSize||{w:r.w,h:r.h};lines.push('',`[sub_resource type="AtlasTexture" id="Atlas_${i}"]`,'atlas = ExtResource("1")',`region = Rect2(${r.x}, ${r.y}, ${r.w}, ${r.h})`,`margin = Rect2(${s.x}, ${s.y}, ${size.w-r.w}, ${size.h-r.h})`,'filter_clip = true');});
 lines.push('','[resource]','animations = [');engineAnimations(metadata).forEach((group,index,groups)=>{lines.push('{',`"frames": [${group.indices.map(i=>`{"duration": ${metadata.frames[i].duration/100}, "texture": SubResource("Atlas_${i}")}`).join(', ')}],`,'"loop": true,',`"name": &${quote(group.name)},`,'"speed": 10.0','}'+(index<groups.length-1?',':''));});lines.push(']','');return lines.join('\n');
}
export function engineFiles(metadata,base,format){
 if(!['native','phaser','godot'].includes(format))throw new Error('未知引擎格式预设');
 if(format==='native')return{[base+'.json']:JSON.stringify(metadata,null,2)};
 const source={[base+'.pixpix.json']:JSON.stringify(metadata,null,2)};
 return format==='phaser'?{...source,[base+'.json']:JSON.stringify(phaserAtlas(metadata),null,2),[base+'.animations.json']:JSON.stringify(phaserAnimations(metadata,base),null,2)}:{...source,[base+'.tres']:godotSpriteFrames(metadata)};
}
