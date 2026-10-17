import { getChatGPTUser } from '../../chatgpt-auth';
export async function POST(){
  if(!await getChatGPTUser())return Response.json({error:'Sign in required.'},{status:401});
  // Deliberate server-side spending lock, independent of UI and environment keys.
  return Response.json({error:'Live AI is off. No model request was made. Rule-based reviews and manual accounting remain available.'},{status:403});
}
