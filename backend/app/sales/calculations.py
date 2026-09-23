from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.sales.models import NumberSequence

def to_decimal(val: Any) -> Decimal:
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))

def round_curr(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def calculate_line_item(
    quantity: Any,
    unit_price: Any,
    discount: Any = 0.00,
    tax_rate: Any = 18.00,
) -> Dict[str, Decimal]:
    qty = to_decimal(quantity)
    price = to_decimal(unit_price)
    disc = to_decimal(discount)
    rate = to_decimal(tax_rate)

    if qty < 0:
        qty = Decimal("0.00")
    if price < 0:
        price = Decimal("0.00")
    if disc < 0:
        disc = Decimal("0.00")
    if rate < 0:
        rate = Decimal("0.00")

    line_subtotal = round_curr(qty * price)
    # Discount cannot exceed line subtotal
    if disc > line_subtotal:
        disc = line_subtotal

    taxable = max(Decimal("0.00"), line_subtotal - disc)
    tax_amt = round_curr(taxable * (rate / Decimal("100.00")))
    line_total = round_curr(taxable + tax_amt)

    return {
        "quantity": qty,
        "unit_price": price,
        "discount": disc,
        "tax_rate": rate,
        "line_subtotal": line_subtotal,
        "tax_amount": tax_amt,
        "line_total": line_total,
    }

def calculate_financial_totals(items_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    calculated_items = []
    tot_subtotal = Decimal("0.00")
    tot_discount = Decimal("0.00")
    tot_tax = Decimal("0.00")

    for idx, item in enumerate(items_data):
        calc = calculate_line_item(
            quantity=item.get("quantity", 1),
            unit_price=item.get("unit_price", 0),
            discount=item.get("discount", 0),
            tax_rate=item.get("tax_rate", 18),
        )
        tot_subtotal += calc["line_subtotal"]
        tot_discount += calc["discount"]
        tot_tax += calc["tax_amount"]

        processed_item = {
            **item,
            "quantity": calc["quantity"],
            "unit_price": calc["unit_price"],
            "discount": calc["discount"],
            "tax_rate": calc["tax_rate"],
            "tax_amount": calc["tax_amount"],
            "line_total": calc["line_total"],
            "sort_order": item.get("sort_order", idx),
        }
        calculated_items.append(processed_item)

    tot_total = round_curr(tot_subtotal - tot_discount + tot_tax)

    return {
        "subtotal": round_curr(tot_subtotal),
        "discount_amount": round_curr(tot_discount),
        "tax_amount": round_curr(tot_tax),
        "total_amount": tot_total,
        "items": calculated_items,
    }

def generate_sequential_number(db: Session, entity_type: str, prefix: str) -> str:
    """
    Atomically generates a transaction-safe sequential reference number.
    Format: {PREFIX}-{YEAR}-{0001}
    Example: QT-2026-0001, CT-2026-0001, SO-2026-0001
    """
    current_year = datetime.now(timezone.utc).year

    # Try to fetch with row locking if supported by dialect
    try:
        seq = (
            db.query(NumberSequence)
            .filter(NumberSequence.entity_type == entity_type, NumberSequence.year == current_year)
            .with_for_update()
            .first()
        )
    except Exception:
        # Fallback for SQLite which doesn't support with_for_update
        seq = (
            db.query(NumberSequence)
            .filter(NumberSequence.entity_type == entity_type, NumberSequence.year == current_year)
            .first()
        )

    if not seq:
        seq = NumberSequence(
            entity_type=entity_type,
            year=current_year,
            current_val=1,
            prefix=prefix,
        )
        db.add(seq)
        db.flush()
        val = 1
    else:
        seq.current_val += 1
        db.flush()
        val = seq.current_val

    return f"{prefix}-{current_year}-{val:04d}"
