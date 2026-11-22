"""Historical public-invoice validation and adversarial arithmetic tests."""
import sys,unittest,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from pilot_engine import load,audit,AuditError,amount_cents
class PublicPilotTest(unittest.TestCase):
 def setUp(self):self.headers,self.lines=load()
 def test_historical_metrics(self):
  r=audit(self.headers,self.lines);s=r['summary'];self.assertEqual((s['invoices'],s['lines'],s['vendors'],s['customers']),(7,50,2,3));self.assertEqual(s['total_cents'],774241);self.assertEqual(s['passed_invoice_totals'],7);self.assertEqual(s['unit_checked'],11);self.assertEqual(s['unit_passed'],11);self.assertEqual(s['arithmetic_failures'],0);self.assertEqual(s['confirmed_recovery_cents'],0)
 def test_no_contract_or_payment_conclusions(self):
  r=audit(self.headers,self.lines);self.assertEqual(r['summary']['rate_coverage'],'unavailable');self.assertEqual(r['summary']['payment_coverage'],'unavailable')
 def test_duplicate_header_rejected(self):
  h=self.headers+self.headers[:1];self.assertRaises(AuditError,audit,h,self.lines)
 def test_missing_source_rejected(self):
  h=copy.deepcopy(self.headers);h[0]['source_url']='';self.assertRaises(AuditError,audit,h,self.lines)
 def test_orphan_lines_rejected(self):
  l=copy.deepcopy(self.lines);l[0]['invoice_number']='UNKNOWN';self.assertRaises(AuditError,audit,self.headers,l)
 def test_amount_must_be_cents(self):
  for v in ['notanumber','12.345','NaN']:
   with self.subTest(v=v):self.assertRaises(AuditError,amount_cents,v)
 def test_mutated_invoice_detected(self):
  h=copy.deepcopy(self.headers);h[0]['invoice_total_usd']='52.14';r=audit(h,self.lines);self.assertEqual(r['summary']['passed_invoice_totals'],6);self.assertEqual(r['summary']['arithmetic_failures'],1)
 def test_mutated_unit_price_detected(self):
  l=copy.deepcopy(self.lines);x=next(x for x in l if x.get('unit_cost_usd'));x['unit_cost_usd']='279.00';r=audit(self.headers,l);self.assertEqual(r['summary']['unit_passed'],10);self.assertEqual(r['summary']['arithmetic_failures'],1)
if __name__=='__main__': unittest.main(verbosity=2)
