import React from 'react';
export function SegmentedControl<T extends string>({label,value,options,disabled,onChange}:{label:string;value:T;options:{value:T;label:string}[];disabled?:boolean;onChange:(value:T)=>void}){
  const index=Math.max(0,options.findIndex(option=>option.value===value));
  return <div role="group" aria-label={label} className="segmented-control">
    <div className="relative flex">
      <span aria-hidden="true" className="segmented-control__thumb" style={{width:`${100/options.length}%`,transform:`translateX(${index*100}%)`}}/>
      {options.map(option=><button key={option.value} type="button" disabled={disabled} aria-pressed={value===option.value} onClick={()=>onChange(option.value)} className="segmented-control__option">{option.label}</button>)}
    </div>
  </div>;
}
