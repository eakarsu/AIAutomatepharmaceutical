import React from 'react';
export function AiResultSections({ data }) {
  if (data === null || data === undefined) return <div><strong>Result:</strong> (empty)</div>;
  const render = (v) => v === false ? 'false' : v === 0 ? '0' : v === '' ? '(empty)' : v === null || v === undefined ? '(empty)' : String(v);
  if (typeof data !== 'object') return <p>{render(data)}</p>;
  return (<div>{Object.entries(data).map(([k, v]) => (<section key={k} style={{marginBottom:8}}><h4 style={{margin:'4px 0'}}>{k}</h4>{Array.isArray(v) ? (v.length ? <ul>{v.map((x,i)=><li key={i}>{typeof x==='object'?<AiResultSections data={x}/>:render(x)}</li>)}</ul> : <p>(empty)</p>) : (v && typeof v === 'object' ? <AiResultSections data={v}/> : <p>{render(v)}</p>)}</section>))}</div>);
}
export default AiResultSections;
