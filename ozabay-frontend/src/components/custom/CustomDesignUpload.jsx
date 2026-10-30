import { useRef, useState } from "react";
import { money } from "../../utils/formatCurrency.js";

export default function CustomDesignUpload({onConfirm}){
  const inputRef=useRef(null);
  const [stage,setStage]=useState("idle");
  const [fileName,setFileName]=useState("");
  const [previewUrl,setPreviewUrl]=useState(null);
  const [note,setNote]=useState("");
  const [dragOver,setDragOver]=useState(false);
  const [artisan,setArtisan]=useState(null);
  const [budget,setBudget]=useState(0);

  const ARTISANS=[
    {name:"Meera Joshi",craft:"Blue Pottery · Jaipur"},
    {name:"Raghav Sen",craft:"Metal Repoussé · Moradabad"},
    {name:"Ila Verma",craft:"Hand-block Textiles · Bhuj"},
    {name:"Devendra Patil",craft:"Terracotta · Pune"},
  ];

  const handleFile=file=>{
    if(!file||!file.type.startsWith("image/"))return;
    const reader=new FileReader();
    reader.onload=()=>{setPreviewUrl(reader.result);setFileName(file.name);setStage("preview")};
    reader.readAsDataURL(file);
  };
  const onInputChange=e=>handleFile(e.target.files?.[0]);
  const onDrop=e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files?.[0])};

  const submit=()=>{
    setStage("verifying");
    setTimeout(()=>{
      setStage("assigning");
      setArtisan(ARTISANS[Math.floor(Math.random()*ARTISANS.length)]);
      setTimeout(()=>{
        setStage("budget");
        setBudget(4200+Math.floor(Math.random()*2600));
        setTimeout(()=>setStage("done"),1300);
      },1500);
    },1600);
  };

  const reset=()=>{
    setStage("idle");setPreviewUrl(null);setFileName("");setNote("");setArtisan(null);setBudget(0);
    if(inputRef.current)inputRef.current.value="";
  };

  return <div className="design-upload">
    <div className="custom-preview-topline"><span><i/> UPLOAD YOUR DESIGN</span><small>Turn any reference into a made piece</small></div>
    <div className="custom-studio-flow custom-studio-flow--inside"><span><b>01</b> Upload</span><i>→</i><span><b>02</b> Verify</span><i>→</i><span><b>03</b> Artisan</span><i>→</i><span><b>04</b> Budget</span></div>
    {stage==="idle"&&(
      <div className={`design-upload__drop ${dragOver?"is-drag":""}`}
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={onDrop}
        onClick={()=>inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e=>e.key==="Enter"&&inputRef.current?.click()}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>
        <p>Upload a photo or sketch of your idea</p>
        <small>Drag & drop, or click to browse — JPG or PNG</small>
        <input ref={inputRef} type="file" accept="image/*" onChange={onInputChange} hidden/>
      </div>
    )}

    {stage==="preview"&&(
      <div className="design-upload__review">
        <div className="design-upload__thumb" style={{backgroundImage:`url(${previewUrl})`}}/>
        <p className="design-upload__filename">{fileName}</p>
        <textarea className="design-upload__note" rows="2" placeholder="Material, size, colour, occasion…" value={note} onChange={e=>setNote(e.target.value)}/>
        <div className="design-upload__actions">
          <button type="button" className="text-link" onClick={reset}>Change Image</button>
          <button type="button" className="hero-action" onClick={submit}>Submit for Review ↗</button>
        </div>
      </div>
    )}

    {(stage==="verifying"||stage==="assigning"||stage==="budget")&&(
      <div className="design-upload__status">
        <span className="design-upload__spinner"/>
        <p>{stage==="verifying"&&"Verifying your design…"}{stage==="assigning"&&"Matching you with an artisan…"}{stage==="budget"&&"Estimating your budget…"}</p>
        <div className="design-upload__trail">
          <i className={stage==="verifying"?"is-active":"is-done"}/>
          <i className={stage==="assigning"?"is-active":stage==="budget"?"is-done":""}/>
          <i className={stage==="budget"?"is-active":""}/>
        </div>
      </div>
    )}

    {stage==="done"&&(
      <div className="design-upload__done">
        <span className="design-upload__check"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>
        <p className="design-upload__done-title">Your request is ready for review</p>
        <div className="design-upload__result">
          <div><small>Artisan assigned</small><strong>{artisan?.name}</strong><em>{artisan?.craft}</em></div>
          <div><small>Estimated budget</small><strong>{money(budget)} – {money(budget+1800)}</strong></div>
        </div>
        <div className="design-upload__actions">
          <button type="button" className="text-link" onClick={reset}>Upload Another</button>
          <button type="button" className="hero-action" onClick={onConfirm}>Confirm & Start ↗</button>
        </div>
      </div>
    )}
  </div>
}
