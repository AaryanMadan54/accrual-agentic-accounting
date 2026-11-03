import { env } from 'cloudflare:workers';
import { readJSON } from '../../../lib/http';
import { getChatGPTUser } from '../../chatgpt-auth';
import { loadWorkspace, commitWorkspace } from '../../../lib/workspace';

export const dynamic='force-dynamic';
const reply=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function workspace(request:Request){const mode=new URL(request.url).searchParams.get('mode')??'live';if(!['demo','live'].includes(mode))throw new Error('Invalid workspace.');return mode;}
export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to open your accounting workspace.'},401);
  try{return reply({...await loadWorkspace(user.userId,workspace(request)),user:{name:user.displayName}});}
  catch(error:any){console.error('Workspace read failed',error.message);return reply({error:'Unable to load the books. Please retry.'},503);}
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to save changes.'},401);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin changes are not allowed.'},403);
  try {
    const body=await readJSON(request);if(!Number.isSafeInteger(body.revision)||!body.command?.key)throw new Error('Invalid request.');
    if(body.command.type==='create_document'&&body.command.payload?.sourceRunId){
      const run=await env.DB!.prepare('SELECT id,source,provider,model,created_at FROM agent_runs WHERE owner=? AND workspace=? AND id=? AND action=? AND status=?').bind(user.userId,workspace(request),body.command.payload.sourceRunId,'extract_bill','succeeded').first<any>();
      if(!run)throw new Error('Successful extraction not found in this workspace.');
      body.command.payload.sourceText=run.source;
      body.command.payload.extraction={runId:run.id,provider:run.provider,model:run.model,at:run.created_at};
    }else if(body.command.payload){delete body.command.payload.extraction;}
    return reply(await commitWorkspace(user.userId,workspace(request),body.revision,body.command,user.displayName));
  }catch(error:any){const conflict=error.message.startsWith('CONFLICT:');return reply({error:error.message.replace('CONFLICT: ','')},conflict?409:400);}
}
