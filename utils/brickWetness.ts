import * as T from 'three';

const fract=(value:number)=>value-Math.floor(value);
const hash=(x:number,z:number)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
function noise(x:number,z:number){
 const ix=Math.floor(x),iz=Math.floor(z),fx=fract(x),fz=fract(z),u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),T.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
/** A fixed, coherent catchment field. Broad damp patches cross a course,
 * while individual blocks and the actual displaced recesses vary locally.
 * Do not use edge distance: that would give every brick a glossy outline. */
export function brickWaterPotential(x:number,z:number,seed:number,recess:number){
 return T.MathUtils.clamp(.14+noise(x*.58,z*.58)*.46+noise(x*1.8+19,z*1.8-7)*.16+(hash(seed,37)-.5)*.2+T.MathUtils.clamp(recess,0,1)*.15,0,1);
}
export const brickWetThreshold=(wetness:number)=>.79-T.MathUtils.clamp(wetness,0,1)*.32;
export function brickWaterCoverage(potential:number,wetness:number){
 if(wetness<=0)return 0;
 const threshold=brickWetThreshold(wetness);
 return T.MathUtils.smoothstep(potential,threshold-.13,threshold+.13)*T.MathUtils.smoothstep(wetness,0,.16);
}
/** The material and collision/impact code apply the same coverage transfer. */
export const BRICK_WATER_GLSL=`
 float brickWaterCoverage(float potential,float wetness){
  float amount=clamp(wetness,0.,1.);float threshold=.79-amount*.32;
  return smoothstep(threshold-.13,threshold+.13,potential)*smoothstep(0.,.16,amount);
 }
`;
