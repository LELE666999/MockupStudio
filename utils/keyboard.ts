export function isKeyboardControl(target:EventTarget|null){
  return target instanceof HTMLElement && (!!target.closest('input,textarea,select,button,a,[role="button"],[role="slider"],[role="textbox"]') || target.isContentEditable);
}
