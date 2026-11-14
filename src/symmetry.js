export function symmetryPoints(x,y,width,height,settings=false){
 const options=settings===true?{horizontal:true}:settings||{},axisX=options.x??width/2,axisY=options.y??height/2;
 const mirrorX=Math.round(2*axisX-x-1),mirrorY=Math.round(2*axisY-y-1),xs=options.horizontal&&mirrorX!==x?[x,mirrorX]:[x],ys=options.vertical&&mirrorY!==y?[y,mirrorY]:[y];
 return ys.flatMap(py=>xs.map(px=>({x:px,y:py})));
}

export function validateSymmetryAxes(value,width,height){
 if(!value||![value.x,value.y].every(Number.isFinite)||value.x<0||value.x>width||value.y<0||value.y>height)throw new Error('对称轴位置无效');
 return{x:value.x,y:value.y};
}
