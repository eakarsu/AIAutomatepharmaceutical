import React, { useEffect, useState } from 'react';
import AiResultSections from './AiResultSections';
const FEATURES=[["evidence-completeness", "Evidence completeness"], ["interaction-review", "Interaction-rule review (non-clinical)"], ["traceability-gaps", "Source traceability gaps"]];
export default function FeaturePackPanel() {
  const [tasks,setTasks]=useState([]); const [title,setTitle]=useState(''); const [q,setQ]=useState(''); const [ai,setAi]=useState(null); const [err,setErr]=useState('');
  const headers=()=>({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('token')||''}` });
  const load=async()=>{ try{ const r=await fetch('/api/tasks'+(q?`?q=${encodeURIComponent(q)}`:''),{headers:headers()}); if(r.ok) setTasks(await r.json()); }catch(e){ setErr(String(e)); } };
  useEffect(()=>{ load(); },[]);
  const create=async()=>{ const r=await fetch('/api/tasks',{method:'POST',headers:headers(),body:JSON.stringify({title})}); if(r.ok){ setTitle(''); load(); } else setErr('Task create failed'); };
  const toggle=async(t)=>{ await fetch('/api/tasks/'+t.id,{method:'PATCH',headers:headers(),body:JSON.stringify({status:t.status==='done'?'open':'done'})}); load(); };
  const runAi=async(id)=>{ const r=await fetch('/api/feature-ai/'+id,{method:'POST',headers:headers(),body:JSON.stringify({records:tasks})}); if(r.ok) setAi(await r.json()); else setErr('AI request failed'); };
  return (<div style={{padding:16}}><h2>Tasks, export & AI</h2>{err && <p role="alert">{err}</p>}
    <div><input aria-label="Search tasks" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search / filter tasks"/> <button onClick={load}>Search</button></div>
    <div style={{marginTop:8}}><input aria-label="New task title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="New task"/> <button onClick={create}>Create task</button></div>
    <ul>{tasks.map(t=><li key={t.id}>{t.title} — {t.status} ({t.priority}) <button onClick={()=>toggle(t)}>Toggle done</button></li>)}</ul>
    <p><a href="/api/evidence-cases/export?format=csv">Export CSV</a> {' '} <a href="/api/evidence-cases/export?format=json">Export JSON</a></p>
    <div>{FEATURES.map(([id,label])=><button key={id} onClick={()=>runAi(id)} style={{marginRight:6}}>{label}</button>)}</div>
    {ai && <div style={{marginTop:12}}><p>aiGenerated: {String(ai.aiGenerated)} {ai.aiGenerated?'':'— deterministic fallback (not AI-generated)'}{ai.fallbackReason?` — ${ai.fallbackReason}`:''}</p><AiResultSections data={ai.data}/></div>}
  </div>);
}
