"""Recover visual rows and header-defined columns from Tesseract word boxes."""
import re
from statistics import median


def visual_rows(data):
    words = []
    for i, text in enumerate(data['text']):
        text = text.strip().strip('|')
        if not text or float(data['conf'][i]) < 0:
            continue
        words.append(dict(text=text, left=data['left'][i], right=data['left'][i] + data['width'][i],
                          top=data['top'][i], bottom=data['top'][i] + data['height'][i]))
    rows = []
    for word in sorted(words, key=lambda word: (word['top'] + word['bottom'], word['left'])):
        center = (word['top'] + word['bottom']) / 2
        height = word['bottom'] - word['top']
        if rows and abs(center - rows[-1]['center']) <= max(5, min(height, rows[-1]['height']) * .65):
            rows[-1]['words'].append(word)
            rows[-1]['center'] = median((w['top'] + w['bottom']) / 2 for w in rows[-1]['words'])
        else:
            rows.append(dict(words=[word], center=center, height=height))
    for row in rows:
        row['words'].sort(key=lambda word: word['left'])
        row['text'] = ' '.join(word['text'] for word in row['words'])
    return rows


def table_cells(rows):
    """Return None if headers are missing, otherwise only rows inside the table."""
    for index, row in enumerate(rows):
        if not (re.search(r'\b(qty|quantity)\b', row['text'], re.I) and
                re.search(r'\b(description|item|product)\b', row['text'], re.I)):
            continue
        words = list(row['words'])
        # Multi-line headers often put 'Unit Price' just above the other headings.
        for nearby in rows[max(0, index - 4):index + 4]:
            if nearby is not row and abs(nearby['center'] - row['center']) < row['height'] * 1.8:
                if re.search(r'price|rate|USD', nearby['text'], re.I):
                    words.extend(nearby['words'])
        anchors = {}
        for word in words:
            label = re.sub(r'[^a-z]', '', word['text'].lower())
            field = {'description': 'item_name', 'item': 'item_name', 'product': 'item_name',
                     'material': 'material_type', 'qty': 'quantity', 'quantity': 'quantity',
                     'price': 'unit_price', 'rate': 'unit_price', 'amount': 'line_total',
                     'total': 'line_total', 'unit': 'unit'}.get(label)
            if field:
                if field == 'unit' and any(re.sub(r'\W', '', other['text'].lower()) == 'price' and
                                         abs(other['left'] - word['right']) < row['height'] * 3 for other in words):
                    continue
                anchors[field] = word
        if not {'item_name', 'quantity', 'unit_price', 'line_total'} <= anchors.keys():
            continue
        columns = sorted(anchors, key=lambda field: anchors[field]['left'])
        bounds = [(anchors[a]['right'] + anchors[b]['left']) / 2 for a, b in zip(columns, columns[1:])]
        result = []
        for body in rows[index + 1:]:
            if re.search(r'^\W*(sub\s*total|grand\s+total|total|vat|tax|notes|payment)\b', body['text'], re.I):
                break
            cells = {field: [] for field in columns}
            for word in body['words']:
                center = (word['left'] + word['right']) / 2
                position = sum(center > boundary for boundary in bounds)
                cells[columns[position]].append(word['text'])
            result.append({**{field: ' '.join(value) for field, value in cells.items()}, 'source': body['text']})
        return result
    return None
