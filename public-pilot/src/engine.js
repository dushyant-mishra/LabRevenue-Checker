/* LabRevenue Check — audit engine v3. No network calls, no LLM decisions. */
(function (root, make) { const api=make(); if(typeof module==='object' && module.exports)module.exports=api; if(root)root.LabAudit=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const REQUIRED={
  work:['work_id','job_id','customer_id','service_code','quantity','completed_date','billable'],
  rates:['customer_id','service_code','unit_rate','effective_from','effective_to'],
  invoices:['line_id','invoice_id','job_id','customer_id','service_code','quantity','unit_price','invoice_date','due_date','status'],
  payments:['payment_id','invoice_id','paid_amount','payment_date'],
  adjustments:['adjustment_id','invoice_id','adjustment_type','amount','adjustment_date','reason']
};
const FILES={work:'completed_work.csv',rates:'contract_rates.csv',invoices:'invoice_lines.csv',payments:'payments.csv',adjustments:'adjustments.csv'};
const OPTIONAL=new Set(['payments','adjustments']);
const ACTIVE=new Set(['issued','sent','paid','partial','partially_paid','overdue','open']);
const INACTIVE=new Set(['draft','void','canceled','cancelled']);
const TRUE=new Set(['yes','true','1','approved']);
const FALSE=new Set(['no','false','0','nonbillable','not billable']);
const dateOK=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return false;let [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;};
function cents(input){const s=String(input??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;let [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)&&n>=0?n:null;}
function qty(input){const s=String(input??'').trim();if(!/^\d+(?:\.\d{1,3})?$/.test(s))return null;let [a,b='']=s.split('.');const n=Number(a)*1000+Number(b.padEnd(3,'0'));return Number.isSafeInteger(n)&&n>0?n:null;}
const amount=(milli,price)=>Math.round(milli*price/1000);
const fmtMoney=c=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const fmtQty=m=>String(Number((m/1000).toFixed(3)));
const key=(...p)=>JSON.stringify(p);
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36).toUpperCase().padStart(7,'0');}
function parseCSV(input){
 const text=String(input??'').replace(/^\uFEFF/,'');if(!text.trim())throw Error('CSV is empty; include a header row.');
 let rows=[],row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else field+=c;}
  else if(closed){if(c===','){row.push(field);field='';closed=false;}else if(c==='\n'||c==='\r'){row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';closed=false;if(c==='\r'&&text[i+1]==='\n')i++;}else if(c!==' '&&c!=='\t')throw Error('Unexpected characters after closing quote.');}
  else if(c==='"'&&field===''){quoted=true;}
  else if(c==='"'){throw Error('Invalid quote inside an unquoted field.');}
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';if(c==='\r'&&text[i+1]==='\n')i++;}
  else field+=c;
 }
 if(quoted)throw Error('Unterminated quoted CSV field.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(!rows.length)throw Error('Header row is missing.');
 const headers=rows.shift().map(h=>h.trim());if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Duplicate or empty column headers.');
 const parsed=rows.map((values,i)=>{if(values.length!==headers.length)throw Error(`Row ${i+2} has ${values.length} fields; expected ${headers.length}.`);return {__row:i+2,...Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]))};});
 return {headers,rows:parsed};
}
function table(rows,name){return {headers:[...REQUIRED[name]],rows:rows.map((r,i)=>({__row:r.__row||i+2,...r}))};}
function audit(data,asOf='2026-11-22'){
 if(!dateOK(asOf))throw Error('Invalid audit date. Use YYYY-MM-DD.');
 const errors=[],warnings=[],input={},stats={};
 const paymentCoverage=Boolean(data.payments), adjustmentCoverage=Boolean(data.adjustments);
 const arCoverage=paymentCoverage&&adjustmentCoverage;
 for(const [kind,cols] of Object.entries(REQUIRED)){
  const t=data[kind];
  if(!t){if(!OPTIONAL.has(kind))errors.push(`${FILES[kind]} has not been uploaded.`);input[kind]=[];stats[kind]=0;continue;}
  if(!Array.isArray(t.headers)||!Array.isArray(t.rows)){errors.push(`${FILES[kind]} is not a parsed CSV file.`);continue;}
  const missing=cols.filter(k=>!t.headers.includes(k));if(missing.length)errors.push(`${FILES[kind]} missing: ${missing.join(', ')}.`);
  input[kind]=t.rows;stats[kind]=t.rows.length;
 }
 const reject=()=>({valid:false,errors,warnings,findings:[],summary:null,stats});
 if(errors.length)return reject();
 const work=[],rates=[],invoices=[],payments=[],adjustments=[];
 const skipped={nonbillable:0,futureWork:0,futureInvoices:0,futurePayments:0,futureAdjustments:0,inactiveInvoices:0};
 const seen={work:new Set(),invoices:new Set(),payments:new Set(),adjustments:new Set()};
 const err=(kind,r,msg)=>errors.push(`${FILES[kind]} row ${r.__row||'?'}: ${msg}`);
 for(const r of input.rates){
  const from=r.effective_from,to=r.effective_to||'9999-12-31',p=cents(r.unit_rate);
  if(!r.customer_id||!r.service_code||!dateOK(from)||!dateOK(to)||to<from||p===null)err('rates',r,'invalid customer, service, amount, or effective date range.');
  else rates.push({...r,from,to,rate:p});
 }
 for(const r of input.work){
  if(!r.work_id||seen.work.has(r.work_id)){err('work',r,'missing or duplicate work_id.');continue;}seen.work.add(r.work_id);
  const q=qty(r.quantity),flag=String(r.billable).toLowerCase();
  if(!r.job_id||!r.customer_id||!r.service_code||!dateOK(r.completed_date)||q===null||(!TRUE.has(flag)&&!FALSE.has(flag))){err('work',r,'invalid identity, quantity, date, or billable flag.');continue;}
  if(FALSE.has(flag)){skipped.nonbillable++;continue;}
  if(r.completed_date>asOf){skipped.futureWork++;continue;}
  work.push({...r,q});
 }
 for(const r of input.invoices){
  if(!r.line_id||seen.invoices.has(r.line_id)){err('invoices',r,'missing or duplicate line_id.');continue;}seen.invoices.add(r.line_id);
  const q=qty(r.quantity),p=cents(r.unit_price),status=String(r.status).toLowerCase();
  if(!r.invoice_id||!r.job_id||!r.customer_id||!r.service_code||q===null||p===null||!dateOK(r.invoice_date)||!dateOK(r.due_date)||r.due_date<r.invoice_date||(!ACTIVE.has(status)&&!INACTIVE.has(status))){err('invoices',r,'invalid invoice identity, quantity, price, date, or status.');continue;}
  if(INACTIVE.has(status)){skipped.inactiveInvoices++;continue;}
  if(r.invoice_date>asOf){skipped.futureInvoices++;continue;}
  invoices.push({...r,q,p,status});
 }
 for(const r of input.payments){
  if(!r.payment_id||seen.payments.has(r.payment_id)){err('payments',r,'missing or duplicate payment_id.');continue;}seen.payments.add(r.payment_id);
  const paid=cents(r.paid_amount);if(!r.invoice_id||paid===null||!dateOK(r.payment_date)){err('payments',r,'invalid invoice reference, amount or payment date.');continue;}
  if(r.payment_date>asOf){skipped.futurePayments++;continue;}payments.push({...r,paid});
 }
 for(const r of input.adjustments){
  if(!r.adjustment_id||seen.adjustments.has(r.adjustment_id)){err('adjustments',r,'missing or duplicate adjustment_id.');continue;}seen.adjustments.add(r.adjustment_id);
  const value=cents(r.amount),type=String(r.adjustment_type||'').toLowerCase();
  if(!r.invoice_id||value===null||!['credit','writeoff'].includes(type)||!dateOK(r.adjustment_date)){err('adjustments',r,'invalid invoice, amount, credit/writeoff type or date.');continue;}
  if(r.adjustment_date>asOf){skipped.futureAdjustments++;continue;}adjustments.push({...r,value,type});
 }
 if(!arCoverage)warnings.push('Past-due A/R assessment is disabled until both payments.csv and adjustments.csv are supplied, so credits or receipts are never silently assumed to be zero.');
 const invoiceMap=new Map(),identity=new Map();
 for(const inv of invoices){
  const prev=identity.get(inv.invoice_id);
  if(prev&&(prev.customer_id!==inv.customer_id||prev.invoice_date!==inv.invoice_date||prev.due_date!==inv.due_date||prev.status!==inv.status))errors.push(`Invoice ${inv.invoice_id} contains inconsistent customer, header dates or invoice status.`);
  identity.set(inv.invoice_id,inv);
  invoiceMap.set(inv.invoice_id,[...(invoiceMap.get(inv.invoice_id)||[]),inv]);
 }
 const orphanPayments=payments.filter(x=>!invoiceMap.has(x.invoice_id)),orphanAdjustments=adjustments.filter(x=>!invoiceMap.has(x.invoice_id));
 if(orphanPayments.length)warnings.push(`${orphanPayments.length} payment(s) refer to an invoice outside this export or period; these cannot be reconciled.`);
 if(orphanAdjustments.length)warnings.push(`${orphanAdjustments.length} credit/write-off record(s) refer to invoices outside this export or period.`);
 for(const p of payments){const inv=identity.get(p.invoice_id);if(inv&&p.payment_date<inv.invoice_date)warnings.push(`Payment ${p.payment_id} precedes invoice ${p.invoice_id}; verify prepayment allocation.`);}
 for(const adj of adjustments){const inv=identity.get(adj.invoice_id);if(inv&&adj.adjustment_date<inv.invoice_date)warnings.push(`Adjustment ${adj.adjustment_id} precedes invoice ${adj.invoice_id}.`);}
 if(errors.length)return reject();
 const workGroups=new Map(),invoiceGroups=new Map();
 for(const w of work){let k=key(w.job_id,w.customer_id,w.service_code);workGroups.set(k,[...(workGroups.get(k)||[]),w]);}
 for(const i of invoices){let k=key(i.job_id,i.customer_id,i.service_code);invoiceGroups.set(k,[...(invoiceGroups.get(k)||[]),i]);}
 const paidBy=new Map(),adjBy=new Map();
 for(const p of payments)paidBy.set(p.invoice_id,(paidBy.get(p.invoice_id)||0)+p.paid);
 for(const a of adjustments)adjBy.set(a.invoice_id,[...(adjBy.get(a.invoice_id)||[]),a]);
 let findings=[];
 const evidence=(kind,rows)=>rows.map(r=>({source:FILES[kind],row:r.__row,reference:r.work_id||r.line_id||r.payment_id||r.adjustment_id||r.service_code||'—'}));
 const add=(type,bucket,properties)=>{
  const k=key(type,properties.job_id||'',properties.customer_id||'',properties.service_code||'',properties.invoice_id||'',properties.line_id||'');
  findings.push({id:'LRC-'+hash(k),type,bucket,amountCents:null,formula:'',expectedCents:null,actualCents:null,workIds:[],evidence:[],...properties});
 };
 for(const [k,ws] of workGroups){
  const [job,customer,service]=JSON.parse(k),inv=invoiceGroups.get(k)||[];
  const wq=ws.reduce((s,r)=>s+r.q,0),iq=inv.reduce((s,r)=>s+r.q,0);
  const matchRates=ws.map(w=>rates.filter(r=>r.customer_id===customer&&r.service_code===service&&r.from<=w.completed_date&&r.to>=w.completed_date));
  const uniqueRates=new Set(matchRates.filter(m=>m.length===1).map(m=>m[0].rate));
  const valid=matchRates.every(m=>m.length===1)&&uniqueRates.size===1;
  const rate=valid?[...uniqueRates][0]:null;
  const base={job_id:job,customer_id:customer,service_code:service,invoice_id:[...new Set(inv.map(i=>i.invoice_id))].join(', '),workIds:ws.map(w=>w.work_id),evidence:[...evidence('work',ws),...evidence('invoices',inv)]};
  if(rate===null){
   add('RATE_UNVERIFIED','needs_evidence',{...base,title:'Contract rate cannot be verified',summary:'Missing, overlapping or changing effective rates for the recorded work.',recommendation:'Confirm the applicable rate schedule and date-specific allocation before billing.',evidence:[...base.evidence,...evidence('rates',rates.filter(r=>r.customer_id===customer&&r.service_code===service))]});
   continue;
  }
  if(wq>iq){const remaining=wq-iq;
   add('UNBILLED','potential_revenue',{...base,title:inv.length?'Partially invoiced completed work':'Completed work without a matching invoice',amountCents:amount(remaining,rate),expectedCents:amount(wq,rate),actualCents:amount(iq,rate),formula:`(${fmtQty(wq)} completed − ${fmtQty(iq)} invoiced) × ${fmtMoney(rate)}`,evidence:[...base.evidence,...evidence('rates',matchRates.map(x=>x[0]))],summary:`${fmtQty(remaining)} units of approved work do not appear on an active invoice in this snapshot.`,recommendation:'Check for bundled, prepaid, free-of-charge, delayed or separately invoiced work before issuing a supplemental invoice.'});
  }
  if(iq>wq){const extra=iq-wq;
   add('EXCESS_QUANTITY','customer_risk',{...base,title:'Invoice quantity exceeds completed work',amountCents:amount(extra,rate),expectedCents:amount(wq,rate),actualCents:amount(iq,rate),formula:`(${fmtQty(iq)} invoiced − ${fmtQty(wq)} completed) × ${fmtMoney(rate)}`,evidence:[...base.evidence,...evidence('rates',matchRates.map(x=>x[0]))],summary:`${fmtQty(extra)} invoiced units are not supported by the supplied approved-work records.`,recommendation:'Confirm whether other work records, approved repeats, or billing arrangements explain the difference.'});
  }
  for(const line of inv){if(line.p===rate)continue;const low=line.p<rate;
   add(low?'RATE_UNDER':'RATE_OVER',low?'potential_revenue':'customer_risk',{...base,invoice_id:line.invoice_id,line_id:line.line_id,title:low?'Invoice price below reference rate':'Invoice price above reference rate',amountCents:amount(line.q,Math.abs(rate-line.p)),expectedCents:amount(line.q,rate),actualCents:amount(line.q,line.p),formula:`${fmtQty(line.q)} units × (${fmtMoney(Math.max(rate,line.p))} − ${fmtMoney(Math.min(rate,line.p))})`,summary:`Invoice ${line.invoice_id} uses ${fmtMoney(line.p)} per unit; dated contract reference is ${fmtMoney(rate)}.`,recommendation:'Confirm approved amendments, discounts, credits and commercial exceptions before proposing a correction.',evidence:[...evidence('invoices',[line]),...evidence('rates',rates.filter(r=>r.customer_id===customer&&r.service_code===service&&r.from<=ws[0].completed_date&&r.to>=ws[0].completed_date))]});
  }
 }
 for(const [k,inv] of invoiceGroups){if(workGroups.has(k))continue;const [job,customer,service]=JSON.parse(k);
  add('NO_WORK_MATCH','needs_evidence',{job_id:job,customer_id:customer,service_code:service,invoice_id:[...new Set(inv.map(i=>i.invoice_id))].join(', '),title:'Invoice lacks supporting work in this export',summary:'No completed approved-work record matches this job, customer and service as of the audit date.',recommendation:'Confirm the work export is complete; check deposits, prepayments and services completed outside the audit period.',evidence:evidence('invoices',inv)});
 }
 // Unmatched financial transactions are their own review cases, never assumed to be recoveries.
 for(const p of orphanPayments){
  add('UNMATCHED_PAYMENT','needs_evidence',{invoice_id:p.invoice_id,title:'Payment has no matching invoice in the export',summary:`Payment ${p.payment_id} references invoice ${p.invoice_id}, but that invoice is absent or outside the audit snapshot.`,recommendation:'Obtain the full invoice register or confirm the receipt allocation before interpreting this payment.',evidence:evidence('payments',[p])});
 }
 for(const a of orphanAdjustments){
  add('UNMATCHED_ADJUSTMENT','needs_evidence',{invoice_id:a.invoice_id,title:'Credit or write-off has no matching invoice',summary:`Adjustment ${a.adjustment_id} references invoice ${a.invoice_id}, which cannot be matched in the provided invoice export.`,recommendation:'Verify the adjustment approval and obtain the related original invoice before reconciling balances.',evidence:evidence('adjustments',[a])});
 }
 for(const [id,lines] of invoiceMap){
  const gross=lines.reduce((s,l)=>s+amount(l.q,l.p),0),paid=paidBy.get(id)||0,adjs=adjBy.get(id)||[],credit=adjs.reduce((s,a)=>s+a.value,0),net=gross-credit,balance=net-paid,due=lines[0].due_date;
  if(credit>gross){add('CREDITS_EXCEED','needs_evidence',{invoice_id:id,customer_id:lines[0].customer_id,title:'Credits and write-offs exceed invoice total',summary:`${fmtMoney(credit)} of adjustments exceeds ${fmtMoney(gross)} of invoice charges.`,recommendation:'Verify credit memo posting and allocation before drawing a conclusion.',evidence:[...evidence('invoices',lines),...evidence('adjustments',adjs)]});continue;}
  if(arCoverage&&lines[0].status==='paid'&&balance>0){
   add('PAID_STATUS_MISMATCH','needs_evidence',{invoice_id:id,customer_id:lines[0].customer_id,title:'Invoice marked paid, but receipts do not reconcile',summary:`Invoice ${id} is marked paid while the provided payment allocations and adjustments leave ${fmtMoney(balance)} outstanding.`,recommendation:'Check missing allocations, unapplied receipts and status updates before pursuing collection.',evidence:[...evidence('invoices',lines),...evidence('payments',payments.filter(p=>p.invoice_id===id)),...evidence('adjustments',adjs)]});
  }
  if(arCoverage&&balance<0){add('OVERPAYMENT','needs_evidence',{invoice_id:id,customer_id:lines[0].customer_id,title:'Payments exceed adjusted invoice balance',amountCents:-balance,formula:`${fmtMoney(paid)} payments − (${fmtMoney(gross)} billed − ${fmtMoney(credit)} adjustments)`,summary:'This may be a prepayment, unapplied credit or incomplete exported invoice record.',recommendation:'Reconcile the full accounting ledger before requesting a refund.',evidence:[...evidence('invoices',lines),...evidence('payments',payments.filter(p=>p.invoice_id===id)),...evidence('adjustments',adjs)]});}
  if(arCoverage&&balance>0&&due<asOf&&lines[0].status!=='paid'){add('PAST_DUE','past_due',{invoice_id:id,customer_id:lines[0].customer_id,title:'Past-due adjusted receivable',amountCents:balance,expectedCents:net,actualCents:paid,formula:`${fmtMoney(gross)} invoiced − ${fmtMoney(credit)} approved adjustments − ${fmtMoney(paid)} received`,summary:`Invoice ${id} was due ${due}; adjusted unpaid balance is ${fmtMoney(balance)}.`,recommendation:'Check for unapplied receipts, pending disputes and off-ledger adjustments before contacting the customer.',evidence:[...evidence('invoices',lines),...evidence('payments',payments.filter(p=>p.invoice_id===id)),...evidence('adjustments',adjs)]});}
 }
 // Duplicate charges signal: never declare fraud or add to customer-risk dollar totals.
 for(const [k,lines] of invoiceGroups){
  const byFingerprint=new Map();for(const x of lines){const fp=key(x.qty,x.p);byFingerprint.set(fp,[...(byFingerprint.get(fp)||[]),x]);}
  for(const matches of byFingerprint.values())if(matches.length>1){
   add('POSSIBLE_DUPLICATE','needs_evidence',{job_id:matches[0].job_id,customer_id:matches[0].customer_id,service_code:matches[0].service_code,invoice_id:[...new Set(matches.map(x=>x.invoice_id))].join(', '),line_id:matches[0].line_id,title:'Repeated identical invoice line details',summary:`${matches.length} lines share the same job, service, quantity and unit price. This can be legitimate split billing.`,recommendation:'Review source work references, invoice IDs and billing policy for duplicate charges.',evidence:evidence('invoices',matches)});
  }
 }
 const order={potential_revenue:0,past_due:1,customer_risk:2,needs_evidence:3};findings.sort((a,b)=>order[a.bucket]-order[b.bucket]||(b.amountCents||0)-(a.amountCents||0)||a.id.localeCompare(b.id));
 const sum=b=>findings.filter(f=>f.bucket===b).reduce((s,f)=>s+(f.amountCents||0),0);
 const summary={potentialRevenueCents:sum('potential_revenue'),pastDueCents:arCoverage?sum('past_due'):null,arCoverage,paymentCoverage,adjustmentCoverage,customerRiskCents:sum('customer_risk'),cases:findings.length,unverifiedCount:findings.filter(f=>f.bucket==='needs_evidence').length,processedWork:work.length,processedInvoiceLines:invoices.length,processedPayments:payments.length,processedAdjustments:adjustments.length,excluded:skipped,asOf};
 return {valid:true,errors:[],warnings,findings,summary,stats,assumptions:[
  'Potential revenue, past-due accounts receivable and customer-side risk are separate categories, not a combined recoverable total.',
  'Contract and work extracts are assumed complete only after a human verifies their source and scope.',
  'Past-due A/R analysis requires supplied payments and credit/write-off datasets; missing optional files disable the analysis.',
  'Credit/write-off adjustments reduce receivables, but may also explain rate discrepancies; reviewers must confirm.',
  'No tax calculations, foreign currency, bundled prices, tiered pricing, deposits or automated dispute submissions.',
  'This read-only audit does not make legal, financial or collection determinations.'
 ]};
}
return {REQUIRED,FILES,OPTIONAL,audit,parseCSV,table,dateOK,fmtMoney,fmtQty,cents,qty};
});
