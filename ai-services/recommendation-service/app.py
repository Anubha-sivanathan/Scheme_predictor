"""
Recommendation microservice.

Exposes POST /predict which takes a citizen profile and a list of scheme IDs
(with their categories, fetched by the caller) and returns a match-quality
score (0-100) per scheme, used ONLY for ranking/ordering recommendations.

This service never determines eligibility — that stays in the Spring Boot
rule engine. If this service is unreachable, the backend transparently
falls back to a simpler rule-based ranking, so the app keeps working.
"""

import os
from flask import Flask, request, jsonify
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")

app = Flask(__name__)
_bundle = None


def get_bundle():
    global _bundle
    if _bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                "model.joblib not found. Run `python train_model.py` first."
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


# Scheme category -> list of index positions in CATEGORIES used at training time.
# Kept here (not imported) so this file works standalone once a model exists.
CATEGORIES = [
    "Education", "Agriculture", "Healthcare", "Housing", "Employment",
    "Women & Child Welfare", "Financial Assistance", "Disability Support",
    "Senior Citizens",
]


def education_level_code(education):
    if not education:
        return 0
    e = education.lower()
    if "post" in e or "phd" in e or "master" in e:
        return 3
    if "graduate" in e or "bachelor" in e or "degree" in e:
        return 2
    if "secondary" in e or "high school" in e or "12" in e or "10" in e:
        return 1
    return 0


def profile_to_features(profile):
    age = profile.get("age") or 30
    income = profile.get("income") or 300000
    income_lakhs = income / 100000.0
    family_size = profile.get("familySize") or 4
    land = profile.get("landHoldingAcres") or 0.0
    is_student = 1 if profile.get("isStudent") else 0
    is_farmer = 1 if profile.get("isFarmer") else 0
    is_senior = 1 if profile.get("isSeniorCitizen") else 0
    has_disability = 1 if profile.get("disability") else 0
    is_female = 1 if (profile.get("gender") or "").lower() == "female" else 0
    edu_level = education_level_code(profile.get("education"))

    return np.array([[age, income_lakhs, family_size, land, is_student,
                       is_farmer, is_senior, has_disability, is_female, edu_level]], dtype=float)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    profile = data.get("profile") or {}
    scheme_categories = data.get("schemeCategories")  # optional: {schemeId: category}

    bundle = get_bundle()
    model = bundle["model"]
    categories = bundle["categories"]

    features = profile_to_features(profile)
    # predict_proba gives a probability per category — used as the base match score.
    probabilities = model.predict_proba(features)[0]
    category_scores = {categories[i]: float(probabilities[i]) for i in range(len(categories))}

    scores = {}
    if scheme_categories:
        for scheme_id, category in scheme_categories.items():
            base = category_scores.get(category, 0.05)
            # Scale probability (which sums to 1 across ~9 categories) into an
            # intuitive 0-100 "match percentage", with a floor so no scheme
            # reads as a suspicious 0%.
            scores[scheme_id] = round(min(99.0, max(15.0, base * 100 * 3.2)), 1)
    else:
        pass

    top_factors = []
    if profile.get("isStudent"):
        top_factors.append("Active student enrollment")
    if profile.get("isFarmer") or (profile.get("landHoldingAcres") or 0) > 0:
        top_factors.append("Agricultural land ownership / farmer status")
    if (profile.get("gender") or "").lower() == "female":
        top_factors.append("Female citizen targeting")
    if profile.get("disability"):
        top_factors.append("Registered disability beneficiary")
    if (profile.get("age") or 0) >= 60 or profile.get("isSeniorCitizen"):
        top_factors.append("Senior citizen category")
    if (profile.get("income") or 999999) <= 250000:
        top_factors.append("Low-income household category (<= ₹2.5L)")

    return jsonify({
        "scores": scores,
        "categoryBreakdown": category_scores,
        "topFactors": top_factors
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
