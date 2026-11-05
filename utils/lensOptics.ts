/** Miniature product stage: one world unit represents 100 mm.
 * Thin-lens circle-of-confusion radius, before multiplying abs(z-focus)/z.
 * Keep this calibration independent of display DPI; height is actual output pixels.
 */
export function focusBlurScale(focusDistance:number,aperture:number,focalLength:number,sensorHeight:number,height:number){
 const focusMm=Math.max(focalLength+1,focusDistance*100);
 return focalLength*focalLength/(Math.max(1,aperture)*(focusMm-focalLength))*height/(2*sensorHeight);
}
