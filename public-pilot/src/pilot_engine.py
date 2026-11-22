"""Public-record invoice-only reconciliation; no contract or payment inference."""
from __future__ import annotations
import csv, json, os, collections
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'data'

class AuditError(Exception):pass

def amount_cents(value):
    try:
        d=Decimal(str(value)); q=d.quantize(Decimal('0.01'))
        if not d.is_finite() or q != d: raise AuditError(f'Invalid money: {value}')
        return int(q * 100)
    except (InvalidOperation,ValueError,TypeError): raise AuditError(f'Invalid money: {value}')

def money(c):return f'{c/100:.2f}'

def load(source=SOURCE):
    with (source/'actual_public_invoice_headers.csv').open(newline='',encoding='utf-8-sig') as f: headers=list(csv.DictReader(f))
    with (source/'actual_public_invoice_lines.csv').open(newline='',encoding='utf-8-sig') as f: lines=list(csv.DictReader(f))
    return headers,lines

def audit(headers,lines):
    seen=set(); by=collections.defaultdict(list)
    for h in headers:
        num=h.get('invoice_number')
        if not num or num in seen: raise AuditError('Missing or duplicate invoice_number in headers')
        seen.add(num)
        if not h.get('source_url','').startswith('https://'):raise AuditError(f'No evidence source for {num}')
    for r in lines:
        if r.get('invoice_number') not in seen: raise AuditError('Line references unknown invoice '+str(r.get('invoice_number')))
        c=amount_cents(r['line_amount_usd'])
        r=dict(r,amount_cents=c)
        if r.get('unit_cost_usd','').strip():
            qty=Decimal(r['quantity']);unit=Decimal(r['unit_cost_usd'])
            if qty<0 or unit<0:raise AuditError('Negative quantity or unit cost')
            expected=int((qty*unit*100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
            r['unit_check']='PASS' if expected==c else 'MISMATCH'
            r['unit_expected_cents']=expected
        else:r['unit_check']='NOT_AVAILABLE';r['unit_expected_cents']=None
        by[r['invoice_number']].append(r)
    result=[]
    for h in headers:
        k=h['invoice_number']; lr=by[k]; announced=amount_cents(h['invoice_total_usd']);calculated=sum(x['amount_cents'] for x in lr)
        match='PASS' if announced==calculated else 'MISMATCH'
        if not lr:match='NO_LINES'
        repeat=[]
        names=collections.defaultdict(list)
        for l in lr:
            name=l['charge_description'].strip().lower()
            if 'pickup fee' in name:names[name].append(l)
        for n, rs in names.items():
            if len(rs)>1:repeat.append({'description':rs[0]['charge_description'],'count':len(rs),'amount_cents':sum(x['amount_cents'] for x in rs),'sample_ids':list({x['sample_id'] for x in rs if x.get('sample_id')})})
        result.append({**h,'reported_cents':announced,'sum_cents':calculated,'delta_cents':calculated-announced,'arithmetic':match,'line_count':len(lr),'unit_verified':sum(x['unit_check']=='PASS' for x in lr),'unit_checked':sum(x['unit_check']!='NOT_AVAILABLE' for x in lr),'unit_mismatches':sum(x['unit_check']=='MISMATCH' for x in lr),'repeat_pickups':repeat,'lines':lr,'documentation_note': 'The Plymouth Water Division recorded that additional retesting charges were above the original contract price; clarification caused a prior-year payment authorization request in 2025.' if k=='M24005302' else ('Meeting packet includes a claim voucher of $6,086. A voucher is not confirmation of payment.' if k=='180476' else '')})
    issue_count=sum(int(i['arithmetic']!='PASS')+i['unit_mismatches'] for i in result)
    summary={'invoices':len(result),'lines':len(lines),'vendors':len({x['supplier'] for x in result}),'customers':len({x['customer'] for x in result}),'total_cents':sum(x['reported_cents'] for x in result),'passed_invoice_totals':sum(x['arithmetic']=='PASS' for x in result),'unit_checked':sum(x['unit_checked'] for x in result),'unit_passed':sum(x['unit_verified'] for x in result),'arithmetic_failures':issue_count,'repeat_pickup_invoices':sum(bool(x['repeat_pickups']) for x in result),'historical_documentation_event':sum(bool(x['documentation_note']) and x['invoice_number']=='M24005302' for x in result),'confirmed_recovery_cents':0,'rate_coverage':'unavailable','work_coverage':'unavailable','payment_coverage':'unavailable','scope':'invoice-only public documents'}
    return {'summary':summary,'invoices':result,'run_date':'2026-11-22','basis':'Manual transcription of public government records; not proof of error or payment status.'}

if __name__=='__main__':
    report=audit(*load())
    (ROOT/'public-pilot-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    with (ROOT/'pilot-results.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['invoice_number','supplier','customer','invoice_date','reported_total_usd','sum_lines_usd','difference_usd','invoice_math','line_items','qty_unit_passed','qty_unit_checked','contract_rates_verified','payments_verified','source_url']);w.writeheader()
        for x in report['invoices']:w.writerow({'invoice_number':x['invoice_number'],'supplier':x['supplier'],'customer':x['customer'],'invoice_date':x['invoice_date'],'reported_total_usd':money(x['reported_cents']),'sum_lines_usd':money(x['sum_cents']),'difference_usd':money(x['delta_cents']),'invoice_math':x['arithmetic'],'line_items':x['line_count'],'qty_unit_passed':x['unit_verified'],'qty_unit_checked':x['unit_checked'],'contract_rates_verified':'NO','payments_verified':'NO','source_url':x['source_url']})
    print('PUBLIC PILOT:',json.dumps(report['summary'],indent=2))
