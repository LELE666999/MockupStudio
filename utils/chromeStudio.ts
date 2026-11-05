import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {StageObject} from '../types';

/** Large welded round rods rather than the fine woven-wire material preset.
 * Crossings are tangent, not coplanar intersecting sheets. All rods share a
 * single indexed draw and analytic cylinder normals. */
export function chromeRackGeometry(o:StageObject){
 const [w,h,d]=o.size,radius=Math.min(h/4,w*.0035,d*.0035),pitch=Math.max(.8,1.35/(o.textureScale??1));
 const parts:T.BufferGeometry[]=[];
 const nx=Math.min(40,Math.max(2,Math.ceil(w/pitch))),nz=Math.min(40,Math.max(2,Math.ceil(d/pitch)));
 for(let i=0;i<=nz;i++)parts.push(new T.CylinderGeometry(radius,radius,w,32,1,false).rotateZ(Math.PI/2).translate(0,h/2-radius,(i/nz-.5)*d));
 for(let i=0;i<=nx;i++)parts.push(new T.CylinderGeometry(radius,radius,d,32,1,false).rotateX(Math.PI/2).translate((i/nx-.5)*w,h/2-radius*3,0));
 const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.chromeRack={nx,nz,radius,pitch};return geometry;
}
