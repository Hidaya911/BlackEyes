"""System API endpoints and request/response definitions."""

from fastapi import APIRouter

router = APIRouter()


@router.get('/')
def read_root():
    return {'message': 'Connected to Cloud PostgreSQL successfully!'}
