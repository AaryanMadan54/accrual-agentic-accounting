import { getChatGPTUser } from '../../chatgpt-auth';
import { loadWorkspace, commitWorkspace } from '../../../lib/workspace';

export const dynamic='force-dynamic';
const reply=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function workspace(request:Request){const mode=new URL(request.url).searchParams.get('mode')??'demo';if(!['demo','live'].includes(mode))throw new Error('Invalid workspace.');return mode;}
export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to open your accounting workspace.'},401);
  try{return reply({...await loadWorkspace(user.userId,workspace(request)),user:{name:user.displayName},aiEnabled:false});}
  catch(error:any){console.error('Workspace read failed',error.message);return reply({error:'Unable to load the books. Please retry.'},503);}
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to save changes.'},401);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin changes are not allowed.'},403);
  try {
    const raw=await request.text();if(raw.length>64000)return reply({error:'Request is too large.'},413);
    const body=JSON.parse(raw);if(!Number.isSafeInteger(body.revision)||!body.command?.key)throw new Error('Invalid request.');
    return reply(await commitWorkspace(user.userId,workspace(request),body.revision,body.command,user.displayName));
  }catch(error:any){const conflict=error.message.startsWith('CONFLICT:');return reply({error:error.message.replace('CONFLICT: ','')},conflict?409:400);}
}
