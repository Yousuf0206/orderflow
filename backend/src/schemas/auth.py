from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    organization_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class InviteAcceptRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class AccountDeleteRequest(BaseModel):
    # Names of the organizations the deletion closes, echoed from the preview.
    # Empty for a member whose organizations all carry on.
    confirm_organization_names: list[str] = Field(default_factory=list)
