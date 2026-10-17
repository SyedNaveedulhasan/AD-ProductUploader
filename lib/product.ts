import { z } from 'zod';
export const productSchema = z.object({
  id: z.string().optional(), name: z.string().trim().min(1).max(200), sku: z.string().trim().max(100),
  type: z.enum(['simple','variable','external','grouped']), price: z.coerce.number().min(0),
  sale_price: z.union([z.literal(''),z.coerce.number().min(0)]).default(''), stock: z.coerce.number().int().min(0),
  category: z.string().max(100), description: z.string().max(30000), status: z.enum(['draft','publish']),
  image: z.string().max(4000).refine(v => !v || /^https:\/\//.test(v), 'Use an HTTPS image URL'),
  virtual: z.boolean().default(false), downloadable: z.boolean().default(false),
  download_url: z.string().max(4000).default(''), weight: z.string().max(30).default(''),
  length: z.string().max(30).default(''), width: z.string().max(30).default(''), height: z.string().max(30).default(''),
  external_url: z.string().max(4000).default(''), grouped_ids: z.array(z.number().int().positive()).default([]),
  variations: z.array(z.object({attribute:z.string().min(1),option:z.string().min(1),sku:z.string(),price:z.coerce.number().min(0),stock:z.coerce.number().int().min(0)})).max(100).default([]),
}).superRefine((p,c)=>{
  if(p.sale_price !== '' && p.sale_price > p.price) c.addIssue({code:'custom',message:'Sale price must be below the regular price',path:['sale_price']});
  if(p.type==='variable' && !p.variations.length) c.addIssue({code:'custom',message:'Add at least one variation',path:['variations']});
  const combinations=new Set<string>();
  for(const v of p.variations){const names=v.attribute.split('|').map(x=>x.trim());const options=v.option.split('|').map(x=>x.trim());if(names.length!==options.length||names.some(x=>!x)||options.some(x=>!x)||new Set(names).size!==names.length)c.addIssue({code:'custom',message:'Match each attribute to an option, e.g. Size | Color and Medium | Blue',path:['variations']});const signature=names.map((n,i)=>n.toLowerCase()+':'+options[i]?.toLowerCase()).sort().join('|');if(combinations.has(signature))c.addIssue({code:'custom',message:'Each variation must have a unique combination',path:['variations']});combinations.add(signature);}
  if(p.type==='external' && !/^https:\/\//.test(p.external_url)) c.addIssue({code:'custom',message:'Enter an HTTPS affiliate URL',path:['external_url']});
  if(p.downloadable && !/^https:\/\//.test(p.download_url)) c.addIssue({code:'custom',message:'Enter an HTTPS download URL',path:['download_url']});
});
export type Product = z.infer<typeof productSchema> & {id:string;woo_id?:number;updated_at?:string;error?:string};
export const blankProduct: Product={id:'',name:'',sku:'',type:'simple',price:0,sale_price:'',stock:0,category:'',description:'',status:'draft',image:'',virtual:false,downloadable:false,download_url:'',weight:'',length:'',width:'',height:'',external_url:'',grouped_ids:[],variations:[]};
export function variationAttributes(v:{attribute:string;option:string}){const options=v.option.split('|').map(x=>x.trim());return v.attribute.split('|').map((name,i)=>({name:name.trim(),option:options[i]}));}
export function parseCSV(text:string): string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=ch;}
  if(quoted)throw new Error('CSV contains an unclosed quote');row.push(cell);if(row.some(Boolean))rows.push(row);return rows;
}
export function csvProducts(text:string){const [header,...rows]=parseCSV(text.replace(/^\uFEFF/,''));if(!header?.includes('name'))throw new Error('The CSV needs a name column');if(rows.length>500)throw new Error('Import up to 500 products at a time');return rows.map((r,i)=>{const obj=Object.fromEntries(header.map((h,j)=>[h.trim(),r[j]??'']));const parsed=productSchema.safeParse({...blankProduct,...obj,virtual:obj.virtual==='true',downloadable:obj.downloadable==='true',variations:[],grouped_ids:[]});if(!parsed.success)throw new Error(`Row ${i+2}: ${parsed.error.issues[0].message}`);return {...parsed.data,id:crypto.randomUUID()};});}

