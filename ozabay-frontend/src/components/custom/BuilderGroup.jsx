
export default function BuilderGroup({label,value,options,onChange}){return <div className="builder-group"><span>{label}</span><div>{options.map(o=><button key={o} type="button" className={value===o?"is-selected":""} onClick={()=>onChange(o)}>{o}</button>)}</div></div>}
