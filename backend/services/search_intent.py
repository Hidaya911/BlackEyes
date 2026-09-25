"""Deterministic constraints for record lookups; embeddings only rank descriptive text."""
import calendar
import re
from datetime import date, datetime


def normalize(text):
    return ' '.join(re.findall(r'\w+', text.casefold()))


MONTHS = {name.casefold(): index for index in range(1, 13)
          for name in (calendar.month_name[index], calendar.month_abbr[index])}
MONTHS['sept'] = 9
MONTH_PATTERN = '|'.join(sorted(MONTHS, key=len, reverse=True))
DATE_PATTERN = re.compile(
    rf'\b(?:(?P<iso>\d{{4}}-\d{{1,2}}-\d{{1,2}})|'
    rf'(?P<numeric>\d{{1,2}}/\d{{1,2}}/\d{{4}})|'
    rf'(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<month>{MONTH_PATTERN})(?:\s+(?P<year>\d{{4}}))?|'
    rf'(?P<month_first>{MONTH_PATTERN})\s+(?P<day_last>\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(?P<year_last>\d{{4}}))?)\b', re.I)


def constrain_search(query, items, today=None, record_type='all'):
    today = today or date.today()
    remaining = query.casefold().replace('’', "'")
    filters = []
    scope = record_type if record_type != 'all' else None
    if re.search(r'\b(products?|items?)\b', remaining):
        scope = 'product'
    elif re.search(r'\b(?:vendors?|suppliers?)\b', remaining):
        scope = 'vendor_invoice'
    elif re.search(r'\b(orders?|customer\s+invoices?)\b', remaining) and scope != 'vendor_invoice':
        scope = 'customer_invoice'
    price_order = None
    if re.search(r'\b(cheapest|least expensive|lowest[- ]price|lowest priced)\b', remaining):
        price_order = 'price_min'
    elif re.search(r'\b(most expensive|highest[- ]price|highest priced)\b', remaining):
        price_order = 'price_max'
    if price_order and scope is None:
        scope = 'product'
    candidates = [item for item in items if scope is None or item['record_type'] == scope]
    if scope:
        filters.append({'product': 'Products', 'customer_invoice': 'Customer orders', 'vendor_invoice': 'Vendor invoices'}[scope])

    dates = list(DATE_PATTERN.finditer(remaining))
    if len(dates) > 1 or (dates and re.search(r'\b(before|after|between|since|until|through)\b', remaining)):
        raise ValueError('Search one exact date at a time, for example “orders on 16 September 2026”.')
    if dates:
        match = dates[0]
        try:
            if match['iso']:
                year, month, day = map(int, match['iso'].split('-'))
            elif match['numeric']:
                day, month, year = map(int, match['numeric'].split('/'))
            else:
                year = int(match['year'] or match['year_last'] or today.year)
                month = MONTHS[(match['month'] or match['month_first']).casefold()]
                day = int(match['day'] or match['day_last'])
            target = date(year, month, day)
        except ValueError as exc:
            raise ValueError('That date is invalid. Use a date such as 16 September 2026.') from exc
        def same_date(item):
            value = item.get('date')
            if isinstance(value, datetime):
                value = value.date()
            elif isinstance(value, str):
                value = date.fromisoformat(value[:10])
            return value == target
        candidates = [item for item in candidates if same_date(item)]
        filters.append(f'Date: {target.isoformat()}' + (' (current year)' if not (match['iso'] or match['numeric'] or match['year'] or match['year_last']) else ''))
        remaining = remaining[:match.start()] + ' ' + remaining[match.end():]

    # Vendor identity is a hard constraint, not text similarity with invoice lines.
    vendor_match = re.search(r"\b(?:vendor|supplier)\s+(?!invoices?\b|purchases?\b|orders?\b)([\w][\w '&.\-]*?)(?=\s+(?:only|on|from|with|about|for|and|orders?|invoices?|purchases?|please)\b|[?!,]|$)", remaining)
    if not vendor_match and scope == 'vendor_invoice':
        vendor_match = re.search(r"\b(?:orders?|invoices?|purchases?)\s+(?:of|for|from)\s+(?:(?:the\s+)?(?:vendor|supplier)\s+)?([\w][\w '&.\-]*?)(?=\s+(?:only|on|with|about|and|please)\b|[?!,]|$)", remaining)
    vendor_name = vendor_match[1].strip() if vendor_match else None
    if not vendor_name and (scope == 'vendor_invoice' or re.search(r'\binvoices?\b', remaining)):
        known = sorted({item['vendor_name'].casefold() for item in items if item.get('vendor_name')}, key=len, reverse=True)
        vendor_name = next((name for name in known if f' {normalize(name)} ' in f' {normalize(remaining)} '), None)
    if vendor_name:
        wanted = normalize(vendor_name.removesuffix("'s"))
        candidates = [item for item in candidates if item['record_type'] == 'vendor_invoice'
                      and f' {wanted} ' in f" {normalize(item.get('vendor_name', ''))} "]
        filters.append(f'Vendor: {vendor_name}')
        remaining = remaining.replace(vendor_match[0] if vendor_match else vendor_name, ' ')

    # Explicit customer names stay strict even when no customer matches.
    name_match = re.search(r"\bcustomer\s+(?!invoices?\b|orders?\b)([\w][\w '\-]*?)(?=\s+(?:only|on|from|with|about|for|and|orders?|invoices?)\b|[?.!,]|$)", remaining)
    if not name_match and scope == 'customer_invoice':
        name_match = re.search(r"\b(?:orders?|invoices?)\s+(?:of|for|from)\s+(?!customer\b|the\b)([\w][\w '\-]*?)(?=\s+(?:only|on|with|about|and)\b|[?.!,]|$)", remaining)
    customer = name_match[1].strip() if name_match else None
    if not customer and scope == 'customer_invoice':
        names = {normalize(item.get('customer_name', '')) for item in items if item.get('customer_name')}
        known = sorted(names | {name.split()[0] for name in names if name}, key=len, reverse=True)
        normalized = f' {normalize(remaining)} '
        customer = next((name for name in known if f' {name} ' in normalized), None)
    if customer:
        wanted = normalize(customer.removesuffix("'s"))
        candidates = [item for item in candidates if item['record_type'] == 'customer_invoice'
                      and f' {wanted} ' in f" {normalize(item.get('customer_name', ''))} "]
        filters.append(f'Customer: {customer}')
        remaining = remaining.replace(name_match[0] if name_match else customer, ' ')

    remaining = re.sub(r'\b(?:least expensive|most expensive|lowest[- ]price|highest[- ]price|lowest priced|highest priced)\b', ' ', remaining)
    filler = {'give', 'me', 'show', 'find', 'get', 'list', 'i', 'need', 'want', 'please', 'the', 'a', 'an', 'all', 'only',
              'can', 'could', 'would', 'you', 'looking', 'look', 'belonging', 'placed', 'made', 'dated', 'about',
              'of', 'for', 'from', 'on', 'in', 'at', 'and', 'with', 'that', 'are', 'is', 'my', 'to', 'it', 's',
              'orders', 'order', 'invoices', 'invoice', 'customer', 'products', 'product', 'items', 'item', 'vendor',
              'purchases', 'purchase', 'cheapest', 'date', 'vendors', 'supplier', 'suppliers', 'his', 'her', 'their'}
    residual = ' '.join(word for word in normalize(remaining).split() if word not in filler)
    if price_order:
        candidates = [item for item in candidates if item.get('amount') is not None]
        if scope == 'product':
            candidates = [item for item in candidates if item.get('status') == 'active']
            filters.append('Active products')
        filters.append('Only lowest-priced matches' if price_order == 'price_min' else 'Only highest-priced matches')
    return candidates, residual, filters, price_order
