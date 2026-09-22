"""One pricing rule shared by counter catalog and order creation."""


def counter_price(product, customer, special_prices):
    if customer is not None and getattr(customer, 'role', None) == 'wholesaler':
        return product.wholesale_price, 'wholesale'
    if product.product_id in special_prices:
        return special_prices[product.product_id], 'special'
    return product.price, 'retail'
