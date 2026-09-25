import unittest
from decimal import Decimal
from services.invoice_ocr import parse_invoice_text
from services.invoice_layout import table_cells, visual_rows
from routers.vendor_ledger import PurchaseRequest
from uuid import uuid4


class InvoiceTableTests(unittest.TestCase):
    def test_contacts_are_never_items(self):
        result = parse_invoice_text('& 08 765 432\nTel: 03 987 654\nPhone 2 10 20\nFax 2 10 20\nTotal (USD) 86.03')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['total'], '86.03')

    def test_printed_subtotal_tax_total_and_unit_columns(self):
        result = parse_invoice_text('''Description Quantity Unit Price Total
1 A4 paper, 80 gsm 5,000 sheets 0.004 20.00
2 A3 paper, 100 gsm 2,500 sheets 0.008 20.00
3 Glossy paper, 135 gsm 1,000 sheets 0.015 15.00
4 Cardboard, 250 gsm 500 sheets 0.030 15.00
5 Kraft paper, 150 gsm 300 sheets 0.025 7.50
Subtotal (USD) 77.50
VAT (11%) 8.53
Total (USD) 86.03''')
        self.assertEqual(len(result['items']), 5)
        self.assertEqual([row['quantity'] for row in result['items']], ['5000', '2500', '1000', '500', '300'])
        self.assertEqual(result['items'][0]['unit_price'], '0.004')
        self.assertEqual(result['items'][0]['unit'], 'sheets')
        self.assertEqual(result['subtotal'], '77.50')
        self.assertEqual(result['tax'], '8.53')
        self.assertEqual(result['total'], '86.03')
        self.assertFalse(any('do not match' in note for note in result['warnings']))

    def test_visual_rows_join_words_across_ocr_blocks_and_reordered_columns(self):
        words = [('Description', 30, 100), ('Quantity', 300, 100), ('Amount', 500, 100), ('Rate', 700, 100),
                 ('Paper', 30, 150), ('5000', 320, 150), ('20.00', 510, 150), ('0.004', 710, 150),
                 ('Total', 500, 200), ('20.00', 710, 200)]
        data = {'text': [], 'conf': [], 'left': [], 'width': [], 'top': [], 'height': []}
        for text, left, top in words:
            for field, value in dict(text=text, conf=95, left=left, width=len(text) * 9, top=top, height=20).items():
                data[field].append(value)
        rows = visual_rows(data)
        self.assertEqual(len(rows), 3)
        self.assertEqual(len(table_cells(rows)), 1)
        result = parse_invoice_text('\n'.join(row['text'] for row in rows), rows)
        self.assertEqual(result['items'][0]['quantity'], '5000')
        self.assertEqual(result['items'][0]['unit_price'], '0.004')
        self.assertEqual(result['items'][0]['line_total'], '20.00')

    def test_subcent_purchase_request_retains_rate(self):
        payload = PurchaseRequest(admin_id=1, request_key=uuid4(), item_name='Paper', unit='sheets',
                                  quantity='5000', unit_price='0.004', purchase_date='2026-09-24')
        self.assertEqual(payload.unit_price, Decimal('0.004'))
        self.assertEqual(payload.quantity * payload.unit_price, Decimal('20.000'))
