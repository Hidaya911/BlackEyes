"""Public registration accepts buyer details, never roles or account status."""
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class WholesaleRegistration(BaseModel):
    model_config = ConfigDict(extra='forbid')
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: str = Field(min_length=3, max_length=50)
    address: str = Field(min_length=3, max_length=500)
    password: str = Field(min_length=8, max_length=72)
    business_name: str = Field(min_length=1, max_length=255)

    @field_validator('full_name', 'email', 'phone', 'address', 'business_name', mode='before')
    @classmethod
    def strip_contact(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode='after')
    def validate_details(self):
        self.email = self.email.lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', self.email):
            raise ValueError('Enter a valid email address.')
        if len(self.password.encode()) > 72:
            raise ValueError('Password must not exceed 72 UTF-8 bytes.')
        return self
