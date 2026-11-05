from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .security import (
    normalize_security_answer,
    sanitize_json,
    sanitize_text,
    validate_pin_format,
)


Language = Literal[
    "en",
    "pcm",
    "yo",
    "ha",
    "ig",
]

STORE_COLLECTION_KEYS = (
    "products",
    "sales",
    "expenses",
    "debts",
    "customers",
    "invoices",
)


class RegistrationStart(BaseModel):
    phone: str

    firstName: str = Field(
        min_length=1,
        max_length=80,
    )

    lastName: str = Field(
        min_length=1,
        max_length=80,
    )

    otherName: str = ""

    pin: str | None = None
    password: str | None = None

    securityQuestion: str = Field(
        min_length=5,
        max_length=255,
    )

    securityAnswer: str = Field(
        min_length=2,
        max_length=160,
    )

    preferredLanguage: Language = "en"

    @field_validator("firstName", "lastName")
    @classmethod
    def _clean_required_name(cls, v: str) -> str:
        cleaned = sanitize_text(v, 80)
        if not cleaned:
            raise ValueError("Name cannot be empty.")
        return cleaned

    @field_validator("otherName")
    @classmethod
    def _clean_optional_name(cls, v: str) -> str:
        return sanitize_text(v or "", 80)

    @field_validator("securityQuestion")
    @classmethod
    def _clean_security_question(cls, v: str) -> str:
        cleaned = sanitize_text(v, 255)
        if len(cleaned) < 5:
            raise ValueError("Choose or enter a valid security question.")
        return cleaned

    @field_validator("securityAnswer")
    @classmethod
    def _clean_security_answer(cls, v: str) -> str:
        return normalize_security_answer(v)

    @model_validator(mode="after")
    def _validate_pin(self) -> "RegistrationStart":
        raw = self.pin if self.pin is not None else self.password
        validated = validate_pin_format(raw or "")
        self.pin = validated
        self.password = validated
        return self

    @property
    def pin_value(self) -> str:
        return self.pin or self.password or ""


class OtpVerify(BaseModel):
    challengeId: str

    code: str = Field(
        min_length=4,
        max_length=8,
    )


class LoginRequest(BaseModel):
    identifier: str | None = None
    phone: str | None = None

    pin: str | None = None
    password: str | None = None

    @model_validator(mode="after")
    def _validate_login_pin(self) -> "LoginRequest":
        raw = self.pin if self.pin is not None else self.password
        validated = validate_pin_format(raw or "")
        self.pin = validated
        self.password = validated
        return self

    @property
    def login_identifier(self) -> str:
        return sanitize_text(self.identifier or self.phone or "", 64)

    @property
    def pin_value(self) -> str:
        return self.pin or self.password or ""


class RecoveryQuestionRequest(BaseModel):
    identifier: str | None = None
    phone: str | None = None
    preferredLanguage: Language = "en"

    @property
    def lookup_identifier(self) -> str:
        return sanitize_text(self.identifier or self.phone or "", 64)


class RecoveryVerifyAnswerRequest(BaseModel):
    identifier: str | None = None
    phone: str | None = None
    securityAnswer: str = Field(min_length=2, max_length=160)

    @field_validator("securityAnswer")
    @classmethod
    def _clean_answer(cls, v: str) -> str:
        return normalize_security_answer(v)

    @property
    def lookup_identifier(self) -> str:
        return sanitize_text(self.identifier or self.phone or "", 64)


class RecoveryResetPinRequest(BaseModel):
    recoveryToken: str | None = None
    identifier: str | None = None
    phone: str | None = None
    securityAnswer: str | None = None
    newPin: str | None = None
    newPassword: str | None = None

    @model_validator(mode="after")
    def _validate_reset_pin(self) -> "RecoveryResetPinRequest":
        raw_pin = self.newPin if self.newPin is not None else self.newPassword
        validated = validate_pin_format(raw_pin or "")
        self.newPin = validated
        self.newPassword = validated
        if not self.recoveryToken and not (
            (self.identifier or self.phone) and self.securityAnswer
        ):
            raise ValueError(
                "Provide a valid recovery token or your phone/OjaTag and security answer."
            )
        return self

    @property
    def lookup_identifier(self) -> str:
        return sanitize_text(self.identifier or self.phone or "", 64)

    @property
    def pin_value(self) -> str:
        return self.newPin or self.newPassword or ""


class UpdateSecurityQuestionRequest(BaseModel):
    currentPin: str | None = None
    currentPassword: str | None = None
    securityQuestion: str = Field(min_length=5, max_length=255)
    securityAnswer: str = Field(min_length=2, max_length=160)
    preferredLanguage: Language | None = None

    @field_validator("securityQuestion")
    @classmethod
    def _clean_question(cls, v: str) -> str:
        cleaned = sanitize_text(v, 255)
        if len(cleaned) < 5:
            raise ValueError("Choose or enter a valid security question.")
        return cleaned

    @field_validator("securityAnswer")
    @classmethod
    def _clean_answer(cls, v: str) -> str:
        return normalize_security_answer(v)

    @model_validator(mode="after")
    def _validate_current_pin(self) -> "UpdateSecurityQuestionRequest":
        raw = (
            self.currentPin
            if self.currentPin is not None
            else self.currentPassword
        )
        validated = validate_pin_format(raw or "")
        self.currentPin = validated
        self.currentPassword = validated
        return self

    @property
    def pin_value(self) -> str:
        return self.currentPin or self.currentPassword or ""


