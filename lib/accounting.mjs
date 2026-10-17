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
  return {schema:1,companyName,closedThrough:null,documents:[],journals:[],proposals:[],audit:[],commands:[],lastRun:null};
}
export function audit(state, action, actor, now=new Date().toISOString()) {
  state.audit.unshift({id:id('event'),action,actor,at:now});
}
export function pendingWork(state,asOf=today()) {
  const items=[];
  for(const doc of state.documents){
    if(doc.status==='void'||doc.status==='paid')continue;
    if(doc.status==='draft'&&doc.kind==='bill'){
      const dupe=duplicate(state,doc);
      items.push({id:`review:${doc.id}`,kind:dupe?'duplicate':'bill',documentId:doc.id,title:dupe?'Possible duplicate bill':'Review and post bill',subtitle:`${doc.counterparty} · ${doc.number}`,amount:doc.total,priority:dupe?'High':'Review',evidence:dupe?`Another active bill uses supplier ${doc.counterparty} and reference ${doc.number}. Posting is blocked.`:`Draft bill for ${doc.description}. Proposed account: ${ACCOUNTS.find(a=>a.code===doc.account)?.name}.`,source:'Policy check'});
    }
    if(doc.status==='posted'&&doc.kind==='invoice'&&doc.due<asOf){
      const days=Math.floor((Date.parse(asOf)-Date.parse(doc.due))/86400000);
      items.push({id:`collect:${doc.id}`,kind:'collection',documentId:doc.id,title:'Prepare a payment reminder',subtitle:`${doc.counterparty} · ${days} days overdue`,amount:doc.total-doc.settled,priority:days>30?'High':'Follow up',evidence:`${doc.number} was due ${doc.due}. Outstanding balance comes from the posted invoice less recorded receipts.`,source:'Policy check'});
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
  const outstanding=kind=>state.documents.filter(d=>d.kind===kind&&['posted','paid'].includes(d.status)).reduce((s,d)=>s+d.total-d.settled,0);
  if(ar!==outstanding('invoice')||ap!==outstanding('bill')) fail('Subledger does not reconcile to the general ledger.');
  return true;
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
  const s=structuredClone(previous), p=command.payload??{}; let label='';
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
      const d={id:id('doc'),kind:p.kind,number:text(p.number,'Reference',80),counterparty:text(p.counterparty,'Customer or supplier',120),email:typeof p.email==='string'?p.email.slice(0,200):'',description:text(p.description,'Description',500),issued,due,net,tax,taxRate:rate,total:net+tax,account,status:'draft',settled:0,sourceText:typeof p.sourceText==='string'?p.sourceText.slice(0,12000):'',createdAt:now};
      s.documents.push(d);label=`Created ${d.kind} ${d.number}`;break;
    }
    case 'edit_document': {
      const d=getDoc(s,p.id); if(d.status!=='draft')fail('Posted documents are immutable; use a reversal.');
      if(p.account && d.kind==='bill'){
        if(!ACCOUNTS.some(a=>a.code===p.account&&a.type==='Expense'))fail('Choose an expense account.');d.account=p.account;
      }
      if(p.number)d.number=text(p.number,'Reference',80);
      label=`Updated draft ${d.number}`;break;
    }
    case 'post_document': {const d=getDoc(s,p.id);post(s,d);label=`Approved and posted ${d.number}`;break;}
    case 'settle_document': {
      const d=getDoc(s,p.id);if(d.status!=='posted')fail('Only an open posted document can be settled.');
      const amount=money(p.amount);if(amount>d.total-d.settled)fail('Payment exceeds the outstanding balance.');
      const on=date(p.date);if(on<d.issued)fail('Payment date cannot precede the issue date.');
      const receipt=d.kind==='invoice';
      journal(s,{date:on,memo:`${receipt?'Receipt':'Payment'} · ${d.number} · ${text(p.reference,'Payment reference',120)}`,sourceId:d.id,kind:receipt?'receipt':'payment',lines:receipt?[line('1000',amount),line('1100',0,amount)]:[line('2100',amount),line('1000',0,amount)]});
      d.settled+=amount;if(d.settled===d.total)d.status='paid';label=`Recorded ${receipt?'receipt':'payment'} for ${d.number}`;break;
    }
    case 'void_document': {
      const d=getDoc(s,p.id);if(d.status==='void')fail('Document is already void.');if(d.settled)fail('Settled documents cannot be voided in this release.');
      const reason=text(p.reason,'Reversal reason',250);
      if(d.status==='posted'){
        const j=s.journals.find(j=>j.id===d.journalId);const on=date(p.date);if(on<d.issued)fail('Reversal cannot precede the original entry.');
        journal(s,{date:on,memo:`Reversal · ${d.number} · ${reason}`,sourceId:d.id,kind:'reversal',reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});
      }
      d.status='void';label=`Voided ${d.number}: ${reason}`;break;
    }
    case 'journal': {
      if(!Array.isArray(p.lines))fail('Journal lines are required.');
      // Control accounts are posted only by their subledgers.
      if(p.lines.some(l=>['1100','2100'].includes(l.account)))fail('Use invoices or bills to post to AR/AP control accounts.');
      const lines=p.lines.map(l=>({account:l.account,debit:money(l.debit||'0',true),credit:money(l.credit||'0',true)}));
      journal(s,{date:date(p.date),memo:text(p.memo,'Journal description',250),kind:'manual',sourceId:null,lines});label=`Posted journal: ${p.memo}`;break;
    }
    case 'reverse_journal': {
      const j=s.journals.find(j=>j.id===p.id);if(!j||j.kind!=='manual')fail('Only manual journals can be reversed here. Use the source document for subledger entries.');
      if(s.journals.some(r=>r.reverses===j.id))fail('Journal has already been reversed.');
      const on=date(p.date);if(on<j.date)fail('Reversal cannot precede the journal.');
      journal(s,{date:on,memo:`Reversal · ${j.memo} · ${text(p.reason,'Reason',250)}`,kind:'reversal',sourceId:null,reverses:j.id,lines:j.lines.map(l=>line(l.account,l.credit,l.debit))});label='Reversed manual journal';break;
    }
    case 'run_checks': {
      const work=pendingWork(s,now.slice(0,10));let count=0;
      for(const item of work){
        if(s.proposals.some(x=>x.workId===item.id&&x.status!=='dismissed'))continue;
        const d=getDoc(s,item.documentId);
        const draft=item.kind==='collection'?`Hello ${d.counterparty},\n\nA friendly reminder that invoice ${d.number}, due on ${d.due}, has an outstanding balance of £${((d.total-d.settled)/100).toFixed(2)}. Could you confirm when we can expect payment? If it has already been paid, please share the payment reference so we can reconcile our records.\n\nThank you,\n${s.companyName}`:null;
        s.proposals.push({...item,id:id('proposal'),workId:item.id,status:'pending',draft,createdAt:now,basis:{number:d.number,total:d.total,settled:d.settled,status:d.status,account:d.account}});count++;
      }
      s.lastRun=now;label=`Policy scan completed · ${count} new proposals`;break;
    }
    case 'resolve_proposal': {
      const x=s.proposals.find(x=>x.id===p.id);if(!x||x.status!=='pending')fail('This proposal has already been resolved.');
      if(p.decision==='dismiss'){x.status='dismissed';label=`Dismissed: ${x.title}`;break;}
      if(p.decision!=='approve')fail('Choose approve or dismiss.');
      const d=getDoc(s,x.documentId);
      if(d.status!==x.basis.status||d.total!==x.basis.total||d.settled!==x.basis.settled||d.account!==x.basis.account||d.number!==x.basis.number)fail('The document changed. Dismiss this proposal and run checks again.');
      if(x.kind==='duplicate')fail('Duplicate bills cannot be approved. Correct or void the draft first.');
      if(x.kind==='bill'){post(s,d);x.status='executed';label=`Approved proposal and posted ${d.number}`;}
      else {x.draft=text(p.draft??x.draft,'Reminder draft',5000);x.status='approved';label=`Approved reminder draft for ${d.number} · not sent`;}
      x.resolvedAt=now;break;
    }
    case 'settings': {
      s.companyName=text(p.companyName,'Company name',120);label='Updated company name';break;
    }
    case 'close_period': {
      const on=date(p.date);if(on>=today())fail('Lock periods through a date before today.');
      if(s.closedThrough&&on<=s.closedThrough)fail('A locked period cannot be reopened in this release.');
      if(s.documents.some(d=>d.status==='draft'&&d.issued<=on))fail('Resolve drafts dated in this period before locking it.');
      assertBooks(s);s.closedThrough=on;label=`Locked books through ${on}`;break;
    }
    default:fail('Unsupported action.');
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
