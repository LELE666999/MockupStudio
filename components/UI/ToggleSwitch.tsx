import React from 'react';

export function ToggleSwitch({label,checked,onChange,disabled=false}:{
  label:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean;
}) {
  return <span className="toggle-switch">
    <input type="checkbox" role="switch" aria-label={label} checked={checked}
      disabled={disabled} onChange={event=>onChange(event.target.checked)}/>
    <span aria-hidden="true" className="toggle-switch__track"/>
  </span>;
}
