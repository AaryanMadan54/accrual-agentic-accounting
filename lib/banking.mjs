import { money, date, today, ACCOUNTS, outstanding } from './accounting.mjs';
const fail = message => { throw new Error(message); };
export const bankAmount = j => j.lines.filter(l=>l.account==='1000').reduce((n,l)=>n+l.debit-l.credit,0);
export const bankRows = s => (s.statements??[]).filter(b=>b.status!=='void').flatMap(b=>b.rows);
export function signedMoney(value){
  const raw=String(value??'').trim();
  if(!/^-?\d{1,10}(\.\d{1,2})?$/.test(raw))fail('Use signed decimal GBP amounts, without currency symbols or thousands separators.');
  return (raw.startsWith('-')?-1:1)*money(raw.replace(/^-/,''),true);
}
export function parseCSV(raw, delimiter=','){
  if(typeof raw!=='string'||raw.length>200000)fail('CSV must be at most 200 KB.');
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  raw=raw.replace(/^\uFEFF/,'');
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quoted){if(ch==='"'){if(raw[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
    if(ch==='"'){if(cell||closed)fail('Malformed CSV quotes.');quoted=true;continue;}
    if(ch===delimiter){row.push(cell);cell='';closed=false;continue;}
    if(ch==='\n'||ch==='\r'){if(ch==='\r'&&raw[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;continue;}
    if(closed&&!/\s/.test(ch))fail('Unexpected text after a quoted CSV field.');
    if(!closed)cell+=ch;
  }
  if(quoted)fail('Unclosed CSV quote.');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
export function parseBankCSV(raw, options={}){
  const rows=parseCSV(raw,options.delimiter??','),headers=rows.shift()?.map(h=>h.trim())??[];
  const find=(name,aliases)=>options[name]!==undefined?headers.indexOf(options[name]):headers.findIndex(h=>aliases.includes(h.toLowerCase()));
  const columns={date:find('date',['date','transaction date','booking date']),reference:find('reference',['description','reference','details','narrative']),amount:find('amount',['amount','amount (gbp)','amount gbp']),debit:find('debit',['debit','money out','paid out']),credit:find('credit',['credit','money in','paid in'])};
  const currency=headers.findIndex(h=>h.toLowerCase()==='currency');
  if(columns.date<0||columns.reference<0||(columns.amount<0&&(columns.debit<0||columns.credit<0)))fail('Map Date and Description, plus either Amount or both Money in and Money out.');
  if(rows.length>500)fail('Import at most 500 transactions per statement.');
  return rows.map((cells,index)=>{
    if(cells.length!==headers.length)fail(`CSV row ${index+2} has a different number of columns.`);
    let on=cells[columns.date].trim();
    if(options.dateFormat&&options.dateFormat!=='ISO'){
      const parts=on.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(!parts)fail(`Row ${index+2}: use the selected date format.`);
      const [a,b,y]=parts.slice(1);on=`${y}-${(options.dateFormat==='US'?a:b).padStart(2,'0')}-${(options.dateFormat==='US'?b:a).padStart(2,'0')}`;
    }
    try{date(on);}catch{fail(`Row ${index+2}: invalid date. Choose ISO, UK, or US dates explicitly.`);}
    if(currency>=0&&cells[currency].trim().toUpperCase()!=='GBP')fail(`Row ${index+2}: only GBP statements are supported.`);
    let amount;
    if(columns.amount>=0)amount=signedMoney(cells[columns.amount]);
    else{
      const incoming=money(cells[columns.credit].trim()||'0',true),outgoing=money(cells[columns.debit].trim()||'0',true);
      if(incoming&&outgoing)fail(`Row ${index+2}: both debit and credit are populated.`);
      amount=incoming-outgoing;
    }
    if(!amount)fail(`Row ${index+2}: zero-value transactions are not imported.`);
    const reference=cells[columns.reference].trim();if(!reference||reference.length>250)fail(`Row ${index+2}: description must contain 1–250 characters.`);
    return {date:on,reference,amount,sourceRow:index+2,original:cells};
  });
}
function statementFor(s,row){return s.statements.find(b=>b.id===row.statementId);}
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function bankCandidates(s,row){
  if(!row||row.journalId)return [];
  const statement=statementFor(s,row);if(!statement||statement.status!=='open')return [];
  const first=s.statements.filter(b=>b.status!=='void').sort((a,b)=>a.start.localeCompare(b.start))[0];
  const used=new Set(bankRows(s).filter(r=>r.journalId).map(r=>r.journalId));
  const reversed=new Set(s.journals.filter(j=>j.reverses).map(j=>j.reverses));
  const candidates=[];
  for(const j of s.journals){
    if(used.has(j.id)||reversed.has(j.id)||j.date>statement.end||j.date<first.start||bankAmount(j)!==row.amount)continue;
    const difference=Math.abs(Date.parse(j.date)-Date.parse(row.date))/86400000;
    if(difference>45)continue;
    const d=s.documents.find(d=>d.id===j.sourceId);
    const reference=d&&normalize(row.reference).includes(normalize(d.number));
    candidates.push({id:j.id,kind:'journal',title:j.memo,amount:Math.abs(row.amount),date:j.date,score:reference?99:difference<=3?90:60,basis:JSON.stringify([j.id,row.amount]),evidence:`Existing ledger movement on ${j.date}, with the same signed amount. Matching links the statement evidence; it creates no new journal.`});
  }
  for(const d of s.documents){
    if(d.status!=='posted'||d.issued>row.date||(row.amount>0)!==(d.kind==='invoice')||Math.abs(row.amount)>outstanding(d))continue;
    if(s.journals.some(journal=>journal.sourceId===d.id && journal.date>row.date))continue;
    // Never propose a new settlement when the same source already has a compatible unmatched movement.
    if(candidates.some(c=>c.kind==='journal'&&s.journals.find(j=>j.id===c.id)?.sourceId===d.id))continue;
    const ref=normalize(row.reference).includes(normalize(d.number));
    const party=normalize(row.reference).includes(normalize(d.counterparty));
    const exact=Math.abs(row.amount)===outstanding(d);
    if(!ref&&!party&&!exact)continue;
    candidates.push({id:d.id,kind:'document',title:`${d.number} · ${d.counterparty}`,date:d.issued,amount:Math.abs(row.amount),score:ref?98:party&&exact?95:exact?70:55,basis:JSON.stringify([d.id,outstanding(d),d.status,d.number]),evidence:`${ref?'Reference matches. ':party?'Counterparty matches. ':''}${exact?'The amount clears the remaining balance.':'This is a partial payment.'} Approval records a ${d.kind==='invoice'?'receipt':'supplier payment'} and links it to the bank row.`});
  }
  return candidates.sort((a,b)=>b.score-a.score);
}
export function bankReport(s,statement){
  const statements=(s.statements??[]).filter(b=>b.status!=='void').sort((a,b)=>a.start.localeCompare(b.start));
  const first=statements[0];if(!first||!statement)return null;
  const movements=s.journals.filter(j=>j.date<=statement.end&&bankAmount(j)!==0);
  const openingLedger=s.journals.filter(j=>j.date<first.start).reduce((n,j)=>n+bankAmount(j),0);
  const cleared=new Set(bankRows(s).filter(r=>r.journalId&&r.date<=statement.end).map(r=>r.journalId));
  const outstandingItems=movements.filter(j=>j.date>=first.start&&!cleared.has(j.id));
  const outstandingAmount=outstandingItems.reduce((n,j)=>n+bankAmount(j),0);
  const ledger=movements.reduce((n,j)=>n+bankAmount(j),0);
  return {ledger,closing:statement.closing,openingDifference:openingLedger-first.opening,outstandingItems,outstandingAmount,adjusted:statement.closing+outstandingAmount,difference:ledger-statement.closing-outstandingAmount,unmatched:statement.rows.filter(r=>!r.journalId).length};
}
export function bankCommand(s,type,p,now,{journal,settle,id,text,line,openPeriod}){
  if(type==='import_statement'){
    if(p.currency&&p.currency!=='GBP')fail('Only GBP statements are supported.');
    const start=date(p.start),end=date(p.end);if(start>end||end>today())fail('Choose a valid statement period ending on or before today.');
    openPeriod(s,start);
    const current=s.statements.filter(b=>b.status!=='void').sort((a,b)=>a.start.localeCompare(b.start));
    if(current.some(b=>start<=b.end&&end>=b.start))fail('This statement overlaps an existing import. Void an incorrect import before replacing it.');
    if(current.length&&start<=current.at(-1).end)fail('Import statements in chronological order.');
    const opening=signedMoney(p.opening),closing=signedMoney(p.closing),rows=parseBankCSV(p.csv,p.mapping??{});
    if(current.length){const prior=current.at(-1);const next=new Date(prior.end+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);if(start!==next.toISOString().slice(0,10)||opening!==prior.closing)fail('Statements must be consecutive, with the previous closing balance as the next opening balance.');}
    if(rows.some(r=>r.date<start||r.date>end))fail('All rows must fall within the statement period.');
    if(opening+rows.reduce((n,r)=>n+r.amount,0)!==closing)fail('Opening balance plus imported movements does not equal closing balance. Check the file, signs, and balances.');
    const statement={id:id('statement'),name:text(p.name,'Statement name',120),start,end,opening,closing,status:'open',importedAt:now,sourceCSV:p.csv,rows};
    for(const r of rows){r.id=id('bank');r.statementId=statement.id;r.journalId=null;}
    s.statements.push(statement);return `Imported ${rows.length} bank transactions from ${statement.name}`;
  }
  if(['match_bank','categorize_bank','unmatch_bank'].includes(type)){
    const row=bankRows(s).find(r=>r.id===p.rowId);if(!row)fail('Bank transaction not found.');
    const statement=statementFor(s,row);if(statement.status!=='open')fail('Reopen the statement before changing its matches.');
    if(s.closedThrough&&row.date<=s.closedThrough)fail('This bank transaction is in a locked period.');
    if(type==='unmatch_bank'){if(!row.journalId)fail('This transaction is not matched.');const reason=text(p.reason,'Unmatch reason',250);row.unmatchedFrom=row.journalId;row.journalId=null;return `Unmatched ${row.reference}: ${reason}. Ledger entry preserved`;}
    if(row.journalId)fail('Bank transaction is already matched.');
    if(type==='match_bank'){
      const candidate=bankCandidates(s,row).find(c=>c.id===p.targetId&&c.kind===p.targetKind);
      if(!candidate||(p.basis&&p.basis!==candidate.basis))fail('The bank match is no longer valid. Refresh and review again.');
      if(candidate.kind==='journal')row.journalId=candidate.id;
      else{const d=s.documents.find(d=>d.id===candidate.id);row.journalId=settle(s,d,{amount:(Math.abs(row.amount)/100).toFixed(2),date:row.date,reference:row.reference.slice(0,120)}).id;}
    }else{
      const account=ACCOUNTS.find(a=>a.code===p.account);if(!account||['1000','1100','2100','1200','2200'].includes(account.code))fail('Select a non-control category account.');
      if((row.amount<0&&account.type==='Revenue')||(row.amount>0&&account.type==='Expense'))fail('Use a journal for refunds or reversing income/expenses.');
      const rate=Number(p.taxRate??0);if(![0,5,20].includes(rate)||(!['Expense','Revenue'].includes(account.type)&&rate!==0))fail('Select a supported VAT rate for an income or expense category.');
      const gross=Math.abs(row.amount),net=Math.round(gross*100/(100+rate)),tax=gross-net;
      const lines=row.amount<0?[line(account.code,net),...(tax?[line('1200',tax)]:[]),line('1000',0,gross)]:[line('1000',gross),line(account.code,0,net),...(tax?[line('2200',0,tax)]:[])];
      row.journalId=journal(s,{date:row.date,memo:`Bank · ${row.reference}`,kind:'bank_entry',sourceId:null,bankRowId:row.id,lines}).id;
    }
    row.matchedAt=now;return `Reconciled bank transaction: ${row.reference}`;
  }
  if(['finalize_statement','reopen_statement','void_statement'].includes(type)){
    const statement=s.statements.find(b=>b.id===p.id);if(!statement||statement.status==='void')fail('Statement not found.');
    if(type==='finalize_statement'){
      if(statement.status!=='open')fail('Statement is already reconciled.');
      if(s.statements.some(b=>b.end<statement.start&&b.status==='open'))fail('Reconcile earlier statements first.');
      const report=bankReport(s,statement);if(report.unmatched||report.difference||report.openingDifference)fail('Resolve unmatched bank rows and balance differences before finalising.');
      statement.status='reconciled';statement.reconciledAt=now;statement.report=report;return `Finalised bank reconciliation through ${statement.end}`;
    }
    const reason=text(p.reason,'Reason',250);openPeriod(s,statement.end);
    if(type==='reopen_statement'){
      if(statement.status!=='reconciled')fail('Only a reconciled statement can be reopened.');
      if(s.statements.some(b=>b.end>statement.end&&b.status==='reconciled'))fail('Reopen later reconciliations first.');
      statement.status='open';return `Reopened reconciliation ${statement.name}: ${reason}`;
    }
    if(statement.status!=='open'||statement.rows.some(r=>r.journalId))fail('Unmatch every row of an open statement before voiding the import.');
    if(s.statements.some(b=>b.status!=='void'&&b.start>statement.end))fail('Void later statements first.');
    statement.status='void';return `Voided statement import ${statement.name}: ${reason}`;
  }
  return null;
}
