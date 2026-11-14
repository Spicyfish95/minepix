import {isTileset,atlasGrid,TERRAIN_MODES,terrainModeBits,NEIGHBOR_BITS,MAX_TERRAINS,DEFAULT_TERRAIN_COLORS,packTileset,terrainZones,zoneAt,derivePeeringBits,clearInactiveBits,migrateTiles} from './tilemap.js';
import {iconMarkup} from './icons.js';

// Godot 4 TileSet 编辑器式操作：图集区只保留「设置」与「自动标注」。
// 设置模式下鼠标移到图块上即出现九宫格：点中心设该图块地形，点四角/四边设期望地形，右键清除；
// 点图块的同时会选中它，TileData 检视器可继续改地形与各邻居位，Shift 单击加选后批量写入。
// 图块上的 8 个色块只用于核对 peering bits，不再可点击。
const BIT_SPOTS = [[.14, .14], [.5, .1], [.86, .14], [.1, .5], [.9, .5], [.14, .86], [.5, .9], [.86, .86]];
const clone = value => JSON.parse(JSON.stringify(value));

// 框选：返回 start → end 矩形内的图块序号，行列按图集网格裁剪。
export function boxSelection(start, end, cols, rows) {
  const ids = [], clamp = (value, max) => Math.max(0, Math.min(max - 1, value));
  const x0 = clamp(Math.min(start.col, end.col), cols), x1 = clamp(Math.max(start.col, end.col), cols);
  const y0 = clamp(Math.min(start.row, end.row), rows), y1 = clamp(Math.max(start.row, end.row), rows);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ids.push(y * cols + x);
  return ids;
}
// Shift 单击：已选中则移出，否则按序号并入。
export const toggleTile = (selection, index) => selection.includes(index)
  ? selection.filter(id => id !== index)
  : [...selection, index].sort((a, b) => a - b);
// 检视器读取：terrain 用 'terrain'，某一位用 0-7；多选值不一致时 mixed 为 true。
export function tileSelectionValue(tiles, ids, key) {
  const read = tile => key === 'terrain' ? tile.terrain ?? -1 : tile.peering?.[key] ?? -1;
  const values = ids.filter(id => tiles[id]).map(id => read(tiles[id]));
  return values.length ? {value: values[0], mixed: values.some(value => value !== values[0])} : {value: -1, mixed: false};
}
// 检视器写入：只改这一项属性，其余属性保持不变，返回实际改动的图块数。
// 面板在没有选中任何图块时也要显示已配置的位：按图块自身在当前匹配方式下是否有有效位判断。
export function visibleBitTiles(tileset){
  const usable=terrainModeBits(tileset.mode);
  return tileset.tiles.flatMap((tile,id)=>usable.some(bit=>(tile.peering?.[bit]??-1)>=0)?[id]:[]);
}

export function setTileProperty(tiles, ids, key, value) {
  let changed = 0;
  for (const id of ids) {
    const tile = tiles[id];
    if (!tile) continue;
    if (key === 'terrain') {
      if (tile.terrain === value) continue;
      tile.terrain = value;
    } else {
      if ((tile.peering?.[key] ?? -1) === value) continue;
      tile.peering[key] = value;
    }
    changed++;
  }
  return changed;
}

