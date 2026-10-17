import { env } from 'cloudflare:workers';
import { demoState, emptyState, applyCommand } from './accounting.mjs';

export async function loadWorkspace(owner: string, workspace: string) {
  const db = env.DB;
  if (!db) throw new Error('The workspace database is not configured.');
  const read = () => db.prepare('SELECT revision, state FROM workspace_revisions WHERE owner = ? AND workspace = ? ORDER BY revision DESC LIMIT 1').bind(owner,workspace).first<{revision:number,state:string}>();
  let row=await read();
  if(!row){
    const initial=workspace==='demo'?demoState():emptyState();
    await db.prepare('INSERT OR IGNORE INTO workspace_revisions (owner,workspace,revision,state,created_at) VALUES (?,?,?,?,?)').bind(owner,workspace,0,JSON.stringify(initial),new Date().toISOString()).run();
    row=await read();
  }
  if(!row)throw new Error('Unable to open the workspace.');
  return {revision:row.revision,state:JSON.parse(row.state)};
}
export async function commitWorkspace(owner:string, workspace:string, expectedRevision:number, command:any, actor:string) {
  const current=await loadWorkspace(owner,workspace);
  // Replayed requests succeed even when another request advanced the revision.
  if(current.state.commands.includes(command.key))return current;
  if(current.revision!==expectedRevision)throw new Error('CONFLICT: The books changed in another session. Refresh and review before trying again.');
  const state=applyCommand(current.state,command,actor);
  const serialized=JSON.stringify(state);
  if(serialized.length>1800000)throw new Error('This early-access workspace has reached its size limit. Export your records and contact the administrator.');
  try {
    await env.DB!.prepare('INSERT INTO workspace_revisions (owner,workspace,revision,state,created_at) VALUES (?,?,?,?,?)').bind(owner,workspace,current.revision+1,serialized,new Date().toISOString()).run();
  } catch(error:any){
    if(/UNIQUE|constraint/i.test(error.message))throw new Error('CONFLICT: Another action was saved first. Refresh and try again.');
    throw error;
  }
  return {revision:current.revision+1,state};
}
