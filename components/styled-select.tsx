'use client';
import {useState} from 'react';
import {Check, ChevronDown, Plus} from 'lucide-react';
import {Select, SelectTrigger, SelectValue, SelectContent, SelectItem} from '@/components/ui/select';
import {Popover, PopoverTrigger, PopoverContent} from '@/components/ui/popover';
import {Command, CommandInput, CommandList, CommandEmpty, CommandItem} from '@/components/ui/command';

type Option = {value:string; label:string};
export function StyledSelect({value, onValueChange, options, label, placeholder, disabled=false, className=''}: {
  value:string; onValueChange:(value:string)=>void; options:Option[]; label:string; placeholder?:string; disabled?:boolean; className?:string;
}) {
  return <Select value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger aria-label={label} className={`styled-select ${className}`}><SelectValue placeholder={placeholder||label}/></SelectTrigger>
    <SelectContent position="popper" align="start" sideOffset={6} className="styled-select-menu">
      {options.map(option=><SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}

export function CategorySelect({value, onValueChange, categories}: {value:string; onValueChange:(value:string)=>void; categories:string[]}) {
  const [open,setOpen]=useState(false), [query,setQuery]=useState('');
  const choices=Array.from(new Set([...categories,value].filter(Boolean)));
  const filtered=choices.filter(c=>c.toLowerCase().includes(query.trim().toLowerCase()));
  const newCategory=query.trim();
  const choose=(category:string)=>{onValueChange(category);setOpen(false);setQuery('')};
  return <Popover open={open} onOpenChange={next=>{setOpen(next);if(!next)setQuery('')}}>
    <PopoverTrigger asChild><button type="button" role="combobox" aria-expanded={open} aria-label="Product category" className="styled-select category-trigger" data-placeholder={!value||undefined}>
      <span>{value||'Choose or create a category'}</span><ChevronDown size={16}/>
    </button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={6} className="category-menu styled-select-menu">
      <Command shouldFilter={false}>
        <CommandInput aria-label="Search or create a category" placeholder="Search or create a category…" value={query} onValueChange={setQuery}/>
        <CommandList>
          <CommandEmpty>Type a category name.</CommandEmpty>
          {value&&<CommandItem value="clear-category" onSelect={()=>choose('')}>Clear category</CommandItem>}
          {filtered.map(category=><CommandItem key={category} value={category} onSelect={()=>choose(category)}><span>{category}</span>{category===value&&<Check size={16} className="ml-auto"/>}</CommandItem>)}
          {newCategory&&!choices.some(c=>c.toLowerCase()===newCategory.toLowerCase())&&<CommandItem value={`create-${newCategory}`} onSelect={()=>choose(newCategory)}><Plus size={16}/>Create “{newCategory}”</CommandItem>}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