// 项目像素是高字节在前的 RGBA（R<<24 | G<<16 | B<<8 | A），转成 ImageData 需要的字节序。
export function atlasRgba(pixels){
  const data=new Uint8ClampedArray(pixels.length*4);
  for(let i=0;i<pixels.length;i++){const pixel=pixels[i];data[i*4]=pixel>>>24;data[i*4+1]=pixel>>>16&255;data[i*4+2]=pixel>>>8&255;data[i*4+3]=pixel&255;}
  return data;
}
export function initTilesetPanel({panel,getDocument,mutate,message}){
  if(!panel||panel.dataset.ready)return null;
  panel.dataset.ready='1';
  // 面板会被拖出成独立窗口，节点必须每次按当前 ownerDocument 创建。
  const node=(tag,className,parent)=>{const el=panel.ownerDocument.createElement(tag);if(className)el.className=className;parent?.append(el);return el;};
  const field=(parent,label)=>{const wrap=node('label','tileset-field',parent);wrap.append(label);return wrap;};
  let activeId=null,selection=[],activeTerrain=null,lastKey='',hover=null;
  // 图块尺寸输入先暂存，点「重新切块」才写进项目，避免网格先按新尺寸切分与已有图块错位。
  let pendingW=null,pendingH=null;

  const head=node('div','tileset-head',panel);
  const toolbar=node('div','tileset-toolbar',head);
  const layerField=field(toolbar,'图集');layerField.classList.add('tileset-layer-field');
  const layerSelect=node('select',null,layerField);
  const sizeField=field(toolbar,'');sizeField.classList.add('form-field');
  const sizeCaption=node('span','field-caption',sizeField);sizeCaption.textContent='图块';
  const sizeWrap=node('span','field-control tileset-dimensions',sizeField);
  const widthInput=node('input',null,sizeWrap);widthInput.type='number';widthInput.min='1';widthInput.max='4096';widthInput.setAttribute('aria-label','图块宽度');
  sizeWrap.append('×');
  const heightInput=node('input',null,sizeWrap);heightInput.type='number';heightInput.min='1';heightInput.max='4096';heightInput.setAttribute('aria-label','图块高度');
  const repackButton=node('button','',toolbar);repackButton.type='button';repackButton.innerHTML=iconMarkup('grid');repackButton.title='按新的图块尺寸重新切块';repackButton.setAttribute('aria-label','重新切块');
  const modeWrap=field(node('div','tileset-mode',head),'匹配方式');
  const modeSelect=node('select',null,modeWrap);
  for(const [id,label]of TERRAIN_MODES)modeSelect.append(new Option(label,id));
  // 地形集紧跟「匹配方式」：先定地形集，再用下面的模式按钮去标注图块。
  const terrainHost=node('div','tileset-terrains',head);

  const modeBar=node('div','tileset-modes',head);
  const setupButton=node('button','tileset-mode-button',modeBar);setupButton.type='button';setupButton.textContent='设置';setupButton.title='设置：移到图块上点中心给它设地形，再点四角/四边设期望地形，右键清除；点图块即选中，Shift 单击加选后可用检视器批量改';
  const deriveButton=node('button','tileset-mode-button',modeBar);deriveButton.type='button';deriveButton.textContent='自动标注';deriveButton.title='按图块像素推断四角/四边的期望地形，只处理已设地形的图块';
  const clearButton=node('button','tileset-mode-button',modeBar);clearButton.type='button';clearButton.textContent='清空';clearButton.title='清空：把全部图块的地形与四角/四边期望地形重置；地形集与地形预览的格子保留，可撤销';

  const notice=node('p','tileset-notice',head);notice.id='tileset-terrain-notice';notice.setAttribute('role','status');notice.hidden=true;setupButton.setAttribute('aria-describedby',notice.id);
  const body=node('div','tileset-body',panel);
  const atlasHost=node('div','tileset-atlas',body);
  const atlasCanvas=node('canvas','tileset-atlas-canvas',atlasHost);
  // 适应内容按钮挂在画布右上角（随图集栏位固定，不随画布缩放）。
  const fitButton=node('button','tileset-fit tileset-atlas-fit',atlasHost);fitButton.type='button';fitButton.innerHTML=iconMarkup('fit');fitButton.title='适应内容';fitButton.setAttribute('aria-label','适应内容');
  atlasCanvas.width=1;atlasCanvas.height=1;
  // 图集视图：默认按栏宽显示全部图块，滚轮缩放、中键拖动画布、双击回到适应宽度。
  let view={zoom:1,x:0,y:0},stroke=null,pan=null;
  const applyView=()=>{atlasCanvas.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.zoom+')';};
  const fitView=()=>{view={zoom:1,x:0,y:0};applyView();};
  fitButton.onclick=fitView;
  const inspector=node('div','tileset-inspector',body);

  const tilesetLayer=()=>{
    const doc=getDocument(),layers=doc.layers.flatMap((layer,index)=>isTileset(layer)?[{layer,index}]:[]);
    return layers.find(item=>item.layer.id===activeId)??layers[0]??null;
  };
  const terrainName=id=>tilesetLayer()?.layer.tileset.terrains.find(item=>item.id===id)?.name;
  const editTileset=(fn,text)=>{
    const current=tilesetLayer();if(!current)return;
    const next=clone(current.layer.tileset);fn(next);
    const doc=getDocument();
    mutate(()=>{const layer=doc.layers[current.index];doc.layers[current.index]={...layer,tileset:next};},text);
  };
  const selectTerrain=id=>{
    activeTerrain=id;lastKey='';render();
    message(id===-1?'当前画笔地形：空地（-1）':'当前画笔地形：'+(terrainName(id)??'已删除'));
  };

  // 命中九宫格标注位：返回图块序号与该格的 peering bit（bit 为 null 表示图块地形本身）。
  const zoneAtEvent=event=>{
    const doc=getDocument(),current=tilesetLayer();if(!current)return null;
    const grid=atlasGrid(doc,current.layer.tileset.w,current.layer.tileset.h),rect=atlasCanvas.getBoundingClientRect();
    if(!grid.cols||!grid.rows||!rect.width||!rect.height)return null;
    const gx=(event.clientX-rect.left)/rect.width*grid.cols,gy=(event.clientY-rect.top)/rect.height*grid.rows;
    const col=Math.floor(gx),row=Math.floor(gy);
    if(col<0||row<0||col>=grid.cols||row>=grid.rows)return null;
    const spot=zoneAt(gx-col,gy-row);
    const zone=terrainZones(current.layer.tileset.mode).find(item=>item.col===spot.col&&item.row===spot.row);
    if(zone)return{index:row*grid.cols+col,zone};
    // 中心格不属于任何邻居位，设置模式下用它给图块本身设地形。
    return spot.col===1&&spot.row===1?{index:row*grid.cols+col,zone:{col:1,row:1,bit:'terrain'}}:null;
  };
  // 九宫格写入：把该位写成当前地形 id，value 为 -1 即清除。
  const applyZone=(ids,zone,value)=>{
    const key=zone.bit;
    const label=key==='terrain'
      ?(value===-1?'已清除图块地形':'已把图块地形设为「'+(terrainName(value)??'已删除')+'」')
      :(value===-1?'已清除'+NEIGHBOR_BITS[key][1]+'期望地形':'已将'+NEIGHBOR_BITS[key][1]+'期望地形设为「'+(terrainName(value)??'已删除')+'」');
    editTileset(next=>{setTileProperty(next.tiles,ids,key,value);},label);
  };
  // 按图块像素自动标注：先算出每块的新位，再一次性写回（一步撤销）。
  const autoDerive=()=>{
    const current=tilesetLayer();if(!current)return;
    const doc=getDocument(),tileset=current.layer.tileset,{w,h}=tileset,grid=atlasGrid(doc,w,h),atlas=doc.frames[0].cels[current.index];
    const ids=tileset.tiles.map((_,id)=>id);
    const updates=new Map();
    for(const id of ids){
      const tile=tileset.tiles[id];if(!tile||!(tile.terrain>=0))continue;
      const ox=id%grid.cols*w,oy=Math.floor(id/grid.cols)*h,block=new Array(w*h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)block[y*w+x]=atlas[(oy+y)*doc.width+ox+x];
      const bits=derivePeeringBits(block,w,h,tileset.mode,tile.terrain);
      if(bits.some((bit,index)=>bit!==(tile.peering[index]??-1)))updates.set(id,bits);
    }
    if(!updates.size)return message('没有需要标注的图块（先给图块设地形）');
    editTileset(next=>{for(const [id,bits] of updates)next.tiles[id].peering=bits;},'已按像素自动标注 '+updates.size+' 个图块');
  };

  function drawAtlas(current,doc,tileset){
    const index=current.index,{w,h}=tileset,grid=atlasGrid(doc,w,h),atlas=doc.frames[0].cels[index];
    atlasCanvas.width=doc.width;atlasCanvas.height=doc.height;
    const ctx=atlasCanvas.getContext('2d'),image=ctx.createImageData(doc.width,doc.height);
    image.data.set(atlasRgba(atlas));
    ctx.putImageData(image,0,0);
    for(let k=0;k<tileset.tiles.length;k++){
      const terrain=tileset.terrains.find(item=>item.id===tileset.tiles[k].terrain);
      if(!terrain)continue;
      ctx.fillStyle=terrain.color+'55';
      ctx.fillRect(k%grid.cols*w,Math.floor(k/grid.cols)*h,w,h);
    }
    ctx.strokeStyle='rgba(128,128,128,.5)';ctx.lineWidth=1;ctx.beginPath();
    for(let col=1;col<grid.cols;col++){ctx.moveTo(col*w+.5,0);ctx.lineTo(col*w+.5,doc.height);}
    for(let row=1;row<grid.rows;row++){ctx.moveTo(0,row*h+.5);ctx.lineTo(doc.width,row*h+.5);}
    ctx.stroke();
    const size=Math.max(1,Math.round(Math.min(w,h)/10));
    const activeColor=tileset.terrains.find(item=>item.id===activeTerrain)?.color??'#f5b942';
    // 已配置的位与选中的图块都画：重开项目时没有选中，也能直接看到配置好的规则。
    const usable=terrainModeBits(tileset.mode),marked=new Set(visibleBitTiles(tileset));
    for(let id=0;id<tileset.tiles.length;id++){
      const tile=tileset.tiles[id];if(!tile)continue;
      const selected=selection.includes(id);
      if(!selected&&!marked.has(id))continue;
      const sx=id%grid.cols*w,sy=Math.floor(id/grid.cols)*h;
      if(selected){
        ctx.fillStyle='rgba(245,185,66,.16)';ctx.fillRect(sx,sy,w,h);
        ctx.strokeStyle='#f5b942';ctx.lineWidth=2;ctx.strokeRect(sx+1,sy+1,w-2,h-2);
      }
      for(const bit of usable){
        const terrainColor=tileset.terrains.find(item=>item.id===(tile.peering[bit]??-1))?.color;
        ctx.fillStyle=terrainColor??'rgba(30,30,30,.75)';
        ctx.fillRect(Math.round(sx+(w-size)*BIT_SPOTS[bit][0]),Math.round(sy+(h-size)*BIT_SPOTS[bit][1]),size,size);
      }
      // 悬停可编辑图块时画出九宫格与当前格高亮；左键设置该位、右键清除。
      if(hover&&hover.index===id&&hover.zone){
        ctx.save();
        ctx.strokeStyle='rgba(245,185,66,.4)';ctx.lineWidth=1;ctx.beginPath();
        for(let i=1;i<3;i++){
          ctx.moveTo(sx+w*i/3+.5,sy);ctx.lineTo(sx+w*i/3+.5,sy+h);
          ctx.moveTo(sx,sy+h*i/3+.5);ctx.lineTo(sx+w,sy+h*i/3+.5);
        }
        ctx.stroke();
        const zx=sx+hover.zone.col*w/3,zy=sy+hover.zone.row*h/3;
        ctx.fillStyle=activeColor+'66';ctx.fillRect(zx,zy,w/3,h/3);
        ctx.strokeStyle='#f5b942';ctx.lineWidth=2;ctx.strokeRect(zx+1,zy+1,w/3-2,h/3-2);
        ctx.restore();
      }
    }
    applyView();
  }
  // 悬停变化只重画画布，避免每移一格就重建整块面板。
  const redrawAtlas=()=>{
    const doc=getDocument(),current=tilesetLayer();if(!current)return;
    drawAtlas(current,doc,stroke?stroke.next:current.layer.tileset);
  };
  // 设置模式拖动：按下即写，途经图块一起写，抬起时合成一步撤销。
  const beginStroke=(id,terrain)=>{
    const current=tilesetLayer();if(!current)return;
    stroke={terrain,ids:new Set(),next:clone(current.layer.tileset)};
    writeStroke(id);
  };
  const writeStroke=id=>{
    if(!stroke)return;
    const tile=stroke.next.tiles[id];if(!tile)return;
    stroke.ids.add(id);tile.terrain=stroke.terrain;
  };
  const commitStroke=()=>{
    const pending=stroke;stroke=null;
    const current=tilesetLayer();
    if(!pending||!current||!pending.ids.size){lastKey='';render();return;}
    const count=pending.ids.size;
    const label=pending.terrain===-1?'已清除 '+count+' 个图块的地形':'已把 '+count+' 个图块地形设为「'+(terrainName(pending.terrain)??'已删除')+'」';
    mutate(()=>{const doc=getDocument(),layer=doc.layers[current.index];doc.layers[current.index]={...layer,tileset:pending.next};},label);
    lastKey='';render();
  };

  function renderInspector(current){
    inspector.replaceChildren();
    inspector.hidden=!selection.length;
    if(!selection.length)return;
    const tileset=current.layer.tileset,tiles=tileset.tiles;
    const head=node('div','tileset-inspector-head',inspector);
    const title=node('span','tileset-inspector-title',head);title.textContent='TileData';
    const count=node('span','tileset-inspector-count',head);
    count.textContent=selection.length===1?'图块 #'+selection[0]:'已选 '+selection.length+' 个图块';
    const fill=select=>{
      select.append(new Option('空地（-1）','-1'));
      for(const item of tileset.terrains)select.append(new Option(item.name,String(item.id)));
    };
    const pick=(select,key)=>{
      const found=tileSelectionValue(tiles,selection,key);
      select.selectedIndex=found.mixed?-1:[...select.options].findIndex(option=>+option.value===found.value);
      return select;
    };
    // Godot 的 TileData 先设图块自身的地形，再设各邻居位的期望地形。
    const terrainPick=pick(node('select','tileset-terrain-select',field(inspector,'地形')),'terrain');
    fill(terrainPick);
    terrainPick.title='图块自身的地形';
    terrainPick.onchange=()=>applyToSelection('terrain',+terrainPick.value);
    const bitsTitle=node('div','tileset-bits-title',inspector);bitsTitle.textContent='Terrain Peering Bits';
    const bits=node('div','tileset-bits',inspector);
    // 只渲染当前匹配方式使用的位，不可用的位不占位。
    for(const bit of terrainModeBits(tileset.mode)){
      const select=pick(node('select','tileset-bit',field(bits,NEIGHBOR_BITS[bit][1])),bit);
      fill(select);
      select.title='第 '+bit+' 位：'+NEIGHBOR_BITS[bit][1]+'期望邻居地形';
      select.onchange=()=>applyToSelection(bit,+select.value);
    }
  }
  // 检视器改动只写这一项，并一次应用到全部选中图块（整步可撤销）。
  const applyToSelection=(key,value)=>{
    const ids=selection.slice();
    if(!ids.length)return;
    const label=key==='terrain'
      ?(value===-1?'已清除图块地形':'已把图块地形设为「'+(terrainName(value)??'已删除')+'」')
      :(value===-1?'已清除'+NEIGHBOR_BITS[key][1]+'邻居位':'已将'+NEIGHBOR_BITS[key][1]+'期望地形设为「'+(terrainName(value)??'已删除')+'」');
    editTileset(next=>{setTileProperty(next.tiles,ids,key,value);},label);
  };

  function renderTerrains(current){
    terrainHost.replaceChildren();
    const terrains=current.layer.tileset.terrains;
    const head=node('div','tileset-terrains-head',terrainHost);
    const title=node('span','tileset-terrains-title',head);title.textContent='地形集';
    const addButton=node('button','',head);addButton.type='button';addButton.innerHTML=iconMarkup('plus');addButton.title='新增地形';addButton.setAttribute('aria-label','新增地形');addButton.disabled=terrains.length>=MAX_TERRAINS;
    addButton.onclick=()=>{
      const currentNow=tilesetLayer();if(!currentNow)return;
      if(currentNow.layer.tileset.terrains.length>=MAX_TERRAINS)return message('地形最多 8 个');
      const id=currentNow.layer.tileset.terrains.reduce((max,item)=>Math.max(max,item.id),-1)+1;
      activeTerrain=id;
      editTileset(next=>{next.terrains.push({id,name:'地形 '+(id+1),color:DEFAULT_TERRAIN_COLORS[next.terrains.length%DEFAULT_TERRAIN_COLORS.length]});},'已新增地形');
    };
    for(const terrain of terrains){
      const row=node('div','tileset-terrain-row',terrainHost);
      row.classList.toggle('active',activeTerrain===terrain.id);
      const pick=node('button','tileset-terrain-pick',row);pick.type='button';pick.title='设为地形画笔的当前地形';pick.setAttribute('aria-pressed',String(activeTerrain===terrain.id));
      const swatch=node('span','tileset-terrain-swatch',pick);swatch.style.background=terrain.color;
      pick.onclick=()=>selectTerrain(terrain.id);
      const name=node('input','tileset-terrain-name',row);name.value=terrain.name;name.setAttribute('aria-label','地形名称');
      name.onchange=()=>{
        const value=name.value.trim()||terrain.name;name.value=value;
        if(value===terrain.name)return;
        editTileset(next=>{next.terrains.find(item=>item.id===terrain.id).name=value.slice(0,40);},'已重命名地形');
      };
      const color=node('input','tileset-terrain-color',row);color.type='color';color.value=terrain.color;color.title='地形颜色';color.setAttribute('aria-label',terrain.name+'的颜色');
      color.onchange=()=>editTileset(next=>{next.terrains.find(item=>item.id===terrain.id).color=color.value;},'已修改地形颜色');
      const remove=node('button','tileset-terrain-delete',row);remove.type='button';remove.innerHTML=iconMarkup('clear');remove.title='删除地形';remove.setAttribute('aria-label','删除地形');
      remove.onclick=()=>{
        const currentNow=tilesetLayer();if(!currentNow)return;
        const remaining=currentNow.layer.tileset.terrains.filter(item=>item.id!==terrain.id);
        if(activeTerrain===terrain.id)activeTerrain=remaining[0]?.id??-1;
        editTileset(next=>{
          next.terrains=next.terrains.filter(item=>item.id!==terrain.id);
          for(const tile of next.tiles){if(tile.terrain===terrain.id)tile.terrain=-1;tile.peering=tile.peering.map(bit=>bit===terrain.id?-1:bit);}
        },'已删除地形');
      };
    }
  }

  function render(){
    const doc=getDocument(),current=tilesetLayer();if(!current)return;
    activeId=current.layer.id;
    const tileset=current.layer.tileset,terrains=tileset.terrains;
    if(activeTerrain===null||(activeTerrain!==-1&&!terrains.some(item=>item.id===activeTerrain)))activeTerrain=terrains[0]?.id??-1;
    selection=selection.filter(id=>id<tileset.tiles.length);
    const key=JSON.stringify([doc.width,doc.height,activeId,doc.layers.map(layer=>[layer.id,layer.name]),tileset,selection,activeTerrain]);
    if(key===lastKey)return;
    lastKey=key;
    layerSelect.replaceChildren(...doc.layers.flatMap(layer=>isTileset(layer)?[new Option(layer.name,String(layer.id))]:[]));
    layerSelect.value=String(activeId);
    if(pendingW!==null)widthInput.value=pendingW;else if(panel.ownerDocument.activeElement!==widthInput)widthInput.value=tileset.w;
    if(pendingH!==null)heightInput.value=pendingH;else if(panel.ownerDocument.activeElement!==heightInput)heightInput.value=tileset.h;
    modeSelect.value=tileset.mode;
    setupButton.classList.add('active');setupButton.setAttribute('aria-pressed','true');
    if(terrains.length)notice.hidden=true;
    drawAtlas(current,doc,tileset);
    renderInspector(current);
    renderTerrains(current);
  }

  layerSelect.onchange=()=>{activeId=+layerSelect.value;selection=[];view={zoom:1,x:0,y:0};lastKey='';render();};
  // 尺寸只记在输入框里，点「重新切块」才真正生效：否则图集网格先按新尺寸切分，
  // 已有的图块列表与标注就会和网格错位。
  const pendingSize=()=>({w:Math.max(1,Math.min(4096,Math.round(+widthInput.value)||1)),h:Math.max(1,Math.min(4096,Math.round(+heightInput.value)||1))});
  widthInput.onchange=()=>{pendingW=pendingSize().w;widthInput.value=pendingW;message('图块宽度 '+pendingW+'，点「重新切块」生效');};
  heightInput.onchange=()=>{pendingH=pendingSize().h;heightInput.value=pendingH;message('图块高度 '+pendingH+'，点「重新切块」生效');};
  repackButton.onclick=()=>{
    const currentNow=tilesetLayer();if(!currentNow)return;
    const doc=getDocument(),{w,h}=currentNow.layer.tileset,next=pendingSize();
    const atlas=doc.frames[0].cels[currentNow.index];
    const packed=packTileset(atlas,doc.width,doc.height,next.w,next.h);
    if(!packed.count)return message('图层没有可切分的非透明像素');
    // 尺寸变了会改变切块，原来按序号绑定的规则会错位，所以按像素内容把规则搬到新的图块上。
    const tiles=migrateTiles(currentNow.layer.tileset.tiles,atlas,doc.width,doc.height,w,h,next.w,next.h);
    selection=[];pendingW=null;pendingH=null;view={zoom:1,x:0,y:0};
    mutate(()=>{
      const layer=doc.layers[currentNow.index];
      for(const frame of doc.frames)frame.cels[currentNow.index]=packed.atlas.slice();
      doc.layers[currentNow.index]={...layer,tileset:{...layer.tileset,w:next.w,h:next.h,tiles:packed.tiles.map((_,id)=>tiles[id])}};
    },next.w===w&&next.h===h?'已按当前尺寸重新切块，图块规则已保留':'已按 '+next.w+' × '+next.h+' 重新切块，图块尺寸变了，原有地形标注已重置');
  };
  modeSelect.onchange=()=>editTileset(next=>{next.mode=modeSelect.value;clearInactiveBits(next.tiles,next.mode);},'已切换地形匹配方式');
  const requireTerrain=()=>{if(tilesetLayer()?.layer.tileset.terrains.length)return true;notice.textContent='请先在地形集中添加地形，再设置图块';notice.hidden=false;message(notice.textContent);return false;};
  setupButton.onclick=requireTerrain;
  deriveButton.onclick=()=>autoDerive();
  // 一键清空全部图块规则：地形集定义与地形预览的格子都保留，只把标注归零（一次撤销可还原）。
  clearButton.onclick=()=>{
    const current=tilesetLayer();if(!current)return;
    const tiles=current.layer.tileset.tiles;
    if(!tiles.some(tile=>(tile.terrain??-1)>=0||(tile.peering??[]).some(bit=>bit>=0)))return message('还没有设置任何图块规则');
    editTileset(next=>{next.tiles.forEach(tile=>{tile.terrain=-1;tile.peering=new Array(8).fill(-1);});},'已清空全部图块规则');
  };

  // 图集视图操作：滚轮以指针为锚缩放，中键拖动平移，双击回到适应宽度。
  atlasHost.addEventListener('wheel',event=>{
    if(event.target!==atlasCanvas)return;
    event.preventDefault();
    const next=Math.max(.4,Math.min(8,view.zoom*(event.deltaY<0?1.25:1/1.25)));
    if(next===view.zoom)return;
    const box=atlasHost.getBoundingClientRect();
    const px=(event.clientX-box.left-view.x)/view.zoom,py=(event.clientY-box.top-view.y)/view.zoom;
    view={zoom:next,x:event.clientX-box.left-px*next,y:event.clientY-box.top-py*next};
    applyView();
  },{passive:false});
  atlasCanvas.addEventListener('dblclick',fitView);

  // 悬停：鼠标停在哪块图块上就画出该块的九宫格，标明可以点哪里。
  atlasCanvas.addEventListener('pointermove',event=>{
    if(pan){view={zoom:view.zoom,x:pan.x+event.clientX-pan.cx,y:pan.y+event.clientY-pan.cy};applyView();return;}
    if(stroke){const hit=zoneAtEvent(event);if(hit&&hit.zone.bit==='terrain'){writeStroke(hit.index);redrawAtlas();}return;}
    const hit=zoneAtEvent(event),next=hit?{index:hit.index,zone:hit.zone}:null;
    const same=(hover===null&&next===null)||(hover&&next&&hover.index===next.index&&hover.zone.col===next.zone.col&&hover.zone.row===next.zone.row);
    if(same)return;
    hover=next;redrawAtlas();
  });
  atlasCanvas.addEventListener('pointerleave',()=>{if(hover&&!stroke){hover=null;redrawAtlas();}});
  atlasCanvas.oncontextmenu=event=>event.preventDefault();

  // 九宫格：左键写成当前地形、右键清除；中心格可从按下的图块拖过一串图块批量设，抬起时合成一步撤销。
  atlasCanvas.addEventListener('pointerdown',event=>{
    if(event.button===1){event.preventDefault();pan={cx:event.clientX,cy:event.clientY,x:view.x,y:view.y};atlasCanvas.setPointerCapture(event.pointerId);return;}
    const current=tilesetLayer();if(!current)return;
    if(event.button===0&&!requireTerrain()){event.preventDefault();return;}
    const hit=zoneAtEvent(event);if(!hit)return;
    event.preventDefault();
    selection=event.shiftKey?toggleTile(selection,hit.index):[hit.index];
    lastKey='';
    const value=event.button===2||activeTerrain===-1?-1:activeTerrain;
    // 邻居位只对已设过地形的图块有意义；中心格用来设图块自身地形。
    if(hit.zone.bit!=='terrain'){
      if(!((current.layer.tileset.tiles[hit.index]?.terrain??-1)>=0)){render();return message('先在这个图块中心点一下给它设地形，再设四角/四边的期望地形');}
      applyZone([hit.index],hit.zone,value);
      lastKey='';render();
      return;
    }
    beginStroke(hit.index,value);
    atlasCanvas.setPointerCapture(event.pointerId);
    redrawAtlas();
  });
  const finishPointer=event=>{
    if(atlasCanvas.hasPointerCapture(event.pointerId))atlasCanvas.releasePointerCapture(event.pointerId);
    if(pan){pan=null;return;}
    if(stroke)commitStroke();
  };
  atlasCanvas.addEventListener('pointerup',finishPointer);
  atlasCanvas.addEventListener('pointercancel',finishPointer);
  return {
    render,
    get selected(){return selection.at(-1)??0;},
    get selection(){return selection.slice();},
    selectTile(index){selection=[index];lastKey='';render();},
    terrainFor(tileset){
      if(activeTerrain!==null&&(activeTerrain===-1||tileset.terrains.some(item=>item.id===activeTerrain)))return activeTerrain;
      return tileset.terrains[0]?.id??-1;
    }
  };
}
