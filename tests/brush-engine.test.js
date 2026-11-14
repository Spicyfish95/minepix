import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyInk,brushFootprint,stampBrush,rasterShape,appendPixelPerfect,paintFill} from '../src/brush-engine.js';
import {createDocument,colorValue} from '../src/model.js';
test('ink modes blend, replace, lock alpha and erase predictably',()=>{
  const red=colorValue('#ff0000'),halfBlue=colorValue('#0000ff80');
  assert.equal(applyInk(red,halfBlue),0x7f0080ff);
  assert.equal(applyInk(red,halfBlue,'copy'),halfBlue);
  assert.equal(applyInk(0,halfBlue,'lock-alpha'),0);
  assert.equal(applyInk(0xff000080,colorValue('#0000ff'),'lock-alpha'),0x0000ff80);
  assert.equal(applyInk(red,0,'erase',.5)&255,128);
  assert.equal(applyInk(red,0,'erase',1),0);
  assert.equal(applyInk(red,0,'over'),red);
});
test('simple ink paints opaque pixels, composites alpha and erases with a transparent color',()=>{
  const dest=colorValue('#0000ff'),opaque=colorValue('#ff0000');
  assert.equal(applyInk(dest,opaque,'simple'),opaque);
  assert.equal(applyInk(dest,colorValue('#ff000080'),'simple'),applyInk(dest,colorValue('#ff000080'),'over'));
  assert.equal(applyInk(dest,0x00000000,'simple'),0);
  assert.equal(applyInk(0x0000ff80,0x00000000,'simple')&255,0);
  assert.notEqual(applyInk(dest,0x00000000,'over'),0);
});
test('copy ink replaces RGBA at full source alpha regardless of stroke opacity',()=>{
  const dest=colorValue('#0000ff'),source=colorValue('#ff0000');
  assert.equal(applyInk(dest,source,'copy',.2),source);
  assert.equal(applyInk(dest,colorValue('#00ff0080'),'copy',.5),colorValue('#00ff0080'));
});
test('lock alpha replaces RGB while keeping the destination alpha',()=>{
  const source=colorValue('#ff0000ff');
  const result=applyInk(colorValue('#0000ff80'),source,'lock-alpha');
  assert.equal(result>>>24,255);assert.equal((result>>>16)&255,0);assert.equal((result>>>8)&255,0);assert.equal(result&255,128);
  assert.equal(applyInk(0x0000ff00,source,'lock-alpha'),0x0000ff00);
});
test('round and angled line brush footprints differ from square stamps',()=>{
  assert.equal(brushFootprint({size:5}).length,25);
  const circle=brushFootprint({size:5,shape:'circle'});assert(circle.length<25);assert(!circle.some(p=>p.x===-2&&p.y===-2));
  assert(brushFootprint({size:5,shape:'line',angle:90}).every(p=>p.x===0));
});
test('stroke opacity is applied once per pixel even when stamps overlap',()=>{
  const doc=createDocument(5,5),p=doc.frames[0].cels[0],base=[...p],settings={size:3,ink:'over',opacity:.5,base,touched:new Set()};
  stampBrush(doc,p,2,2,colorValue('#ff0000'),settings);stampBrush(doc,p,2,2,colorValue('#ff0000'),settings);
  assert.equal(p[12]&255,128);assert.equal(settings.touched.size,9);
  stampBrush(doc,p,0,0,colorValue('#ff0000'),{...settings,size:1},{x:1,y:1,w:2,h:2});assert.equal(p[0],0);
});
test('custom brushes keep their colors and transparent holes when scaled',()=>{
  const pattern={w:2,h:2,data:[0xff0000ff,0,0,0x0000ff80]},points=brushFootprint({shape:'pattern',size:4,pattern});
  assert.equal(points.length,8);assert.equal(points.filter(p=>p.color===0xff0000ff).length,4);
  const d=createDocument(6,6);stampBrush(d,d.frames[0].cels[0],2,2,0,{size:2,shape:'pattern',pattern,ink:'copy',opacity:1});assert.equal(d.frames[0].cels[0][2*6+2],0xff0000ff);assert.equal(d.frames[0].cels[0][3*6+3],0x0000ff80);
});
test('downscaled pattern brushes sample visible content instead of a transparent corner',()=>{
  const pattern={w:5,h:5,data:Array(25).fill(0)};pattern.data[12]=0xff0000ff;
  assert.deepEqual(brushFootprint({shape:'pattern',size:1,pattern}),[{x:0,y:0,color:0xff0000ff}]);
  const ring={w:5,h:5,data:Array(25).fill(0)};for(const i of [2,6,7,8,10,14,16,17,18,22])ring.data[i]=0x0000ffff;
  assert.equal(brushFootprint({shape:'pattern',size:1,pattern:ring}).length,1);
});
test('brush mode recolors the pattern with the foreground color while preserving shape and alpha',()=>{
  const pattern={w:2,h:2,data:[0xff0000ff,0,0,0x0000ff80]},doc=createDocument(4,4);
  stampBrush(doc,doc.frames[0].cels[0],1,1,0x00ff00ff,{shape:'pattern',size:2,pattern,patternMode:'brush',ink:'over',opacity:1});
  assert.equal(doc.frames[0].cels[0][5],0x00ff00ff);
  assert.equal(doc.frames[0].cels[0][10],0x00ff0080);
});
test('pattern alignment anchors on the copied source or on the stamp position',()=>{
  const pattern={w:2,h:2,data:[0xff0000ff,0x00ff00ff,0x0000ffff,0xffffff80]},dest=colorValue('#00ff00');
  const paint=(mode,anchor,x,y)=>{const doc=createDocument(4,4);stampBrush(doc,doc.frames[0].cels[0],x,y,dest,{size:2,shape:'pattern',pattern,patternMode:mode,patternAnchor:anchor,ink:'over',opacity:1});return [...doc.frames[0].cels[0]];};
  const destination=paint('destination',{x:2,y:2},2,2);
  assert.equal(destination[2*4+2],0xff0000ff);
  const source=paint('source',{x:0,y:0},3,3);
  assert.equal(source[3*4+3],0xffffff80);
});
test('pixel perfect removes the redundant corner from a one-pixel staircase',()=>{
  const points=[];for(const p of [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:2,y:2}])appendPixelPerfect(points,p);
  assert.deepEqual(points,[{x:0,y:0},{x:1,y:1},{x:2,y:2}]);
});
test('filled shapes include their interior, and alpha fill uses the original region',()=>{
  const rect=[],ellipse=[];rasterShape('rect',{x:0,y:0},{x:4,y:4},true,(x,y)=>rect.push([x,y]));rasterShape('ellipse',{x:0,y:0},{x:4,y:4},true,(x,y)=>ellipse.push([x,y]));
  assert.equal(rect.length,25);assert(ellipse.some(([x,y])=>x===2&&y===2));assert(!ellipse.some(([x,y])=>x===0&&y===0));
  const d=createDocument(3,1),p=d.frames[0].cels[0];p.fill(0xff000080);paintFill(d,p,0,0,0xff000080,{ink:'over',opacity:1});assert(p.every(c=>(c&255)===192));
});

test('line brush angles cover a full turn and preserve perpendicular footprints',()=>{
 const footprint=angle=>brushFootprint({size:7,shape:'line',angle}).map(({x,y})=>`${x},${y}`).sort();
 assert.deepEqual(footprint(360),footprint(0));
 assert.deepEqual(footprint(270),footprint(90));
 assert.notDeepEqual(footprint(270),footprint(0));
 assert(brushFootprint({size:7,shape:'line',angle:270}).every(point=>point.x===0));
 assert.equal(brushFootprint({size:1,shape:'line',angle:360}).length,1);
});