class ForgotStart(BaseModel):
    phone: str


class ForgotVerify(BaseModel):
    challengeId: str

    code: str = Field(
        min_length=4,
        max_length=8,
    )

    newPin: str | None = None
    newPassword: str | None = None

    @model_validator(mode="after")
    def _validate_new_pin(self) -> "ForgotVerify":
        raw = self.newPin if self.newPin is not None else self.newPassword
        validated = validate_pin_format(raw or "")
        self.newPin = validated
        self.newPassword = validated
        return self


class ProfilePayload(BaseModel):
    uid: str
    ojaTag: str = ""
    phoneNumber: str
    firstName: str
    lastName: str
    otherName: str | None = ""
    preferredLanguage: Language = "en"
    onboardingCompleted: bool = False
    businessProfileCompleted: bool = False
    securityQuestion: str | None = None

    @field_validator("firstName", "lastName")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        cleaned = sanitize_text(v, 80)
        if not cleaned:
            raise ValueError("Name cannot be empty.")
        return cleaned

    @field_validator("otherName")
    @classmethod
    def _clean_other(cls, v: str | None) -> str:
        return sanitize_text(v or "", 80)


class BusinessPayload(BaseModel):
    businessName: str
    category: str
    phone: str
    address: str
    currency: str = "NGN"

    @field_validator("businessName", "category", "phone", "address", "currency")
    @classmethod
    def _clean_business_field(cls, v: str) -> str:
        return sanitize_text(v, 255)


class SaveProfileRequest(BaseModel):
    profile: ProfilePayload
    business: BusinessPayload | None = None


class VerifyPasswordRequest(BaseModel):
    pin: str | None = None
    password: str | None = None

    @model_validator(mode="after")
    def _validate_verify_pin(self) -> "VerifyPasswordRequest":
        raw = self.pin if self.pin is not None else self.password
        validated = validate_pin_format(raw or "")
        self.pin = validated
        self.password = validated
        return self

    @property
    def pin_value(self) -> str:
        return self.pin or self.password or ""


class ChangePasswordRequest(BaseModel):
    currentPin: str | None = None
    currentPassword: str | None = None
    newPin: str | None = None
    newPassword: str | None = None

    @model_validator(mode="after")
    def _validate_change_pin(self) -> "ChangePasswordRequest":
        cur_raw = (
            self.currentPin
            if self.currentPin is not None
            else self.currentPassword
        )
        new_raw = self.newPin if self.newPin is not None else self.newPassword
        cur_val = validate_pin_format(cur_raw or "")
        new_val = validate_pin_format(new_raw or "")
        self.currentPin = cur_val
        self.currentPassword = cur_val
        self.newPin = new_val
        self.newPassword = new_val
        return self


class DeleteAccountRequest(BaseModel):
    pin: str | None = None
    password: str | None = None

    confirmation: str = Field(
        min_length=1,
        max_length=80,
    )

    @model_validator(mode="after")
    def _validate_delete_pin(self) -> "DeleteAccountRequest":
        raw = self.pin if self.pin is not None else self.password
        validated = validate_pin_format(raw or "")
        self.pin = validated
        self.password = validated
        return self


class StorePayload(BaseModel):
    data: dict[str, Any]
    version: int = 0

    @field_validator("data")
    @classmethod
    def _sanitize_store_data(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(v, dict):
            raise ValueError("Store data must be an object.")
        sanitized = sanitize_json(v)
        normalized: dict[str, list[Any]] = {}
        for key in STORE_COLLECTION_KEYS:
            items = sanitized.get(key, []) if isinstance(sanitized, dict) else []
            normalized[key] = items if isinstance(items, list) else []
        return normalized


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=2000,
    )

    context: dict[str, Any] = Field(default_factory=dict)
    business: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)
    preferredLanguage: Language = "en"

    @field_validator("message")
    @classmethod
    def _clean_message(cls, v: str) -> str:
        cleaned = sanitize_text(v, 2000)
        if not cleaned:
            raise ValueError("Message cannot be empty.")
        return cleaned

    @field_validator("context", "business")
    @classmethod
    def _clean_dict(cls, v: dict[str, Any]) -> dict[str, Any]:
        res = sanitize_json(v)
        return res if isinstance(res, dict) else {}


class SupportRequest(BaseModel):
    category: str = Field(
        min_length=1,
        max_length=80,
    )

    subject: str = Field(
        min_length=2,
        max_length=180,
    )

    message: str = Field(
        min_length=5,
        max_length=5000,
    )

    @field_validator("category", "subject", "message")
    @classmethod
    def _clean_support(cls, v: str) -> str:
        return sanitize_text(v, 5000)


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=4, max_length=128)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        return sanitize_text(v, 160).lower()


class AdminResetUserPinRequest(BaseModel):
    newPin: str = Field(min_length=4, max_length=4)

    @field_validator("newPin")
    @classmethod
    def _clean_new_pin(cls, v: str) -> str:
        return validate_pin_format(v)


class AdminUpdateUserStatusRequest(BaseModel):
    isActive: bool


class AdminTicketReplyRequest(BaseModel):
    reply: str = Field(min_length=2, max_length=5000)
    status: Literal["open", "answered", "closed"] = "answered"

    @field_validator("reply")
    @classmethod
    def _clean_reply(cls, v: str) -> str:
        cleaned = sanitize_text(v, 5000)
        if len(cleaned) < 2:
            raise ValueError("Reply must be at least 2 characters.")
        return cleaned
