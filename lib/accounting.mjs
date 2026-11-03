import { bankCommand, bankCandidates, bankRows, bankAmount, bankReport } from './banking.mjs';
export const ACCOUNTS = [
  ['1000','Bank','Asset'],['1100','Accounts receivable','Asset'],['1200','VAT recoverable','Asset'],
  ['1500','Equipment','Asset'],['2100','Accounts payable','Liability'],['2200','VAT payable','Liability'],
  ['3000','Owner capital','Equity'],['4000','Service revenue','Revenue'],
  ['5000','Software & subscriptions','Expense'],['5100','Professional services','Expense'],
  ['5200','Marketing','Expense'],['5300','Office & operations','Expense'],['5400','Travel','Expense'],
].map(([code,name,type])=>({code,name,type}));
export const today = () => new Date().toISOString().slice(0,10);
const id = prefix => `${prefix}_${crypto.randomUUID()}`;
const fail = message => { throw new Error(message); };
export function money(value, allowZero=false) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) fail('Enter a positive amount with no more than two decimal places.');
  const [whole, fraction=''] = raw.split('.');
  const n = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(n)||n>100000000000||(!allowZero&&n===0)) fail('Amount is outside the supported range.');
  return n;
}
export function date(value) {
  if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) fail('Enter a valid date.');
  return value;
}
function text(value, label, max=200) {
  if(typeof value!=='string'||!value.trim()||value.length>max) fail(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function openPeriod(state, value) {
  date(value);
  if(state.closedThrough && value<=state.closedThrough) fail(`The books are locked through ${state.closedThrough}.`);
  if(value>today()) fail('Future-dated postings are not supported in this release.');
}
export function validateLines(lines) {
  if(!Array.isArray(lines)||lines.length<2||lines.length>30) fail('A journal needs 2–30 lines.');
  let debit=0,credit=0;
  for(const l of lines){
    if(!ACCOUNTS.some(a=>a.code===l.account)) fail('Unknown ledger account.');
    if(!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0||l.debit>100000000000||l.credit>100000000000||((l.debit>0)===(l.credit>0))) fail('Each line must contain one positive debit or credit, in pennies.');
    debit+=l.debit; credit+=l.credit;
  }
  if(debit!==credit) fail('Journal debits and credits must balance.');
  return true;
}
function journal(state, entry) {
  openPeriod(state,entry.date); validateLines(entry.lines);
  if(entry.lines.some(l=>l.account==='1000') && (state.statements??[]).some(b=>b.status==='reconciled'&&entry.date<=b.end)) fail('Reopen the reconciled statement before changing its bank balance.');
  const j={id:id('JE'),...entry}; state.journals.push(j); return j;
}
const line=(account,debit=0,credit=0)=>({account,debit,credit});
export function documentLines(doc) {
  if(doc.kind==='invoice') return [line('1100',doc.total),line('4000',0,doc.net),...(doc.tax?[line('2200',0,doc.tax)]:[])];
  return [line(doc.account,doc.net),...(doc.tax?[line('1200',doc.tax)]:[]),line('2100',0,doc.total)];
}
function getDoc(state,docId){return state.documents.find(d=>d.id===docId)??fail('Document not found.');}
function duplicate(state,doc){return state.documents.find(d=>d.id!==doc.id&&d.kind===doc.kind&&d.status!=='void'&&d.number.toLowerCase()===doc.number.toLowerCase()&&d.counterparty.toLowerCase()===doc.counterparty.toLowerCase());}
function post(state,doc){
  if(doc.status!=='draft') fail('Only a draft can be posted.');
  if(duplicate(state,doc)) fail('Duplicate reference for this customer or supplier. Resolve it before posting.');
  const j=journal(state,{date:doc.issued,memo:`${doc.number} · ${doc.counterparty}`,sourceId:doc.id,kind:doc.kind,lines:documentLines(doc)});
  doc.status='posted';doc.journalId=j.id;
}
export function emptyState(companyName='Your company') {
  return {schema:2,companyName,closedThrough:null,documents:[],journals:[],proposals:[],audit:[],commands:[],lastRun:null,credits:[],statements:[],agentRuns:[]};
}
export function audit(state, action, actor, now=new Date().toISOString()) {
  state.audit.unshift({id:id('event'),action,actor,at:now});
}
function supplierReview(state, bill) {
  const comparable = state.documents.filter(other =>
    other.kind === 'bill' && ['posted', 'paid'].includes(other.status) &&
    other.counterparty.toLowerCase() === bill.counterparty.toLowerCase() &&
    other.account === bill.account && other.issued <= bill.issued
  ).sort((a, b) => b.issued.localeCompare(a.issued)).slice(0, 12);
  const notes = [];
  const similar = comparable.find(other =>
    other.total === bill.total && Date.parse(bill.issued) - Date.parse(other.issued) <= 7 * 86400000
  );
  if (similar) notes.push(`Check for a repeat charge. Bill ${similar.number} has the same gross amount and was issued on ${similar.issued}.`);
  if (comparable.length >= 3) {
    const sorted = comparable.map(other => other.net).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    if (bill.net >= 2 * median) {
      notes.push(`Net amount is at least twice this supplier's median of £${(median / 100).toFixed(2)} across ${sorted.length} previous bills in this account. Compare ${comparable.slice(0, 3).map(other => other.number).join(', ')}.`);
    }
  }
  return notes.join(' ');
}
export function pendingWork(state,asOf=today()) {
  const items=[];
  for(const doc of state.documents){
    if(doc.status==='void'||doc.status==='paid')continue;
    if(doc.status==='draft'&&doc.kind==='bill'){
      const dupe=duplicate(state,doc);
      const context=supplierReview(state,doc);
      items.push({id:`review:${doc.id}`,kind:dupe?'duplicate':'bill',documentId:doc.id,title:dupe?'Possible duplicate bill':'Review and post bill',subtitle:`${doc.counterparty} · ${doc.number}`,amount:doc.total,priority:dupe||context?'High':'Review',evidence:dupe?`Another active bill uses supplier ${doc.counterparty} and reference ${doc.number}. Posting is blocked.`:`Draft bill for ${doc.description}. Proposed account: ${ACCOUNTS.find(a=>a.code===doc.account)?.name}. ${context}`.trim(),supplierContext:context,source:'Policy check'});
    }
    if(doc.status==='posted'&&doc.kind==='invoice'&&doc.due<asOf){
      const days=Math.floor((Date.parse(asOf)-Date.parse(doc.due))/86400000);
      items.push({id:`collect:${doc.id}`,kind:'collection',documentId:doc.id,title:'Prepare a payment reminder',subtitle:`${doc.counterparty} · ${days} days overdue`,amount:outstanding(doc),priority:days>30?'High':'Follow up',evidence:`${doc.number} was due ${doc.due}. Outstanding balance comes from the posted invoice less recorded receipts and credits.`,source:'Policy check'});
    }
  }
  return items;
}
export function trialBalance(state,asOf='9999-12-31') {
  return ACCOUNTS.map(a=>{
    let debits=0,credits=0;
    for(const j of state.journals.filter(j=>j.date<=asOf)) for(const l of j.lines.filter(l=>l.account===a.code)){debits+=l.debit;credits+=l.credit;}
    const net=debits-credits;
    return {...a,debits,credits,debit:Math.max(net,0),credit:Math.max(-net,0),balance:net};
  });
}
export function assertBooks(state) {
  for(const j of state.journals)validateLines(j.lines);
  const tb=trialBalance(state), ar=tb.find(a=>a.code==='1100').balance,ap=-tb.find(a=>a.code==='2100').balance;
  const totalOutstanding=kind=>state.documents.filter(d=>d.kind===kind&&['posted','paid'].includes(d.status)).reduce((s,d)=>s+outstanding(d),0);
  if(ar!==totalOutstanding('invoice')||ap!==totalOutstanding('bill')) fail('Subledger does not reconcile to the general ledger.');
  for(const d of state.documents){
    if(!Number.isSafeInteger(d.settled)||d.settled<0||!Number.isSafeInteger(d.credited??0)||(d.credited??0)<0||outstanding(d)<0)fail('Invalid document balance.');
  }
  const linked=bankRows(state).filter(r=>r.journalId);
  if(new Set(linked.map(r=>r.journalId)).size!==linked.length)fail('A bank journal cannot be matched twice.');
  for(const r of linked){const j=state.journals.find(j=>j.id===r.journalId);if(!j||bankAmount(j)!==r.amount)fail('Bank transaction does not reconcile to its journal.');}
  return true;
}
export const outstanding = d => d.total-d.settled-(d.credited??0);
export function upgradeState(s){
  s.schema=2;s.credits??=[];s.statements??=[];s.agentRuns??=[];
  for(const d of s.documents)d.credited??=0;
  return s;
}
function documentBasis(d){return {number:d.number,total:d.total,settled:d.settled,status:d.status,account:d.account,credited:d.credited??0,issued:d.issued,due:d.due,counterparty:d.counterparty,description:d.description};}
export function proposalCurrent(s,x){
  if(x.kind==='bank')return bankCandidates(s,bankRows(s).find(r=>r.id===x.bankRowId)).some(c=>c.id===x.targetId&&c.kind===x.targetKind&&c.basis===x.targetBasis);
  const d=s.documents.find(d=>d.id===x.documentId);
  if(!d||!x.basis)return false;
  if(x.supplierContext!==undefined && x.supplierContext!==supplierReview(s,d))return false;
  if(x.kind==='duplicate' && !duplicate(s,d))return false;
  if(x.kind==='bill' && duplicate(s,d))return false;
  const current=documentBasis(d);
  return Object.keys(x.basis).every(key=>current[key]===x.basis[key]);
}
function documentDate(s,d,on){
  const latest=s.journals.filter(j=>j.sourceId===d.id).reduce((last,j)=>j.date>last?j.date:last,d.issued);
  if(on<latest)fail('This document has later accounting activity. Use a correction date on or after '+latest+'.');
}
function settle(s,d,p){
  if(d.status!=='posted')fail('Only an open posted document can be settled.');
  const amount=money(p.amount);if(amount>outstanding(d))fail('Payment exceeds the outstanding balance.');
  const on=date(p.date);if(on<d.issued)fail('Payment date cannot precede the issue date.');
  documentDate(s,d,on);
  const receipt=d.kind==='invoice';
  const j=journal(s,{date:on,memo:`${receipt?'Receipt':'Payment'} · ${d.number} · ${text(p.reference,'Payment reference',120)}`,sourceId:d.id,kind:receipt?'receipt':'payment',lines:receipt?[line('1000',amount),line('1100',0,amount)]:[line('2100',amount),line('1000',0,amount)]});
  d.settled+=amount;if(outstanding(d)===0)d.status='paid';return j;
}
export function agedBalances(state,kind,asOf=today()) {
  date(asOf);
  const control=kind==='invoice'?'1100':'2100';
  return state.documents.filter(d=>d.kind===kind).map(d=>{
    const amount=state.journals.filter(j=>j.sourceId===d.id&&j.date<=asOf).flatMap(j=>j.lines).filter(l=>l.account===control).reduce((n,l)=>n+(kind==='invoice'?l.debit-l.credit:l.credit-l.debit),0);
    return {...d,amount,days:Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(d.due))/86400000))};
  }).filter(d=>d.amount>0);
}
export function applyCommand(previous,command,actor='You',now=new Date().toISOString()) {
  if(!command||typeof command!=='object')fail('Invalid command.');
  text(command.key,'Request ID',100);
  if(previous.commands.includes(command.key))return previous;
  const s=upgradeState(structuredClone(previous)), p=command.payload??{}; let label='';
  switch(command.type){
    case 'create_document': {
      if(!['invoice','bill'].includes(p.kind))fail('Choose invoice or bill.');
      if(p.currency && p.currency!=='GBP')fail('This workspace supports GBP only.');
      const net=money(p.net),rate=Number(p.taxRate??0);
      if(![0,5,20].includes(rate))fail('Supported VAT rates are 0%, 5%, and 20%.');
      const tax=Math.round(net*rate/100),issued=date(p.issued),due=date(p.due);
      if(due<issued)fail('Due date cannot precede the issue date.');
      const account=p.kind==='invoice'?'4000':String(p.account??'5000');
      if(p.kind==='bill'&&!ACCOUNTS.some(a=>a.code===account&&a.type==='Expense'))fail('Choose a valid expense account.');
      const d={id:id('doc'),kind:p.kind,number:text(p.number,'Reference',80),counterparty:text(p.counterparty,'Customer or supplier',120),email:typeof p.email==='string'?p.email.slice(0,200):'',partyAddress:typeof p.partyAddress==='string'?p.partyAddress.slice(0,500):'',description:text(p.description,'Description',500),issued,due,net,tax,taxRate:rate,total:net+tax,account,status:'draft',settled:0,sourceText:typeof p.sourceText==='string'?p.sourceText.slice(0,12000):'',createdAt:now};
      if(p.extraction)d.extraction=p.extraction;
      s.documents.push(d);label=`Created ${d.kind} ${d.number}`;break;
    }
    case 'edit_document': {
      const d=getDoc(s,p.id); if(d.status!=='draft')fail('Posted documents are immutable; use a reversal.');
      const update={...d,net:(d.net/100).toFixed(2),...p,kind:d.kind};
      const staged=applyCommand(emptyState(),{key:'draft-validation',type:'create_document',payload:update},actor,now).documents[0];
      Object.assign(d,staged,{id:d.id,createdAt:d.createdAt});
      label=`Updated draft ${d.number}`;break;
    }
    case 'post_document': {const d=getDoc(s,p.id);post(s,d);label=`Approved and posted ${d.number}`;break;}
    case 'settle_document': {
      const d=getDoc(s,p.id);settle(s,d,p);label=`Recorded ${d.kind==='invoice'?'receipt':'payment'} for ${d.number}`;break;
    }
    case 'void_document': {
      const d=getDoc(s,p.id);if(d.status==='void')fail('Document is already void.');if(d.settled||d.credited)fail('Settled or credited documents cannot be voided. Reverse payments or credits first.');
      const reason=text(p.reason,'Reversal reason',250);
      if(d.status==='posted'){
        const j=s.journals.find(j=>j.id===d.journalId);const on=date(p.date);if(on<d.issued)fail('Reversal cannot precede the original entry.');
        journal(s,{date:on,memo:`Reversal · ${d.number} · ${reason}`,sourceId:d.id,kind:'reversal',reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});
      }
      d.status='void';label=`Voided ${d.number}: ${reason}`;break;
    }
    case 'reverse_payment': {
      const j=s.journals.find(j=>j.id===p.id);
      if(!j||!['receipt','payment'].includes(j.kind))fail('Select an original receipt or payment.');
      if(s.journals.some(r=>r.reverses===j.id))fail('Payment has already been reversed.');
      if(bankRows(s).some(r=>r.journalId===j.id))fail('Unmatch the bank transaction before reversing this payment.');
      const d=getDoc(s,j.sourceId),on=date(p.date);
      if(on<j.date)fail('Reversal cannot precede the payment.');
      documentDate(s,d,on);
      const reason=text(p.reason,'Correction reason',250);
      journal(s,{date:on,memo:`Payment correction · ${d.number} · ${reason}`,sourceId:d.id,kind:'payment_reversal',reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});
      d.settled-=Math.abs(bankAmount(j));d.status='posted';label=`Reversed payment for ${d.number}: ${reason}`;break;
    }
    case 'credit_note': {
      const d=getDoc(s,p.id);if(d.status!=='posted')fail('Credit notes in this release apply to an outstanding invoice or bill.');
      const net=money(p.net),tax=Math.round(net*d.taxRate/100),total=net+tax;
      if(total>outstanding(d))fail('Credit exceeds the outstanding balance. Cash refunds are not supported here.');
      const existing=s.credits.filter(c=>c.documentId===d.id&&!c.reversedAt);
      if(net>d.net-existing.reduce((n,c)=>n+c.net,0)||tax>d.tax-existing.reduce((n,c)=>n+c.tax,0))fail('Credit exceeds the original net or VAT amount.');
      const on=date(p.date);if(on<d.issued)fail('Credit date cannot precede the original document.');
      documentDate(s,d,on);
      const number=text(p.number,'Credit note reference',80),reason=text(p.reason,'Credit reason',250);
      if(s.credits.some(c=>c.number.toLowerCase()===number.toLowerCase()&&c.kind===d.kind&&c.counterparty.toLowerCase()===d.counterparty.toLowerCase()))fail('Duplicate credit note reference.');
      const credit={id:id('credit'),documentId:d.id,number,reason,date:on,net,tax,total,taxRate:d.taxRate,kind:d.kind,counterparty:d.counterparty,createdAt:now};
      const j=journal(s,{date:on,memo:`Credit ${number} · ${d.number} · ${reason}`,sourceId:d.id,creditId:credit.id,kind:'credit_note',lines:documentLines({...d,net,tax,total}).map(l=>line(l.account,l.credit,l.debit))});
      credit.journalId=j.id;s.credits.push(credit);d.credited+=total;if(outstanding(d)===0)d.status='paid';label=`Posted credit note ${number} against ${d.number}`;break;
    }
    case 'reverse_credit': {
      const c=s.credits.find(c=>c.id===p.id);if(!c||c.reversedAt)fail('Credit note is missing or already reversed.');
      const on=date(p.date);if(on<c.date)fail('Reversal cannot precede the credit note.');
      const j=s.journals.find(j=>j.id===c.journalId),d=getDoc(s,c.documentId);documentDate(s,d,on);
      journal(s,{date:on,memo:`Reverse credit ${c.number} · ${text(p.reason,'Reason',250)}`,sourceId:d.id,creditId:c.id,kind:'credit_reversal',reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});
      c.reversedAt=now;d.credited-=c.total;d.status='posted';label=`Reversed credit note ${c.number}`;break;
    }
    case 'journal': {
      if(!Array.isArray(p.lines))fail('Journal lines are required.');
      // Control accounts are posted only by their subledgers.
      if(p.lines.some(l=>['1100','2100'].includes(l.account)))fail('Use invoices or bills to post to AR/AP control accounts.');
      const lines=p.lines.map(l=>({account:l.account,debit:money(l.debit||'0',true),credit:money(l.credit||'0',true)}));
      journal(s,{date:date(p.date),memo:text(p.memo,'Journal description',250),kind:'manual',sourceId:null,lines});label=`Posted journal: ${p.memo}`;break;
    }
    case 'reverse_journal': {
      const j=s.journals.find(j=>j.id===p.id);if(!j||!['manual','bank_entry'].includes(j.kind))fail('Use the source document to reverse subledger entries.');
      if(bankRows(s).some(r=>r.journalId===j.id))fail('Unmatch the bank transaction before reversing this journal.');
      if(s.journals.some(r=>r.reverses===j.id))fail('Journal has already been reversed.');
      const on=date(p.date);if(on<j.date)fail('Reversal cannot precede the journal.');
      journal(s,{date:on,memo:`Reversal · ${j.memo} · ${text(p.reason,'Reason',250)}`,kind:'reversal',sourceId:null,reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});label='Reversed manual journal';break;
    }
    case 'run_checks': {
      for(const x of s.proposals.filter(x=>x.status==='pending')){if(!proposalCurrent(s,x))x.status='stale';}
      const work=pendingWork(s,now.slice(0,10));let count=0;
      for(const item of work){
        if(s.proposals.some(x=>x.workId===item.id&&['pending','approved'].includes(x.status)))continue;
        const d=getDoc(s,item.documentId);
        const draft=item.kind==='collection'?`Hello ${d.counterparty},\n\nA friendly reminder that invoice ${d.number}, due on ${d.due}, has an outstanding balance of £${((outstanding(d))/100).toFixed(2)}. Could you confirm when we can expect payment? If it has already been paid, please share the payment reference so we can reconcile our records.\n\nThank you,\n${s.companyName}`:null;
        s.proposals.push({...item,id:id('proposal'),workId:item.id,status:'pending',draft,createdAt:now,basis:documentBasis(d)});count++;
      }
      for(const row of bankRows(s).filter(r=>!r.journalId)){
        const candidates=bankCandidates(s,row);
        const strong=candidates.filter(c=>c.score>=90);
        if(strong.length!==1)continue;
        const c=strong[0],workId=`bank:${row.id}`;
        if(s.proposals.some(x=>x.workId===workId&&x.status==='pending'))continue;
        s.proposals.push({id:id('proposal'),workId,kind:'bank',bankRowId:row.id,targetId:c.id,targetKind:c.kind,targetBasis:c.basis,title:c.kind==='journal'?'Match recorded bank movement':'Record and match payment',subtitle:row.reference,amount:Math.abs(row.amount),priority:'Review',evidence:c.evidence,source:'Reconciliation rules',status:'pending',createdAt:now});count++;
      }
      s.agentRuns.unshift({id:id('run'),at:now,source:'Rules',proposals:count,documents:s.documents.length,bankRows:bankRows(s).length});
      s.lastRun=now;label=`Policy scan completed · ${count} new proposals`;break;
    }
    case 'resolve_proposal': {
      const x=s.proposals.find(x=>x.id===p.id);if(!x||x.status!=='pending')fail('This proposal has already been resolved.');
      if(p.decision==='dismiss'){x.status='dismissed';label=`Dismissed: ${x.title}`;break;}
      if(p.decision!=='approve')fail('Choose approve or dismiss.');
      if(!proposalCurrent(s,x))fail('The document changed or bank match is stale. Dismiss this proposal and run checks again.');
      if(x.kind==='bank'){label=bankCommand(s,'match_bank',{rowId:x.bankRowId,targetId:x.targetId,targetKind:x.targetKind},now,{journal,settle,id,text,line,openPeriod});x.status='executed';x.resolvedAt=now;break;}
      const d=getDoc(s,x.documentId);
      if(x.kind==='duplicate')fail('Duplicate bills cannot be approved. Correct or void the draft first.');
      if(x.kind==='bill'){post(s,d);x.status='executed';label=`Approved proposal and posted ${d.number}`;}
      else {x.draft=text(p.draft??x.draft,'Reminder draft',5000);x.status='approved';label=`Approved reminder draft for ${d.number} · not sent`;}
      x.resolvedAt=now;break;
    }
    case 'settings': {
      s.companyName=text(p.companyName,'Company name',120);
      for(const key of ['address','registrationNumber','vatNumber','paymentInstructions'])if(p[key]!==undefined)s[key]=String(p[key]).slice(0,1000);
      label='Updated company name';break;
    }
    case 'close_period': {
      const on=date(p.date);if(on>=today())fail('Lock periods through a date before today.');
      if(s.closedThrough&&on<=s.closedThrough)fail('A locked period cannot be reopened in this release.');
      if(s.statements.some(b=>b.start<=on&&b.status!=='reconciled'))fail('Reconcile imported statements in this period before locking it.');
      if(s.documents.some(d=>d.status==='draft'&&d.issued<=on))fail('Resolve drafts dated in this period before locking it.');
      assertBooks(s);s.closedThrough=on;label=`Locked books through ${on}`;break;
    }
    default:{label=bankCommand(s,command.type,p,now,{journal,settle,id,text,line,openPeriod});if(!label)fail('Unsupported action.');}
  }
  assertBooks(s);s.commands.push(command.key);audit(s,label,actor,now);return s;
}
export function demoState(asOf=today()) {
  let s=emptyState('Northstar Studio');
  const offset=n=>{const d=new Date(asOf+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  let seq=0;const run=(type,payload)=>{s=applyCommand(s,{key:`seed-${seq++}`,type,payload},'Sample data',asOf+'T09:00:00Z');};
  run('journal',{date:offset(-80),memo:'Opening capital',lines:[{account:'1000',debit:'85000'},{account:'3000',credit:'85000'}]});
  const docs=[
    ['invoice','INV-1042','Linear Labs','Brand strategy & launch',12500,-50,-20,'4000',true,0],
    ['invoice','INV-1043','Orbit Health','Platform design retainer',8400,-40,-10,'4000',true,4000],
    ['invoice','INV-1044','Forma Studio','October product partnership',18000,-12,18,'4000',true,0],
    ['invoice','INV-1045','Acme Ventures','Research sprint',6200,-8,22,'4000',true,0],
    ['invoice','INV-1041','Monogram','Website delivery',9600,-45,-15,'4000',true,11520],
    ['invoice','INV-1046','Fieldwork','Discovery workshop',3200,0,30,'4000',false,0],
    ['bill','F-2026-10','Figma','Design team subscription',450,-5,10,'5000',false,0],
    ['bill','AWS-1048','Amazon Web Services','Cloud hosting · October',1280,-7,7,'5000',false,0],
    ['bill','NS-902','North & South','Legal advisory',2400,-12,2,'5100',false,0],
    ['bill','MS-221','Mason & Co','Studio rent',3200,-10,5,'5300',true,0],
    ['bill','WEB-711','Webflow','Annual workspace subscription',960,-20,-5,'5000',true,1152],
  ];
  for(const [kind,number,counterparty,description,net,issued,due,account,posted,settled] of docs){
    run('create_document',{kind,number,counterparty,description,net:String(net),taxRate:20,issued:offset(issued),due:offset(due),account,email:'',sourceText:`SAMPLE DOCUMENT\n${counterparty}\n${number}\n${description}\nNet GBP ${net}\nVAT 20%\nDue ${offset(due)}`});
    const d=s.documents.at(-1);if(posted)run('post_document',{id:d.id});if(settled)run('settle_document',{id:d.id,amount:String(settled),date:offset(-1),reference:'Sample payment'});
  }
  run('run_checks',{});return s;
}
