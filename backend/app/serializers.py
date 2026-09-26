from .models import Business, User


def user_profile(user: User) -> dict:
    return {
        "uid": user.id,
        "phoneNumber": user.phone,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "otherName": user.other_name or "",
        "preferredLanguage": user.preferred_language,
        "onboardingCompleted": user.onboarding_completed,
        "businessProfileCompleted": user.business_profile_completed,
    }


def business_profile(business: Business | None) -> dict | None:
    if not business:
        return None
    return {
        "businessName": business.business_name,
        "category": business.category,
        "phone": business.phone,
        "address": business.address,
        "currency": business.currency,
    }
