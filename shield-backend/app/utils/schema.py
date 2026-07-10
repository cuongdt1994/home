"""Pydantic schema for validating DeepSeek API responses."""

from pydantic import BaseModel, Field, field_validator


class DeepSeekDecision(BaseModel):
    """Validated DeepSeek AI classification response."""

    is_malicious: bool = Field(..., description="Whether the IP is likely malicious")
    risk_score: int = Field(
        ...,
        ge=0,
        le=10,
        description="Risk score from 0 (safe) to 10 (definitely malicious)",
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=1024,
        description="Short, specific reason based on the provided event summary",
    )

    @field_validator("risk_score")
    @classmethod
    def validate_risk_score(cls, v: int) -> int:
        if not 0 <= v <= 10:
            raise ValueError(f"risk_score must be 0-10, got {v}")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("reason must not be empty")
        return v.strip()
