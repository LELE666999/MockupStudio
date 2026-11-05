import type {AppState} from '../types.ts';
// Archives already contain full media payloads; they are not part of scene undo.
export function historySnapshot(state:AppState):AppState {
 return structuredClone({...state,savedProjects:[],isPlaying:false,isExporting:false,exportDpr:undefined});
}
export function restoreHistory(snapshot:AppState,current:AppState):AppState {
 return {...snapshot,savedProjects:current.savedProjects};
}
