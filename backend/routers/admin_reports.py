"""Date-filtered admin reports."""
from datetime import date, datetime, time, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from routers.admin_customers import admin_session
from services.reporting import report

router = APIRouter(prefix="/api/admin/reports", tags=["Reports"])


@router.get("")
def get_report(start: date | None = None, end: date | None = None, admin=Depends(admin_session), db: Session = Depends(get_db)):
    if start and end and start > end:
        raise HTTPException(422, "Start date must be on or before end date.")
    if end == date.max:
        raise HTTPException(422, "End date is out of range.")
    return report(db,
        datetime.combine(start, time.min, timezone.utc) if start else None,
        datetime.combine(end + timedelta(days=1), time.min, timezone.utc) if end else None)
