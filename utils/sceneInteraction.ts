let suppressUntil=0;
export function gizmoGesture(dragging:boolean){suppressUntil=dragging?Infinity:performance.now()+250;}
export function suppressSceneClick(){return performance.now()<suppressUntil;}
