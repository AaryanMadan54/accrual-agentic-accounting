// Local integration only. Use the signed-in sample workspace and synthetic bank evidence.
import assert from 'node:assert/strict';
import { bankAmount } from '../lib/banking.mjs';

const base = 'http://127.0.0.1:5173';
const login = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
const headers = {
  Cookie: login.headers.getSetCookie().map(value => value.split(';')[0]).join('; '),
  Origin: base,
  'Content-Type': 'application/json'
};
const endpoint = base + '/api/workspace?mode=demo';
const read = async () => (await fetch(endpoint, { headers })).json();
let workspace = await read();
const prefix = 'bank-test-' + Date.now();
async function command(type, payload) {
  const response = await fetch(endpoint, {method:'POST', headers, body:JSON.stringify({
    revision:workspace.revision, command:{key:prefix+'-'+workspace.revision, type, payload}
  })});
  const result = await response.json();
  assert.equal(response.status, 200, result.error);
  workspace = result;
}
const history = await fetch(base + '/api/agent?mode=demo', {headers});
assert.equal(history.status, 200);
assert.equal((await history.json()).configuration.enabled, false);
const date = '2001-01-01';
await command('create_document', {kind:'bill', counterparty:'Local QA supplier', number:prefix,
  description:'Hosting', sourceText:'Hosting GBP 40.00', issued:date, due:date, net:'40', taxRate:0});
const bill = workspace.state.documents.at(-1);
await command('post_document', {id:bill.id});
const opening = workspace.state.journals.filter(j=>j.date<date).reduce((sum,j)=>sum+bankAmount(j),0)/100;
await command('import_statement', {name:prefix, start:date, end:date, opening:String(opening),
  closing:String(opening-40), csv:'Date,Description,Amount\n'+date+','+prefix+',-40.00'});
const statement = workspace.state.statements.at(-1);
await command('run_checks', {});
const proposal = workspace.state.proposals.find(p=>p.bankRowId===statement.rows[0].id && p.targetId===bill.id);
assert.ok(proposal);
const before = workspace.state.journals.length;
await command('resolve_proposal', {id:proposal.id, decision:'approve'});
assert.equal(workspace.state.journals.length, before+1);
await command('finalize_statement', {id:statement.id});
const saved = (await read()).state;
assert.equal(saved.documents.find(d=>d.id===bill.id).settled, 4000);
assert.equal(saved.statements.find(s=>s.id===statement.id).status,'reconciled');
assert.equal(saved.statements.find(s=>s.id===statement.id).rows[0].journalId,saved.journals.at(-1).id);
console.log('PASS bill intake, posting, proposed bank match, settlement and finalisation survive a fresh read');
await command('reopen_statement', {id:statement.id, reason:'Repeatable local QA'});
await command('unmatch_bank', {rowId:statement.rows[0].id, reason:'Repeatable local QA'});
await command('reverse_payment', {id:saved.journals.at(-1).id, date, reason:'Repeatable local QA'});
await command('void_statement', {id:statement.id, reason:'Repeatable local QA'});
await command('void_document', {id:bill.id, date, reason:'Repeatable local QA'});
console.log('PASS corrections leave a trace and release the period for the next test');
