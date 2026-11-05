export interface BrickBasin {x:number;z:number;rx:number;rz:number;depth:number;rimY:number;seed:number}
const random=(seed:number)=>{const value=Math.sin(seed*127.1+19.7)*43758.5453;return value-Math.floor(value);};

/** Only some bricks have shallow worn bowls. Keep them away from all UV
 * seams / bevels: a depression must never open the closed brick shell. */
export function brickBasin(block:{size:[number,number,number];center:[number,number,number];seed:number}):BrickBasin|null{
 const [w,h,d]=block.size;
 if(w<1.5||d<1.5||random(block.seed+211)>.43)return null;
 return {x:block.center[0]+(random(block.seed+217)-.5)*w*.22,z:block.center[2]+(random(block.seed+223)-.5)*d*.18,rx:w*(.23+random(block.seed+227)*.055),rz:d*(.25+random(block.seed+229)*.075),depth:Math.min(h*.12,.13+random(block.seed+233)*.045),rimY:block.center[1]+h/2,seed:block.seed};
}
export function brickBasinRadius(basin:BrickBasin,x:number,z:number){
 const px=(x-basin.x)/basin.rx,pz=(z-basin.z)/basin.rz,angle=Math.atan2(pz,px);
 return Math.hypot(px,pz)*(1+.065*Math.sin(angle*3+basin.seed)+.035*Math.cos(angle*5-basin.seed));
}
export function brickBasinDepth(basin:BrickBasin,x:number,z:number){
 const r=brickBasinRadius(basin,x,z);
 return r>=1?0:basin.depth*Math.pow(1-r*r,1.55);
}
