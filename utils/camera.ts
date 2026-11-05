import type {LensConfig} from '../types';
/** Relative exposure referenced to f/2.8, 1/60 s, ISO 100. */
export function cameraExposure(lens:LensConfig) {
 if(lens.exposureMode!=='manual')return 1;
 return Math.max(1/256,Math.min(256,(lens.shutter??1/60)*60*(lens.iso??100)/100*(2.8/lens.aperture)**2));
}
