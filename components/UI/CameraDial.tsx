import React,{useEffect,useRef} from 'react';

/** Indexed detents support dragging, wheel and keyboard, without scrolling the inspector. */
export function CameraDial({label,value,values,format,onChange,disabled=false}:{label:string;value:number;values:number[];format:(n:number)=>string;onChange:(n:number)=>void;disabled?:boolean}){
 const index=values.reduce((best,n,i)=>Math.abs(n-value)<Math.abs(values[best]-value)?i:best,0);
 const drag=useRef<{x:number;index:number;last:number}|null>(null);
 const wheel=useRef<HTMLDivElement>(null);
 const change=(i:number)=>onChange(values[Math.max(0,Math.min(values.length-1,i))]);
 useEffect(()=>{
  const node=wheel.current;if(!node)return;
  const scroll=(event:WheelEvent)=>{if(disabled||document.activeElement!==node)return;event.preventDefault();event.stopPropagation();if(Math.abs(event.deltaX+event.deltaY)>4)change(index+Math.sign(event.deltaX+event.deltaY));};
  node.addEventListener('wheel',scroll,{passive:false});return ()=>node.removeEventListener('wheel',scroll);
 },[disabled,index,onChange,values]);
 return <div className={`camera-dial ${disabled?'camera-dial--disabled':''}`}>
  <div className="camera-dial__heading"><span>{label}</span><output>{format(value)}</output></div>
  <div ref={wheel} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={values.length-1} aria-valuenow={index} aria-valuetext={format(value)} aria-disabled={disabled} tabIndex={disabled?-1:0}
   className="camera-dial__wheel" onKeyDown={e=>{if(disabled)return;if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();change(e.key==='Home'?0:e.key==='End'?values.length-1:index+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}}}
   onPointerDown={e=>{if(disabled||e.button!==0)return;e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,index,last:index};}}
   onPointerMove={e=>{if(drag.current&&!disabled){const next=Math.max(0,Math.min(values.length-1,drag.current.index+Math.round((drag.current.x-e.clientX)/24)));if(next!==drag.current.last){drag.current.last=next;change(next);}}}}
   onPointerUp={e=>{if(drag.current&&!disabled&&Math.abs(e.clientX-drag.current.x)<4){const box=e.currentTarget.getBoundingClientRect();change(index+Math.round((e.clientX-box.x-box.width/2)/48));}drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <div className="camera-dial__strip" style={{transform:`translateX(calc(50% - ${index*48+24}px))`}}>
    {values.map((n,i)=><span key={n} className={i===index?'is-current':''}>{format(n)}</span>)}
   </div>
   <i aria-hidden="true"/>
  </div>
 </div>;
}
