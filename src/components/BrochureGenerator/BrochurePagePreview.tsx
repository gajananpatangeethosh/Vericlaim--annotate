import { useRef, useState } from 'react'
import type { BrochureDesign, BrochurePage, BrochureElement, BrochureTemplateId } from '../../types'
import { BROCHURE_TEMPLATES, FONT_FAMILIES } from '../../utils/constants'
const FONT_WEIGHT_MAP: Record<string, string> = { normal: '400', bold: '700', semibold: '600', italic: '400' }
interface Props { page: BrochurePage; design: BrochureDesign; selectedElementId: string | null; onSelectElement: (id: string | null) => void; onUpdateElement?: (id: string, patch: Partial<BrochureElement>) => void }
function getTemplate(design: BrochureDesign){ return BROCHURE_TEMPLATES.find((t)=>t.id===(design.templateId as BrochureTemplateId))||BROCHURE_TEMPLATES[1] }
function getFontStack(id?:string){ return FONT_FAMILIES.find((f)=>f.id===id)?.stack }
function isColorDark(hex:string){const c=hex.replace('#','');const r=parseInt(c.substring(0,2),16);const g=parseInt(c.substring(2,4),16);const b=parseInt(c.substring(4,6),16);return(r*0.299+g*0.587+b*0.114)<150}
export function BrochurePagePreview({page,design,selectedElementId,onSelectElement,onUpdateElement}:Props){
 const tmpl=getTemplate(design)
 const {brandName,tagline,footerText}=design
 const contentElements=page.elements.filter((e)=>e.type!=='footer')
 const footerEl=page.elements.find((e)=>e.type==='footer')
 const footerLabel=footerEl?.text||footerText||`Page ${page.pageNumber}`
 const isCover=page.pageNumber===1
 const headerStyle=(()=>{switch(tmpl.id){case 'modern-minimal':return{bg:'#0f172a',h:30,textColor:'#ffffff'};case 'vibrant-wellness':return{bg:`linear-gradient(135deg, ${design.primaryColor} 0%, ${design.secondaryColor} 100%)`,h:42,textColor:'#ffffff'};case 'elegant-corporate':return{bg:'#0f172a',h:44,textColor:'#fef9c3',borderBottom:`3px solid ${design.accentColor}`} ;case 'tri-fold':return{bg:design.primaryColor,h:34,textColor:'#ffffff'};default:return{bg:design.primaryColor,h:36,textColor:'#ffffff'}}})()
 const pageBg=(page as any).backgroundColor||(tmpl.id==='modern-minimal'?'#f8fafc':tmpl.id==='vibrant-wellness'?'#fffbeb':'#ffffff')
 const isDarkPage=isColorDark(pageBg)
 const contentBg=isDarkPage?pageBg:'#ffffff'
 const contentRef=useRef<HTMLDivElement>(null)
 const [drag,setDrag]=useState<null|{id:string;startX:number;startY:number;origX:number;origY:number}>(null)
 const [resize,setResize]=useState<null|{id:string;startX:number;startW:number;startH:number}>(null)
 const handlePointerDown=(e:React.PointerEvent,el:BrochureElement)=>{
  if(!onUpdateElement) return
  const rect=contentRef.current?.getBoundingClientRect()
  if(!rect) return
  const target=e.currentTarget as HTMLElement
  const elRect=target.getBoundingClientRect()
  const origX=el.x?? elRect.left-rect.left
  const origY=el.y?? elRect.top-rect.top
  if(el.x===undefined||el.y===undefined){ onUpdateElement(el.id,{x:origX,y:origY,width:el.width??elRect.width})}
  setDrag({id:el.id,startX:e.clientX,startY:e.clientY,origX,origY})
  ;(e.target as HTMLElement).setPointerCapture((e as any).pointerId)
 }
 const handleResizeDown=(e:React.PointerEvent,el:BrochureElement)=>{
  e.stopPropagation()
  if(!onUpdateElement) return
  setResize({id:el.id,startX:e.clientX,startW:el.width||120,startH:el.height|| (el.fontSize||120)})
  ;(e.target as HTMLElement).setPointerCapture((e as any).pointerId)
 }
 const handlePointerMove=(e:React.PointerEvent)=>{
  if(drag&&onUpdateElement){
   const dx=e.clientX-drag.startX;const dy=e.clientY-drag.startY
   const nx=Math.max(0,Math.min(320,drag.origX+dx));const ny=Math.max(0,drag.origY+dy)
   onUpdateElement(drag.id,{x:nx,y:ny})
  }
  if(resize&&onUpdateElement){
   const dw=e.clientX-resize.startX
   const nh=Math.max(40,resize.startH)
   const nw=Math.max(40,resize.startW+dw)
   onUpdateElement(resize.id,{width:nw,height:nh})
  }
 }
 const handlePointerUp=(e:React.PointerEvent)=>{ if(drag){try{(e.target as HTMLElement).releasePointerCapture((e as any).pointerId)}catch{} setDrag(null)} if(resize){try{(e.target as HTMLElement).releasePointerCapture((e as any).pointerId)}catch{} setResize(null)} }
 return (
 <div className="relative mx-auto select-none" style={{width:'420px'}}>
  <div data-export-page className="relative overflow-hidden rounded-xl bg-white" style={{aspectRatio:'595 / 842',boxShadow:'0 20px 60px rgba(15,23,42,0.12), 0 2px 10px rgba(15,23,42,0.08)',border:'1px solid rgba(15,23,42,0.06)',backgroundColor:pageBg}} onClick={()=>onSelectElement(null)}>
   <div className="absolute left-0 right-0 top-0 flex items-center justify-center px-3" style={{height:`${headerStyle.h}px`,background:(headerStyle.bg.includes('gradient')?headerStyle.bg:undefined),backgroundColor:headerStyle.bg.includes('gradient')?undefined:headerStyle.bg,borderBottom:(headerStyle as any).borderBottom||undefined}}>
    <span className="text-center font-bold leading-tight tracking-tight" style={{color:headerStyle.textColor,fontSize:isCover?'15px':'13px',fontFamily:tmpl.id==='elegant-corporate'?'ui-serif, Georgia, serif':undefined,letterSpacing:tmpl.id==='modern-minimal'?'0.04em':undefined,textTransform:tmpl.id==='modern-minimal'?'uppercase' as any:undefined}}>{brandName||'Medical Brochure'}</span>
    {tmpl.id==='modern-minimal'&&<span className="absolute bottom-0 left-6 right-6 h-px bg-white/20"/>}
   </div>
   {tagline&&<div className="absolute left-0 right-0 text-center" style={{top:`${headerStyle.h+6}px`}}><span className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-medium tracking-wide" style={{backgroundColor:tmpl.id==='vibrant-wellness'?'#fef3c7':tmpl.id==='elegant-corporate'?'#fef9c3':'#f1f5f9',color:tmpl.id==='vibrant-wellness'?'#92400e':design.primaryColor,border:tmpl.id==='modern-minimal'?'1px solid #e2e8f0':undefined}}>{tagline}</span></div>}
   <div ref={contentRef} className="absolute overflow-hidden rounded-lg" style={{left:'28px',right:'28px',top:tagline?`${headerStyle.h+28}px`:`${headerStyle.h+10}px`,bottom:'38px',backgroundColor:contentBg,padding:'8px',boxShadow:tmpl.id==='clinical-blue'?'0 1px 3px rgba(0,0,0,0.06)':tmpl.id==='vibrant-wellness'?'0 4px 12px rgba(0,0,0,0.05)':undefined,border:isDarkPage?'1px solid rgba(255,255,255,0.08)':tmpl.id==='modern-minimal'?'1px solid #f1f5f9':tmpl.id==='tri-fold'?'1px dashed #e2e8f0':'1px solid rgba(0,0,0,0.06)'}} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
    {tmpl.id!=='vibrant-wellness'&&tmpl.id!=='modern-minimal'&&<div className="pointer-events-none mb-2 h-0.5 w-10 rounded-full" style={{backgroundColor:design.accentColor}}/>}
    {tmpl.id==='vibrant-wellness'&&<div className="pointer-events-none mb-2 h-1 w-12 rounded-full" style={{background:`linear-gradient(90deg, ${design.primaryColor}, ${design.accentColor})`}}/>}
    <div className={tmpl.id==='tri-fold'&&!isCover?'grid grid-cols-2 gap-3':''}>
     {contentElements.map((el)=>{
       const isFree=el.x!==undefined&&el.y!==undefined
       return (
        <div key={el.id} onClick={(e)=>{e.stopPropagation();onSelectElement(el.id)}} onPointerDown={(e)=>{e.stopPropagation();onSelectElement(el.id);handlePointerDown(e,el)}} style={isFree?{position:'absolute',left:el.x,top:el.y,width:el.width?`${el.width}px`:'auto',maxWidth:'calc(100% - 16px)',transform:el.rotation?`rotate(${el.rotation}deg)`:undefined,opacity:el.opacity??1,zIndex:selectedElementId===el.id?10:1}:{position:'relative'}}>
         <ElementView element={el} isSelected={selectedElementId===el.id} onSelect={()=>onSelectElement(el.id)} templateId={tmpl.id as BrochureTemplateId} accentColor={design.accentColor} primaryColor={design.primaryColor} isCover={isCover} isDarkPage={isDarkPage}/>
         {isFree&&selectedElementId===el.id&&(
          <>
           <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-sm border border-white bg-brand-600 shadow cursor-nwse-resize" onPointerDown={(e)=>handleResizeDown(e,el)}/>
           <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-white bg-gray-400"/>
          </>
         )}
        </div>
       )
     })}
    </div>
     {contentElements.length===0&&<div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed p-4 text-center" style={{borderColor:isDarkPage?'rgba(255,255,255,0.15)':'#e2e8f0',backgroundColor:isDarkPage?'rgba(255,255,255,0.03)':'rgba(248,250,252,0.5)'}}><p className="text-xs" style={{color:isDarkPage?'#64748b':'#94a3b8'}}>Drop elements here — drag to reposition</p></div>}
     {contentElements.length>0&&contentElements.some(el=>el.x==null)&&<div className="absolute inset-0 overflow-hidden pointer-events-none" style={{top:0,bottom:0,left:0,right:0}}/>}
   </div>
   <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-3" style={{height:'28px',backgroundColor:isDarkPage?(pageBg):tmpl.id==='modern-minimal'?'#ffffff':tmpl.id==='elegant-corporate'?'#1e293b':design.accentColor,borderTop:isDarkPage?'1px solid rgba(255,255,255,0.08)':tmpl.id==='modern-minimal'?'1px solid #e2e8f0':tmpl.id==='vibrant-wellness'?`2px solid ${design.primaryColor}`:undefined}}>
    <span className="text-center text-[7.5px] font-medium tracking-wide" style={{color:isDarkPage?'#94a3b8':tmpl.id==='modern-minimal'?'#64748b':tmpl.id==='elegant-corporate'?'#fde68a':'#334155'}}>{footerEl?.text||footerText||`Page ${page.pageNumber}`}</span>
   </div>
   <span className="absolute bottom-1 right-3 text-[7px] font-medium text-gray-400">{page.pageNumber}</span>
  </div>
 </div>
 )
}
function ElementView({element,isSelected,onSelect,templateId,accentColor,primaryColor,isCover,isDarkPage}:{element:BrochureElement;isSelected:boolean;onSelect:()=>void;templateId:BrochureTemplateId;accentColor:string;primaryColor:string;isCover:boolean;isDarkPage:boolean}){
 const {type,text,fontSize,fontWeight,textAlign,isClaim}=element
 const fs=Math.min(Math.max(fontSize||12,7),34)
 const fontStack=getFontStack(element.fontFamily)
  const baseStyle:React.CSSProperties={
   fontSize:`${fs}px`,
   fontWeight:FONT_WEIGHT_MAP[fontWeight||'normal'],
   fontStyle:fontWeight==='italic'?'italic':'normal',
   textAlign:(textAlign as any)||'left',
   cursor:'grab',
   marginTop:element.x===undefined?`${element.marginTop||4}px`:undefined,
   marginBottom:element.x===undefined?`${element.marginBottom||4}px`:undefined,
   opacity:element.opacity??(isSelected?0.9:1),
   outline:isSelected?`2px solid ${isClaim?'#ef4444':primaryColor}`:'none',
   outlineOffset:2,
   borderRadius:element.borderRadius!==undefined?element.borderRadius:(isSelected?4:undefined),
   fontFamily:(fontStack as any)||(templateId==='elegant-corporate'&&(type==='heading'||type==='subheading')?'ui-serif, Georgia, serif':undefined),
   color:element.color||undefined,
   backgroundColor:element.backgroundColor||undefined,
   letterSpacing:element.letterSpacing!==undefined?`${element.letterSpacing}px`:undefined,
   lineHeight:element.lineHeight||undefined,
   textTransform:element.textTransform||undefined,
   textDecoration:element.underline?'underline':undefined,
   boxShadow:element.shadow?'0 4px 12px rgba(0,0,0,0.12)':undefined,
   wordBreak:'break-word' as const,
   overflowWrap:'break-word' as const,
   maxWidth:element.x!==undefined&&element.width?`${element.width}px`:'100%',
   overflow:element.x!==undefined?'hidden':'visible',
   textOverflow:element.x!==undefined?'ellipsis':'clip',
  }
 const content=text?.trim()?text:getDefaultPlaceholder(type)
 switch(type){
  case 'heading':return <h1 style={{...baseStyle,fontSize:`${Math.min(fs+(isCover?4:0),32)}px`,lineHeight:1.15,letterSpacing:templateId==='modern-minimal'?'-0.02em':element.letterSpacing!==undefined?`${element.letterSpacing}px`:templateId==='elegant-corporate'?'-0.01em':undefined,color:element.color||(isDarkPage?'#ffffff':'#0f172a'),whiteSpace:element.x!=null?'normal':'nowrap' as const,overflow:element.x!=null?'hidden':'visible',textOverflow:element.x!=null?'ellipsis':'clip'}} onClick={onSelect} className="m-0 font-bold">{content}</h1>
  case 'subheading':return <h2 style={{...baseStyle,color:element.color||(isDarkPage?'#e2e8f0':primaryColor),fontSize:`${fs}px`,lineHeight:element.lineHeight||1.25,borderBottom:templateId==='clinical-blue'?`2px solid ${accentColor}30`:undefined,paddingBottom:templateId==='clinical-blue'?4:undefined,whiteSpace:element.x!=null?'normal':'nowrap' as const,overflow:element.x!=null?'hidden':'visible',textOverflow:element.x!=null?'ellipsis':'clip'}} onClick={onSelect} className="m-0 font-semibold">{content}</h2>
  case 'body':return <p style={{...baseStyle,color:element.color||(isDarkPage?'#cbd5e1':'#334155'),lineHeight:element.lineHeight||1.6,fontSize:`${Math.min(fs,11.5)}px`}} onClick={onSelect} className="m-0">{content}</p>
  case 'callout':return <div style={{...baseStyle,borderLeft:templateId==='vibrant-wellness'?`4px solid ${accentColor}`:`3px solid ${primaryColor}`,padding:templateId==='vibrant-wellness'?'10px 12px':'8px 12px',backgroundColor:element.backgroundColor||(isDarkPage?'#1e293b':templateId==='vibrant-wellness'?`${accentColor}12`:templateId==='modern-minimal'?'#f8fafc':templateId==='elegant-corporate'?'#fefce8':'rgba(59,130,246,0.06)'),borderRadius:element.borderRadius??(templateId==='vibrant-wellness'?12:templateId==='modern-minimal'?6:8),fontStyle:'italic',color:element.color||(isDarkPage?'#e2e8f0':'#1e293b'),boxShadow:element.shadow?'0 4px 12px rgba(0,0,0,0.15)':templateId==='clinical-blue'?'0 1px 3px rgba(0,0,0,0.06)':undefined,whiteSpace:'pre-wrap' as const}} onClick={onSelect} className="m-0 leading-snug">{content}</div>
  case 'list-item':return <div style={{...baseStyle,display:'flex',gap:'8px',alignItems:'flex-start',color:element.color||(isDarkPage?'#cbd5e1':'#334155')}} onClick={onSelect}><span className="mt-1 shrink-0 rounded-full" style={{width:templateId==='vibrant-wellness'?'10px':'7px',height:templateId==='vibrant-wellness'?'10px':'7px',backgroundColor:templateId==='vibrant-wellness'?accentColor:isDarkPage?'#06b6d4':primaryColor,marginTop:'6px'}}/><span style={{fontSize:`${Math.min(fs,11)}px`,lineHeight:element.lineHeight||1.5}}>{content}</span></div>
  case 'image-placeholder':{const {imageSrc,imageStatus}=element as any;const w=element.width|| (fontSize||120);if(imageSrc){return <div style={{...baseStyle,border:`1px solid ${isDarkPage?'rgba(255,255,255,0.1)':'#e2e8f0'}`,height:element.height?`${element.height}px`:`${fontSize||120}px`,width:w?`${w}px`:undefined,overflow:'hidden',borderRadius:element.borderRadius??(templateId==='vibrant-wellness'?14:templateId==='modern-minimal'?8:10),backgroundColor:element.backgroundColor||(isDarkPage?'#1e293b':'#f8fafc'),padding:0,boxShadow:element.shadow?'0 8px 20px rgba(0,0,0,0.12)':templateId==='vibrant-wellness'?'0 4px 14px rgba(0,0,0,0.08)':templateId==='clinical-blue'?'0 2px 8px rgba(0,0,0,0.06)':undefined,opacity:element.opacity??1}} onClick={onSelect}><img src={imageSrc} alt={text||(element as any).imagePrompt||'Generated illustration'} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} loading="lazy"/></div>}return <div style={{...baseStyle,border:templateId==='vibrant-wellness'?`2px dashed ${accentColor}60`:`2px dashed ${isDarkPage?'rgba(255,255,255,0.15)':'#cbd5e1'}`,height:`${fontSize||120}px`,width:w?`${w}px`:undefined,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',fontSize:'11px',color:element.color||(isDarkPage?'#64748b':'#94a3b8'),borderRadius:element.borderRadius??(templateId==='vibrant-wellness'?14:8),backgroundColor:element.backgroundColor||(isDarkPage?'#1e293b':templateId==='vibrant-wellness'?`${accentColor}08`:'#f8fafc'),opacity:element.opacity??1}} onClick={onSelect}><span className="text-base">{templateId==='vibrant-wellness'?'✦':templateId==='elegant-corporate'?'⬣':'◐'}</span><span className="text-[10px] font-medium tracking-wide">{imageStatus==='loading'?'Generating…':imageStatus==='error'?'Failed — retry':text||'Illustration'}</span></div>}
  case 'footer':return <span style={{...baseStyle,fontSize:'8px',color:element.color||(isDarkPage?'#64748b':'#64748b')}} onClick={onSelect}>{content}</span>
  default:return <p style={baseStyle} onClick={onSelect} className="m-0">{content}</p>
 }
}
function getDefaultPlaceholder(type:string):string{switch(type){case 'heading':return 'Untitled Heading';case 'subheading':return 'Section Heading';case 'body':return 'Body text…';case 'callout':return 'Important callout text';case 'list-item':return 'Bullet point text';case 'image-placeholder':return 'Illustration';case 'footer':return 'Footer text';default:return 'Edit text…'}}
