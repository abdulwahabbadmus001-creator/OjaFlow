from typing import Any, Literal
from pydantic import BaseModel, Field

Language = Literal["en", "pcm", "yo", "ha", "ig"]


class RegistrationStart(BaseModel):
    phone: str
    firstName: str = Field(min_length=1, max_length=80)
    lastName: str = Field(min_length=1, max_length=80)
    otherName: str = ""
    password: str = Field(min_length=8, max_length=200)
    preferredLanguage: Language = "en"


class OtpVerify(BaseModel):
    challengeId: str
    code: str = Field(min_length=4, max_length=8)


class LoginRequest(BaseModel):
    phone: str
    password: str


class ForgotStart(BaseModel):
    phone: str


class ForgotVerify(BaseModel):
    challengeId: str
    code: str = Field(min_length=4, max_length=8)
    newPassword: str = Field(min_length=8, max_length=200)


class ProfilePayload(BaseModel):
    uid: str
    phoneNumber: str
    firstName: str
    lastName: str
    otherName: str | None = ""
    preferredLanguage: Language = "en"
    onboardingCompleted: bool = False
    businessProfileCompleted: bool = False


class BusinessPayload(BaseModel):
    businessName: str
    category: str
    phone: str
    address: str
    currency: str = "NGN"


class SaveProfileRequest(BaseModel):
    profile: ProfilePayload
    business: BusinessPayload | None = None


class VerifyPasswordRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8, max_length=200)


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str = Field(min_length=1, max_length=80)


class StorePayload(BaseModel):
    data: dict[str, Any]
    version: int = 0


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: dict[str, Any] = Field(default_factory=dict)
    business: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)
    preferredLanguage: Language = "en"


class SupportRequest(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    subject: str = Field(min_length=2, max_length=180)
    message: str = Field(min_length=5, max_length=5000)
