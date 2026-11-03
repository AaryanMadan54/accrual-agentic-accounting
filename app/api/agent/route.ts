import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { loadWorkspace } from '../../../lib/workspace';
import { aiConfiguration } from '../../../lib/ai-config';
import { extractBill, reviewBooks } from '../../../lib/ai';
import { readJSON } from '../../../lib/http';
import { trialBalance, proposalCurrent } from '../../../lib/accounting.mjs';
export const dynamic='force-dynamic';
const reply=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const getMode=(request:Request)=>{const mode=new URL(request.url).searchParams.get('mode')??'live';if(!['demo','live'].includes(mode))throw new Error('Invalid workspace.');return mode;};
export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in required.'},401);
  try{
    const mode=getMode(request),configuration=aiConfiguration(env as unknown as Record<string,unknown>).public;
    const rows=await env.DB!.prepare('SELECT id,action,status,provider,model,created_at,completed_at,output FROM agent_runs WHERE owner=? AND workspace=? ORDER BY created_at DESC LIMIT 20').bind(user.userId,mode).all();
    const runs=rows.results.map((row:any)=>({...row,output:row.output?JSON.parse(row.output):null}));
    return reply({configuration,runs});
  }catch{return reply({error:'Unable to load AI run history.'},503);}
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in required.'},401);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin requests are not allowed.'},403);
  const configuration=aiConfiguration(env as unknown as Record<string,unknown>);
  if(!configuration.public.enabled)return reply({error:'Live AI is not enabled. Configure a provider, server-side key, model, and approved usage plan. No model request was sent.',configuration:configuration.public},403);
  let runId='',mode='';let reserved=false;
  try{
    mode=getMode(request);const body=await readJSON(request,60000);
    if(!['extract_bill','review_books'].includes(body.action))throw new Error('Unsupported AI action.');
    if(typeof body.id!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(body.id))throw new Error('A stable request ID is required.');
    if(body.action==='extract_bill'&&(typeof body.source!=='string'||!body.source.trim()||body.source.length>12000))throw new Error('Provide 1–12,000 characters of source text.');
    runId=body.id;
    const input=JSON.stringify({action:body.action,source:body.source??'',revision:body.revision??null});
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const existing=await env.DB!.prepare('SELECT input_hash,status,output,created_at FROM agent_runs WHERE owner=? AND workspace=? AND id=?').bind(user.userId,mode,runId).first<any>();
    if(existing){
      if(existing.input_hash!==hash)return reply({error:'Request ID was already used for different input.'},409);
      if(existing.status==='succeeded')return reply({id:runId,status:'succeeded',output:JSON.parse(existing.output)});
      return reply({id:runId,status:existing.status,error:existing.status==='running'?'This request is already running. Check its history before submitting another.':'This request failed. Review its history before starting another.'},existing.status==='running'?202:409);
    }
    const current=await loadWorkspace(user.userId,mode);
    if(body.action==='review_books'&&body.revision!==current.revision)return reply({error:'The books changed. Refresh and run the review again.'},409);
    const actions=current.state.proposals.filter((p:any)=>p.status==='pending'&&proposalCurrent(current.state,p)).slice(0,100);
    const context=JSON.stringify({company:current.state.companyName,revision:current.revision,currency:'GBP',balancesInPennies:trialBalance(current.state),availableActions:actions.map((p:any)=>({id:p.id,title:p.title,evidence:p.evidence,amountInPennies:p.amount,source:p.source})),documentsCount:current.state.documents.length});
    if(context.length>60000&&body.action==='review_books')throw new Error('The review is too large. Resolve some proposals first.');
    const now=new Date().toISOString(),cutoff=new Date(Date.now()-86400000).toISOString();
    const inserted=await env.DB!.prepare('INSERT OR IGNORE INTO agent_runs (owner,workspace,id,action,input_hash,source,status,provider,model,created_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM agent_runs WHERE owner=? AND created_at>=?) < ?').bind(user.userId,mode,runId,body.action,hash,body.action==='extract_bill'?body.source:context,'running',configuration.config.provider,configuration.config.model,now,user.userId,cutoff,configuration.public.dailyLimit).run();
    if(!inserted.meta.changes)return reply({error:'The daily AI request allowance is exhausted, or this request is already reserved. No additional request was sent.'},429);
    reserved=true;
    const result=body.action==='extract_bill'?await extractBill(body.source,configuration.config):await reviewBooks(context,actions.map((p:any)=>p.id),configuration.config);
    const output={...result,provider:configuration.config.provider,model:configuration.config.model,at:now,action:body.action,revision:current.revision};
    await env.DB!.prepare('UPDATE agent_runs SET status=?,output=?,completed_at=? WHERE owner=? AND workspace=? AND id=?').bind('succeeded',JSON.stringify(output),new Date().toISOString(),user.userId,mode,runId).run();
    return reply({id:runId,status:'succeeded',output});
  }catch(error:any){
    if(reserved)try{await env.DB!.prepare('UPDATE agent_runs SET status=?,output=?,completed_at=? WHERE owner=? AND workspace=? AND id=?').bind('failed',JSON.stringify({error:'The model request did not complete successfully. No accounting records were changed.'}),new Date().toISOString(),user.userId,mode,runId).run();}catch{}
    return reply({error:reserved?'AI could not complete this request. No accounting records were changed. Check run history before retrying.':error.message},reserved?502:400);
  }
}
