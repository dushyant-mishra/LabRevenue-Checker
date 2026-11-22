/* LabRevenue Check UI v3 — self-contained browser application. */
(function(){
'use strict';
const E=window.LabAudit;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=E.fmtMoney,asNum=c=>(c/100).toFixed(2);
const sourceLabels={work:'Completed work',rates:'Contract rates',invoices:'Invoice lines',payments:'Payments',adjustments:'Credits & write-offs'};
const sourceDesc={work:'Approved work completed by job and service',rates:'Customer-specific, dated price agreements',invoices:'Issued invoice line items and due dates',payments:'Receipts allocated to invoice IDs',adjustments:'Approved credits and write-offs (optional)'};
const buckets={potential_revenue:{label:'Potential underbilling',short:'Underbilling',theme:'teal',color:'#11897e',icon:'↗'},past_due:{label:'Past-due receivables',short:'Past due',theme:'amber',color:'#d4a04a',icon:'◷'},customer_risk:{label:'Customer-side variance',short:'Customer risk',theme:'rose',color:'#ce7277',icon:'↔'},needs_evidence:{label:'Needs evidence',short:'Unverified',theme:'blue',color:'#759ac0',icon:'?'}};
const statusNames=['Needs review','Investigating','Evidence confirmed','Ready for follow-up','Resolved','Dismissed'];
let state={view:'overview',sourceMode:'demo',sources:{},raw:{},result:null,filters:{query:'',bucket:'all',status:'all'},reviews:{},activeCase:null,notice:true,dates:'2026-11-22',lastErrors:[],sort:'priority',auditSignature:''};
let toastTimer=null;
const APP_VERSION='4.0.0';
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3700);}
function initDemo(){state.auditSignature='';state.raw={};state.sources={};for(const kind of Object.keys(E.REQUIRED)){state.raw[kind]=E.table(window.LAB_DEMO[kind]||[],kind);state.sources[kind]={origin:'demo',name:E.FILES[kind],rows:state.raw[kind].rows.length};}state.sourceMode='demo';state.reviews={};state.lastErrors=[];runAudit(false);}
function dataSignature(raw,date){
  const source=JSON.stringify(raw)+date;let hash=2166136261;
  for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function runAudit(show=true){
 state.dates=$('audit-date').value;
 const sig=dataSignature(state.raw,state.dates);
 if(state.auditSignature&&state.auditSignature!==sig){state.reviews={};if(state.activeCase)closeDrawer();}
 state.auditSignature=sig;
 try{state.result=E.audit(state.raw,state.dates);state.lastErrors=state.result.valid?[]:state.result.errors;}catch(err){state.result={valid:false,errors:[err.message],findings:[],summary:null,warnings:[]};state.lastErrors=[err.message];}
 renderAll();if(show)notify(state.result.valid?`Audit completed · ${state.result.findings.length} exceptions found`:'Audit blocked · review invalid or missing source data');
}
function reviewOf(f){return state.reviews[f.id]||{status:'Needs review',note:'',outcome:'',amount:'',reference:''};}
function reviewOpen(f){return !['Resolved','Dismissed'].includes(reviewOf(f).status);}
function badge(text,theme){return `<span class="badge badge-${theme}"><span class="badge-dot"></span>${esc(text)}</span>`;}
function moneyOrDash(n){return n==null?'—':money(n);}
function safeStatus(s){return badge(s,s==='Resolved'?'teal':s==='Dismissed'?'gray':s==='Ready for follow-up'?'blue':s==='Evidence confirmed'?'teal':'amber');}
function findById(id){return state.result?.findings.find(f=>f.id===id);}
function setView(v){if(!['overview','cases','sources','method'].includes(v))return;state.view=v;document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===v));document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+v));$('crumb-name').textContent={overview:'Overview',cases:'Case review',sources:'Data room',method:'How it works'}[v];renderAll();window.scrollTo({top:0,behavior:'instant'});}
function renderAll(){
 const r=state.result;
 $('nav-cases').textContent=r?.valid?r.findings.filter(reviewOpen).length:'—';
 $('side-date').textContent=`As of ${prettyDate(state.dates)}`;
 $('audit-notice').hidden=!state.notice;
 const banner=$('audit-notice');
 banner.querySelector('b').textContent=state.sourceMode==='demo'?'Demonstration workspace':'Local audit workspace';
 banner.querySelector('.notice > div > span').textContent=state.sourceMode==='demo'?'All records are fictional. Findings are potential discrepancies, not confirmed recoveries or amounts legally due.':'Your CSVs stay in this browser session. Findings are potential discrepancies that require contract, record and ledger verification.';
 document.querySelector('.mode-tag').innerHTML=`<span class="mode-pulse"></span>${state.sourceMode==='demo'?'Synthetic demo data':'Local CSV workspace'}`;
 if(state.view==='overview')renderOverview();
 if(state.view==='cases')renderCases();
 if(state.view==='sources')renderSources();
 if(state.view==='method')renderMethod();
 if(state.activeCase)renderDrawer();
}
const prettyDate=d=>{if(!E.dateOK(d))return d;return new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});};
function errorPanel(){return `<div class="error-panel"><b>Audit blocked — no financial findings generated</b><ul>${(state.lastErrors||[]).slice(0,16).map(x=>`<li>${esc(x)}</li>`).join('')}${state.lastErrors.length>16?`<li>... ${state.lastErrors.length-16} additional issues</li>`:''}</ul><div style="margin-top:11px"><button class="btn btn-outline btn-sm" data-action="sources">Review data files</button></div></div>`;}
function warningPanel(){const warnings=state.result?.warnings||[];return warnings.length?`<div class="warning-panel"><b>Reconciliation caveats (${warnings.length})</b><ul>${warnings.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';}
function kpiCard(name,value,caption,theme,icon){return `<div class="kpi-card"><div class="kpi-top"><span>${esc(name)}</span><div class="kpi-icon ${theme==='teal'?'':theme}">${icon}</div></div><div class="kpi-value">${esc(value)}</div><div class="kpi-caption">${esc(caption)}</div><span class="kpi-rule ${theme==='teal'?'':theme}"></span></div>`;}
function getRealized(){let cashCents=0,creditCents=0,n=0;for(const f of state.result?.findings||[]){const r=reviewOf(f);if(r.status!=='Resolved'||!r.reference||!Number.isFinite(Number(r.amount)))continue;const v=Math.round(Number(r.amount)*100);if(r.outcome==='cash_collected'&&['potential_revenue','past_due'].includes(f.bucket)){cashCents+=v;n++;}if(r.outcome==='credit_applied'&&f.bucket==='customer_risk'){creditCents+=v;}}return {cashCents,creditCents,n};}
function renderOverview(){
 const r=state.result;
 if(!r?.valid){$('top-content').innerHTML=errorPanel()+`<div class="panel"><div class="panel-content"><p>Fix the source errors or restore the sample dataset to rerun the reconciliation.</p><button class="btn btn-primary" style="margin-top:15px" data-action="restore">Restore fictional demo</button></div></div>`;return;}
 const s=r.summary;const review=r.findings.filter(reviewOpen).length;const verified=getRealized();const total=s.potentialRevenueCents+(s.pastDueCents||0)+s.customerRiskCents;
 const exposure=[['potential_revenue',s.potentialRevenueCents],['past_due',s.pastDueCents||0],['customer_risk',s.customerRiskCents]];
 const progress=100*(r.findings.length-review)/Math.max(1,r.findings.length);
 const high=r.findings.filter(x=>x.bucket==='potential_revenue').length;
 $('top-content').innerHTML=warningPanel()+`
 <div class="kpi-grid">
  ${kpiCard('Potential underbilling',money(s.potentialRevenueCents),`${high} cases · requires verification`,'teal','↗')}
  ${kpiCard('Past-due A/R',s.arCoverage?money(s.pastDueCents):'Not assessed',s.arCoverage?'Separate from potential underbilling':'Add payments and adjustment files','orange','◷')}
  ${kpiCard('Customer-side variance',money(s.customerRiskCents),'Potential customer billing risk','rose','↔')}
  ${kpiCard('Open review queue',String(review).padStart(2,'0'),`${r.findings.length-review} closed or dismissed`,'blue','▤')}
 </div>
 <div class="insight-layout">
  <div class="panel"><div class="panel-head"><div><h2>Where to investigate</h2><p>Detected financial exceptions by category, not guaranteed revenue</p></div><button class="text-link" data-action="cases">View all cases ↗</button></div>
   <div class="panel-content"><div class="detail-muted">Amounts by issue type · these categories must not be added together</div><div class="exposure-bar" aria-label="Distribution of detected financial exceptions">${exposure.map(([b,n])=>`<span title="${esc(buckets[b].label)}: ${money(n)}" style="width:${total?100*n/total:0}%;background:${buckets[b].color}"></span>`).join('')}</div><div class="exp-key">${exposure.map(([b,n])=>`<div class="exp-line"><span class="exp-dot" style="background:${buckets[b].color}"></span><span class="exp-name">${esc(buckets[b].label)}</span><strong>${b==='past_due'&&!s.arCoverage?'Not assessed':money(n)}</strong></div>`).join('')}<div class="exp-line"><span class="exp-dot" style="background:#91acc9"></span><span class="exp-name">Cases needing additional evidence</span><strong>${s.unverifiedCount} cases</strong></div></div></div>
  </div>
  <div class="panel"><div class="panel-head"><div><h2>Review progress</h2><p>Human decisions, not automated corrections</p></div></div><div class="panel-content"><div class="review-header"><span class="detail-muted">Closed or dismissed</span><b>${r.findings.length-review} <span style="font-size:13px;color:#91a3ab;font-weight:500">/ ${r.findings.length}</span></b></div><div class="mini-progress"><div style="width:${progress}%"></div></div><div class="review-stats"><span>${Math.round(progress)}% completed</span><span>${review} require attention</span></div>
  <div class="action-list"><div class="action-item"><span class="action-bullet" style="background:#0f9b85"></span><div><b>Start with unbilled work</b><span>Review contractual entitlement and completed-work evidence</span></div></div><div class="action-item"><span class="action-bullet" style="background:#d8a14e"></span><div><b>Reconcile past-due items</b><span>Confirm credits and unallocated receipts</span></div></div><div class="action-item"><span class="action-bullet" style="background:#869db5"></span><div><b>Verify ${s.unverifiedCount} unclear cases</b><span>Never infer missing or overlapping rate agreements</span></div></div></div>
  <div style="margin-top:22px;display:flex;align-items:center;justify-content:space-between"><span class="detail-muted">Documented collections · ${verified.n} outcome(s)</span><b style="font-size:12px;color:#177b72">${money(verified.cashCents)}</b></div>
  </div></div>
 </div>
 <div class="section-head"><div><h2>Priority exceptions</h2><p>Open a case to inspect its calculation and source records</p></div><button class="text-link" data-action="cases">Open case workbench ↗</button></div>
 <div class="panel">${caseTable(r.findings.slice(0,6),'overview')}</div>
 <div class="footer-note">As of ${prettyDate(state.dates)} · Local ${state.sourceMode==='demo'?'fictional demonstration':'customer-provided'} data · Not a legal determination or a record of recovered funds. Audit results are limited by the completeness of supplied sources.</div>`;
}
function caseTable(rows,mode){
 if(!rows.length)return `<div class="empty-state"><div class="empty-mark">✓</div><h3>No matching exceptions</h3><p>Try a different filter or verify your inputs.</p></div>`;
 return `<div class="table-frame"><table class="data-table"><thead><tr><th>Exception / Job</th><th>Category</th><th>Customer</th><th style="text-align:right">Amount</th><th>Review status</th><th style="text-align:right">Action</th></tr></thead><tbody>${rows.map(f=>`<tr><td data-label="Exception"><button class="case-link" data-case="${esc(f.id)}">${esc(f.title)}</button><div class="case-sub">${esc(f.job_id||f.invoice_id||'Unlinked')} · ${esc(f.service_code||f.type)} · ${esc(f.id)}</div></td><td data-label="Category">${badge(buckets[f.bucket].short,buckets[f.bucket].theme)}</td><td data-label="Customer">${esc(f.customer_id||'—')}</td><td data-label="Amount" class="money-cell">${moneyOrDash(f.amountCents)}</td><td data-label="Status">${safeStatus(reviewOf(f).status)}</td><td data-label="Action" class="action-cell"><button class="case-open" data-case="${esc(f.id)}">Review ↗</button></td></tr>`).join('')}</tbody></table></div>${mode==='cases'?`<div class="result-line">Showing ${rows.length} matching exceptions · Select a row to inspect the evidence.</div>`:''}`;
}
function renderCases(){const r=state.result;if(!r?.valid){$('cases-content').innerHTML=errorPanel();return;}
 const f=state.filters;
 const filtered=r.findings.filter(x=>{
  if(f.bucket!=='all'&&x.bucket!==f.bucket)return false;
  if(f.status!=='all'&&reviewOf(x).status!==f.status)return false;
  const q=f.query.toLowerCase().trim();if(!q)return true;
  return [x.id,x.title,x.job_id,x.invoice_id,x.customer_id,x.service_code,x.summary].some(v=>String(v||'').toLowerCase().includes(q));
 });
 $('cases-content').innerHTML=`<div class="quality-strip"><div class="quality-item"><span class="quality-circle">${r.findings.length}</span><div><b>Detected exceptions</b><small>Human verification required</small></div></div><div class="quality-item"><span class="quality-circle" style="background:#fff3e3;color:#bc8228">${r.findings.filter(reviewOpen).length}</span><div><b>Open review items</b><small>Not yet closed or dismissed</small></div></div><div class="quality-item"><span class="quality-circle" style="background:#edf3fc;color:#6482a3">${r.summary.unverifiedCount}</span><div><b>Missing supporting evidence</b><small>Review contract or source completeness</small></div></div></div>
 <div class="panel"><div class="filterbar"><div class="search-field"><span aria-hidden="true">⌕</span><input id="case-search" type="search" value="${esc(f.query)}" placeholder="Search job, invoice, customer or exception…" aria-label="Search exceptions"></div><div class="filtergroup"><select id="category-filter" class="select-field" aria-label="Filter by category"><option value="all">All categories</option>${Object.entries(buckets).map(([k,b])=>`<option value="${k}" ${f.bucket===k?'selected':''}>${esc(b.short)}</option>`).join('')}</select><select id="status-filter" class="select-field" aria-label="Filter by review status"><option value="all">All statuses</option>${statusNames.map(s=>`<option value="${s}" ${s===f.status?'selected':''}>${s}</option>`).join('')}</select></div></div><div id="filtered-case-table">${caseTable(filtered,'cases')}</div></div>`;
}
function renderSourceCard(kind){
 const item=state.sources[kind],rows=state.raw[kind]?.rows?.length;
 const status=item?`${rows} rows loaded`:'Not uploaded';
 return `<div class="file-card" data-file-card="${kind}"><div class="file-head"><div class="file-icon">▤</div><div class="file-copy"><b>${sourceLabels[kind]}</b><p>${sourceDesc[kind]}</p></div>${item?badge('Loaded','teal'):badge(kind==='adjustments'?'Optional':'Required','amber')}</div><div class="file-foot"><div class="file-stat">${item?`<b>${esc(item.name)}</b> · ${rows} rows`:status}</div><div class="file-actions"><button class="btn btn-outline btn-sm" data-action="download-sample" data-kind="${kind}">Sample ↓</button><label class="btn btn-quiet btn-sm" for="upload-${kind}" tabindex="0">Replace ↑</label><input type="file" id="upload-${kind}" data-kind="${kind}" accept=".csv,text/csv" aria-label="Upload ${sourceLabels[kind]} CSV"/></div></div><div class="file-columns">Columns · <code>${E.REQUIRED[kind].join(' · ')}</code></div></div>`;
}
function renderSources(){
 const loaded=Object.keys(state.sources).length,valid=state.result?.valid;
 $('source-content').innerHTML=`${state.lastErrors.length?errorPanel():''}${warningPanel()}<div class="quality-strip"><div class="quality-item"><span class="quality-circle">${loaded}/5</span><div><b>Input datasets loaded</b><small>Three required, two optional</small></div></div><div class="quality-item"><span class="quality-circle" style="background:#eaf2f9;color:#567b9e">${state.sourceMode==='demo'?'DEMO':'LOCAL'}</span><div><b>${state.sourceMode==='demo'?'Fictional example':'Private local workspace'}</b><small>No backend or network requests</small></div></div><div class="quality-item"><span class="quality-circle" style="background:${valid?'#e5f8f0':'#fff2e8'};color:${valid?'#168575':'#af772d'}">${valid?'✓':'!'}</span><div><b>${valid?'Latest audit passed validation':'Audit not verified'}</b><small>${valid?'Ready for case review':'Check required columns and records'}</small></div></div></div><div class="section-head"><div><h2>Source files</h2><p>Changing one file starts a new, separate private dataset so fictional data cannot be mixed with customer records.</p></div></div><div class="file-grid">${Object.keys(E.REQUIRED).map(renderSourceCard).join('')}</div><div class="source-actions"><button class="btn btn-outline" data-action="download-all">Download all sample CSVs</button><button class="btn btn-primary" data-action="rerun">Run reconciliation ↗</button></div><div class="hint-box" style="margin-top:19px"><b>Data assurance rules.</b> Invalid dates, duplicate record IDs, negative amounts, malformed CSVs, missing columns and contradictory invoice headers block the entire audit. Future-dated records and void invoices are excluded explicitly. Past-due analysis runs only when both payment and adjustment exports are supplied. Credits and write-offs reduce overdue balances. An ambiguous or absent rate produces an evidence case, never a fabricated underbilling amount.</div>`;
}
function renderMethod(){
 $('method-content').innerHTML=`<div class="method-grid">
 <div class="method-card"><span class="step-index">01</span><h3>Import without replacing your systems</h3><p>Use exports from your laboratory operations, pricing, accounting and payment records. All processing in this demo stays in the current browser.</p></div>
 <div class="method-card"><span class="step-index">02</span><h3>Validate before calculating</h3><p>Identify duplicate IDs, missing columns, invalid money or dates, out-of-period records, contradictory invoice data and incomplete rate coverage.</p></div>
 <div class="method-card"><span class="step-index">03</span><h3>Explain every discrepancy</h3><p>Review billed quantities, contractual reference rates, credits, paid amounts, due dates and evidence references. Amounts are not treated as automatically collectible.</p></div>
 <div class="method-card"><span class="step-index">04</span><h3>Review, resolve and document</h3><p>Use a human review queue, create a draft correction or follow-up, and log a confirmed cash or credit outcome with an external evidence reference.</p></div>
 </div><div class="insight-layout"><div class="panel"><div class="panel-head"><div><h2>Supported in this prototype</h2><p>Conservative, deterministic rules</p></div></div><div class="scope-list"><div><span class="good">✓</span> Completed vs invoiced unit reconciliation</div><div><span class="good">✓</span> Customer-specific effective-dated contracted rates</div><div><span class="good">✓</span> Past-due payments with partial payments and adjustments</div><div><span class="good">✓</span> Invoice over-quantities and missing evidence</div><div><span class="good">✓</span> Duplicate identifiers and possible repeated invoice lines</div><div><span class="good">✓</span> Source row references, approval states and CSV exports</div></div></div>
 <div class="panel"><div class="panel-head"><div><h2>Not supported yet</h2><p>Explicitly outside the POC scope</p></div></div><div class="scope-list"><div><span class="bad">×</span> PDF/Excel extraction or autonomous contract interpretation</div><div><span class="bad">×</span> Taxes, bundled service pricing and tiered discounts</div><div><span class="bad">×</span> Foreign currency, deposits or complex prepayments</div><div><span class="bad">×</span> Automatic invoice issuance or debt collection</div><div><span class="bad">×</span> Production security, user access and cloud persistence</div><div><span class="bad">×</span> AI-generated decisions presented as verified facts</div></div></div></div>
 <div class="hint-box">For real business use, obtain permission to analyze records; validate actual rate terms and complete accounting exports; independently confirm each finding before issuing an adjustment. This is an offline demonstration, not a hosted production or compliant medical billing system.</div>`;
}
function sourceEvidenceDetails(e){
 const kind=Object.keys(E.FILES).find(k=>E.FILES[k]===e.source);const row=state.raw[kind]?.rows?.find(r=>r.__row===e.row);
 const fields=row?Object.entries(row).filter(([k])=>k!=='__row'):[];
 return `<details class="evidence-details"><summary><span class="ev-icon">▤</span><strong>${esc(e.source)}</strong><span>Row ${esc(e.row)}</span><code>${esc(e.reference)}</code><span aria-hidden="true">⌄</span></summary><div class="evidence-details-body">${fields.length?fields.map(([k,v])=>`<div class="ev-field"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''):'<span>Original row not available.</span>'}</div></details>`;
}

function renderDrawer(){
 const f=findById(state.activeCase);if(!f){closeDrawer();return;}
 const r=reviewOf(f);const outcomes=[['','Select outcome'],...(f.bucket==='potential_revenue'||f.bucket==='past_due'?[['cash_collected','Cash received and reconciled']]:[]),...(f.bucket==='customer_risk'?[['credit_applied','Customer credit / refund issued']]:[]),['nonrecoverable','Closed with no financial recovery']];
 $('overlay').hidden=false;$('case-drawer').hidden=false;document.body.style.overflow='hidden';
 const bucket=buckets[f.bucket];
 $('case-drawer').innerHTML=`<div class="drawer-header"><div><div class="drawer-kicker">${esc(f.id)} · ${esc(bucket.short.toUpperCase())}</div><h2>${esc(f.title)}</h2><p>${esc(f.job_id||'Invoice-level case')} · ${esc(f.customer_id||'Unlinked customer')} ${f.invoice_id?'· '+esc(f.invoice_id):''}</p></div><button id="drawer-close" class="drawer-close" aria-label="Close case details">×</button></div>
 <div class="drawer-body">
  <div class="drawer-amount"><small>${esc(bucket.label)} · estimated exposure</small><strong>${moneyOrDash(f.amountCents)}</strong><p>${f.amountCents==null?'Insufficient verified contract data to quantify.':'Potential financial discrepancy. Not a confirmed receivable, refund or recovery.'}</p></div>
  <div class="drawer-section"><h3>What the audit found</h3><p>${esc(f.summary||'')}</p></div>
  ${f.formula?`<div class="drawer-section"><h3>Reconciliation calculation</h3><div class="formula">${esc(f.formula)}</div></div>`:''}
  <div class="drawer-section"><h3>Supporting source records <span class="detail-muted" style="font-weight:400">(${(f.evidence||[]).length})</span></h3><div class="evidence-box">${(f.evidence||[]).length?(f.evidence||[]).map(sourceEvidenceDetails).join(''):'<div class="evidence-row">No source record supplied</div>'}</div></div>
  <div class="drawer-section"><h3>Recommended next step</h3><p>${esc(f.recommendation||'Confirm the complete financial records with the appropriate reviewer.')}</p></div>
  <div class="drawer-section"><h3>Review & remediation</h3><div class="drawer-form"><label class="form-label">Case status<select id="review-status">${statusNames.map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
  <label class="form-label">Reviewer notes<textarea id="review-note" placeholder="What did you verify? Why was this marked resolved or dismissed?">${esc(r.note)}</textarea></label>
  <div id="resolution-fields" ${r.status!=='Resolved'?'hidden':''}><div class="drawer-form" style="border-left:3px solid #a3d8d0;padding-left:13px"><label class="form-label">Resolution outcome<select id="resolution-outcome">${outcomes.map(([v,l])=>`<option value="${v}" ${r.outcome===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="form-label">Verified financial outcome (USD)<input id="resolution-amount" inputmode="decimal" placeholder="0.00" value="${esc(r.amount)}" /></label><label class="form-label">Proof / ledger reference<input id="resolution-reference" placeholder="Receipt ID, credit memo or invoice reference" value="${esc(r.reference)}"/></label></div></div></div>
  <div class="drawer-buttons"><button class="btn btn-primary" id="save-review">Save case review</button><button class="btn btn-outline" id="copy-draft">Preview follow-up</button><button class="btn btn-quiet" id="export-one">Export case</button></div><div id="draft-preview" hidden class="draft-preview"><label class="form-label">Review this draft before sending<textarea id="draft-text" rows="9" readonly></textarea></label><div style="display:flex;justify-content:flex-end;margin-top:8px"><button id="draft-copy" class="btn btn-outline btn-sm">Copy draft</button></div></div><div class="footer-note">No correction is sent automatically. Review entries live only in this browser session unless exported.</div>
  </div>
 </div>`;
 $('drawer-close').onclick=closeDrawer;
 $('review-status').onchange=()=>{$('resolution-fields').hidden=$('review-status').value!=='Resolved';};
 $('save-review').onclick=saveReview;
 $('copy-draft').onclick=()=>{const el=$('draft-preview');el.hidden=false;$('draft-text').value=followup(f);el.scrollIntoView({behavior:'smooth',block:'nearest'});};
 $('draft-copy').onclick=()=>copyDraft(f);
 $('export-one').onclick=()=>downloadCSV('case-'+f.id+'.csv',[caseExportRow(f)],caseHeaders);
}
function openDrawer(id){if(!findById(id))return;state.activeCase=id;renderDrawer();setTimeout(()=>$('drawer-close')?.focus(),30);}
function closeDrawer(){state.activeCase=null;$('overlay').hidden=true;$('case-drawer').hidden=true;document.body.style.overflow='';}
function saveReview(){
 const f=findById(state.activeCase);if(!f)return;
 const status=$('review-status').value,note=$('review-note').value.trim();let outcome='',reference='',amountValue='';
 if(status==='Resolved'){
  outcome=$('resolution-outcome').value;reference=$('resolution-reference').value.trim();amountValue=$('resolution-amount').value.trim();
  if(!outcome){notify('Select a resolution outcome.');return;}
  if(!reference){notify('A supporting ledger, receipt, or adjustment reference is required.');return;}
  if(outcome==='cash_collected'&&!['potential_revenue','past_due'].includes(f.bucket)){notify('Cash recovery applies only to underbilling or past-due cases.');return;}
  if(outcome==='credit_applied'&&f.bucket!=='customer_risk'){notify('Customer credits belong to customer-side cases, not recovered revenue.');return;}
  if(!/^\d+(?:\.\d{1,2})?$/.test(amountValue)){notify('Enter a valid confirmed outcome amount, including 0.00 if applicable.');return;}
  const amountCents=E.cents(amountValue);if(amountCents==null||amountCents>(f.amountCents||0)){notify('Confirmed outcome cannot exceed the detected case amount.');return;}
  if(outcome==='nonrecoverable'&&amountCents!==0){notify('Nonrecoverable cases must have a confirmed amount of 0.00.');return;}
  if(outcome!=='nonrecoverable'&&amountCents===0){notify('A realized cash or credit outcome must be greater than zero.');return;}
 }
 if(['Evidence confirmed','Ready for follow-up'].includes(status)&&!note){notify('Document the evidence reviewed before advancing this case.');return;}
 if(status==='Dismissed'&&!note){notify('Provide a reason for dismissing the finding.');return;}
 state.reviews[f.id]={status,note,outcome,reference,amount:amountValue,reviewedAt:new Date().toISOString()};
 closeDrawer();renderAll();notify(`Saved case ${f.id} as ${status.toLowerCase()}`);
}
function followup(f){
 const inv=f.invoice_id||'(invoice reference to verify)';let content='';
 if(f.bucket==='potential_revenue')content=`Subject: Billing reconciliation review — ${f.job_id||inv}\n\nHello,\n\nDuring an internal review, we identified a potential discrepancy involving ${f.job_id||inv} (${f.service_code||'service'}). Our records suggest ${moneyOrDash(f.amountCents)} may require additional billing review.\n\nWe are validating the relevant agreement, work records and any prior adjustments. Please advise whether there are other invoices, credits or commercial arrangements we should consider.\n\nNo correction will be requested until the records have been confirmed.\n\nThank you.`;
 else if(f.bucket==='past_due')content=`Subject: Request to reconcile invoice ${inv}\n\nHello,\n\nOur records show a potential outstanding adjusted balance of ${moneyOrDash(f.amountCents)} for invoice ${inv}. Before taking further action, could you confirm whether any recent payments, disputes or credits are pending or have been applied elsewhere?\n\nThank you.`;
 else content=`Subject: Supporting records requested — ${f.job_id||inv}\n\nHello,\n\nWe are reviewing an apparent discrepancy in ${f.job_id||inv}. Before making any correction, please confirm the applicable agreement, completed work details, and any relevant invoices or adjustments.\n\nThank you.`;
 return content;
}
async function copyDraft(f){
 const draft=$('draft-text');const text=draft?.value||followup(f);
 try{await navigator.clipboard.writeText(text);notify('Draft copied. Review it before sending.');}
 catch(e){if(draft){draft.focus();draft.select();notify('Select the highlighted text and use Ctrl+C (or Cmd+C).');}else notify('Copy unavailable. Use the case export.');}
}

function csvEscape(input){let s=String(input??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function downloadCSV(name,rows,headers){const line=arr=>arr.map(csvEscape).join(',');const text='\uFEFF'+line(headers)+'\r\n'+rows.map(row=>line(headers.map(h=>row[h]??''))).join('\r\n')+'\r\n';const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const caseHeaders=['case_id','type','category','job_id','invoice_id','customer_id','service_code','estimated_amount_usd','status','note','resolution_outcome','confirmed_amount_usd','proof_reference','formula','evidence_rows'];
function caseExportRow(f){const r=reviewOf(f);return {case_id:f.id,type:f.type,category:buckets[f.bucket].label,job_id:f.job_id||'',invoice_id:f.invoice_id||'',customer_id:f.customer_id||'',service_code:f.service_code||'',estimated_amount_usd:f.amountCents==null?'':asNum(f.amountCents),status:r.status,note:r.note,resolution_outcome:r.outcome,confirmed_amount_usd:r.amount,proof_reference:r.reference,formula:f.formula,evidence_rows:(f.evidence||[]).map(x=>`${x.source}:${x.row}`).join('; ')};}
function exportCases(){if(!state.result?.valid){notify('Run a valid audit first.');return;}downloadCSV('labrevenue-exceptions-'+state.dates+'.csv',state.result.findings.map(caseExportRow),caseHeaders);notify('Audit register exported.');}
function saveReviews(){
 if(!state.result?.valid){notify('Run a valid audit first.');return;}
 const payload={app:'LabRevenue',version:APP_VERSION,asOf:state.dates,auditSignature:state.auditSignature,exportedAt:new Date().toISOString(),reviews:state.reviews};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='labrevenue-review-session-'+state.dates+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Review session downloaded. It contains your notes and customer references.');
}
async function loadReviews(file){
 if(!file||!state.result?.valid){notify('Run a valid audit before restoring reviews.');return;}
 if(file.size>2*1024*1024){notify('Review session exceeds 2 MB limit.');return;}
 try{
  const data=JSON.parse(await file.text());
  if(data.app!=='LabRevenue'||data.auditSignature!==state.auditSignature||data.asOf!==state.dates||!data.reviews||typeof data.reviews!=='object'||Array.isArray(data.reviews))throw Error('Review session does not match the current source files and audit date.');
  const findings=new Map(state.result.findings.map(f=>[f.id,f]));const restored={};
  for(const [id,r] of Object.entries(data.reviews)){
   const f=findings.get(id);
   if(!f||!r||!statusNames.includes(r.status)||typeof r.note!=='string'||r.note.length>20000)throw Error('Review session contains an unknown case or invalid review.');
   if(r.status==='Resolved'){
    const amt=E.cents(r.amount);const allowed=r.outcome==='nonrecoverable'||(r.outcome==='cash_collected'&&['potential_revenue','past_due'].includes(f.bucket))||(r.outcome==='credit_applied'&&f.bucket==='customer_risk');
    if(!allowed||amt===null||amt>(f.amountCents||0)||!r.reference||typeof r.reference!=='string'||(r.outcome==='nonrecoverable'?amt!==0:amt===0))throw Error('Review session has an invalid documented resolution.');
   }
   restored[id]={status:r.status,note:r.note,outcome:r.outcome||'',amount:r.amount||'',reference:r.reference||'',reviewedAt:r.reviewedAt||''};
  }
  state.reviews=restored;renderAll();notify(`Restored ${Object.keys(restored).length} reviews for this exact audit.`);
 }catch(err){notify('Could not load session: '+err.message);}
}

function downloadSample(kind){const rows=window.LAB_DEMO[kind]||[];downloadCSV(E.FILES[kind],rows,E.REQUIRED[kind]);}
function downloadAllSamples(){const kinds=Object.keys(E.REQUIRED);kinds.forEach((kind,i)=>setTimeout(()=>downloadSample(kind),i*300));notify('Downloading five fictional CSV examples.');}
async function handleUpload(kind,file){if(!file)return;const name=file.name||'uploaded.csv';if(!name.toLowerCase().endsWith('.csv')){notify('This POC supports CSV files only.');return;}if(file.size>5*1024*1024){notify('File exceeds the 5 MB offline-demo limit.');return;}
 try{
  const parsed=E.parseCSV(await file.text());
  if(state.sourceMode==='demo'){state.sourceMode='custom';state.sources={};state.raw={};state.reviews={};state.filters={query:'',bucket:'all',status:'all'};}
  state.raw[kind]=parsed;state.reviews={};state.auditSignature='';state.sources[kind]={origin:'local',name,rows:parsed.rows.length};state.result=null;state.lastErrors=[];renderAll();notify(`${sourceLabels[kind]} loaded · ${parsed.rows.length} rows. Run reconciliation after all required files are loaded.`);
 }catch(err){notify(`Could not parse ${name}: ${err.message}`);}
}
function bindEvents(){
 $('primary-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
 $('help-button').onclick=()=>setView('method');
 $('rerun-button').onclick=()=>runAudit();$('run-data-audit').onclick=()=>runAudit();
 $('reset-samples').onclick=()=>{initDemo();setView('sources');notify('Fictional demo restored.');};
 $('audit-date').onchange=()=>{state.dates=$('audit-date').value;};
 $('dismiss-notice').onclick=()=>{state.notice=false;renderAll();};
 $('overlay').onclick=closeDrawer;
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.activeCase)closeDrawer();});
 document.querySelector('.page-body').addEventListener('click',e=>{
  const caseButton=e.target.closest('[data-case]');if(caseButton){openDrawer(caseButton.dataset.case);return;}
  const actionButton=e.target.closest('[data-action]');if(!actionButton)return;
  const action=actionButton.dataset.action;
  if(action==='cases'||action==='sources')setView(action);
  else if(action==='restore'){initDemo();notify('Fictional demo restored.');}
  else if(action==='rerun')runAudit();
  else if(action==='export-cases')exportCases();
  else if(action==='save-reviews')saveReviews();
  else if(action==='load-reviews')document.getElementById('session-upload')?.click();
  else if(action==='download-sample')downloadSample(actionButton.dataset.kind);
  else if(action==='download-all')downloadAllSamples();
 });
 document.querySelector('.page-body').addEventListener('change',e=>{
  if(e.target.matches('input[type=file][data-kind]')){handleUpload(e.target.dataset.kind,e.target.files?.[0]);e.target.value='';}
  if(e.target.id==='session-upload'){loadReviews(e.target.files?.[0]);e.target.value='';}
  if(e.target.id==='category-filter'){state.filters.bucket=e.target.value;renderCases();}
  if(e.target.id==='status-filter'){state.filters.status=e.target.value;renderCases();}
 });
 document.querySelector('.page-body').addEventListener('input',e=>{
  if(e.target.id==='case-search'){
   state.filters.query=e.target.value;const start=e.target.selectionStart,end=e.target.selectionEnd;
   // Update only table to avoid stealing input focus.
   const f=state.filters,rows=state.result?.findings.filter(x=>(f.bucket==='all'||x.bucket===f.bucket)&&(f.status==='all'||reviewOf(x).status===f.status)&&[x.id,x.title,x.job_id,x.invoice_id,x.customer_id,x.service_code,x.summary].some(v=>String(v||'').toLowerCase().includes(f.query.trim().toLowerCase())))||[];
   const el=$('filtered-case-table');if(el)el.innerHTML=caseTable(rows,'cases');
  }
 });
 document.querySelector('.page-body').addEventListener('dragover',e=>{const c=e.target.closest('[data-file-card]');if(c){e.preventDefault();c.classList.add('drag-over');}});
 document.querySelector('.page-body').addEventListener('dragleave',e=>{const c=e.target.closest('[data-file-card]');if(c)c.classList.remove('drag-over');});
 document.querySelector('.page-body').addEventListener('drop',e=>{const c=e.target.closest('[data-file-card]');if(!c)return;e.preventDefault();c.classList.remove('drag-over');handleUpload(c.dataset.fileCard,e.dataTransfer?.files?.[0]);});
 document.querySelector('.page-body').addEventListener('keydown',e=>{const label=e.target.closest('label[for^="upload-"]');if(label&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const id=label.htmlFor;document.getElementById(id)?.click();}});
}
window.addEventListener('DOMContentLoaded',()=>{bindEvents();initDemo();setView('overview');});
})();
