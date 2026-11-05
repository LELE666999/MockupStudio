import React,{useState} from 'react';
import {Sun,Moon} from 'lucide-react';
export function ThemeToggle(){
 const [theme,setTheme]=useState(()=>document.documentElement.dataset.theme||'light');
 const next=theme==='light'?'dark':'light';
 return <button type="button" className="theme-toggle" aria-label={`切换到${next==='light'?'浅':'深'}色模式`} title={`切换到${next==='light'?'浅':'深'}色模式`} onClick={()=>{
  setTheme(next);document.documentElement.dataset.theme=next;
  try{localStorage.setItem('mockup-ui-theme',next);}catch{}
 }}>{theme==='light'?<Moon size={14}/>:<Sun size={14}/>}</button>;
}
