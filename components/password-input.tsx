'use client';
import {useState, useId} from 'react';
import {Eye, EyeOff} from 'lucide-react';

export default function PasswordInput({signup}: {signup:boolean}) {
  const [visible,setVisible]=useState(false);
  const id=useId();
  return <div className="password-input">
    <input id={id} aria-label="Password" name="password" type={visible?'text':'password'} minLength={8} required autoComplete={signup?'new-password':'current-password'}/>
    <button type="button" className="password-toggle" aria-label={visible?'Hide password':'Show password'} aria-controls={id} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>
      {visible?<EyeOff size={19}/>:<Eye size={19}/>}
    </button>
  </div>;
}
