import type { ExtractionConfig } from './ai';
export function aiConfiguration(env:Record<string,unknown>) {
  const provider=env.AI_PROVIDER==='groq'?'groq':env.AI_PROVIDER==='openai'?'openai':null;
  const key=provider==='groq'?env.GROQ_API_KEY:provider==='openai'?env.OPENAI_API_KEY:null;
  const model=typeof env.AI_MODEL==='string'?env.AI_MODEL:'';
  const enabled=env.AI_ENABLED==='true'&&env.AI_USAGE_APPROVED==='true'&&!!provider&&typeof key==='string'&&!!key.trim()&&!!model.trim();
  const configured=!!provider&&!!key&&!!model;
  const requested=Number(env.AI_DAILY_LIMIT??20);
  const dailyLimit=Number.isInteger(requested)&&requested>0?Math.min(requested,50):20;
  return {public:{enabled,configured,provider,model:configured?model:null,dailyLimit,reason:enabled?'Connected':!configured?'Provider setup required':'Usage is not enabled'},config:{provider:provider??'groq',key:typeof key==='string'?key:'',model,enabled} as ExtractionConfig};
}
