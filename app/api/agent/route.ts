import { getChatGPTUser } from '../../chatgpt-auth';
export async function POST(){
  if(!await getChatGPTUser())return Response.json({error:'Sign in required.'},{status:401});
  // Deliberate server-side spending lock, independent of UI and environment keys.
  return Response.json({error:'Paid AI calls are disabled by the workspace owner. Policy checks and manual workflows remain available.'},{status:403});
}
