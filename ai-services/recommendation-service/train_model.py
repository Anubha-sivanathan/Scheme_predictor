"""
Trains a Gradient Boosting (XGBoost) model used to RANK/SCORE how well a
citizen profile matches a scheme's typical beneficiary profile.

IMPORTANT: This model does NOT decide eligibility. Eligibility is decided
by the deterministic rule engine in the Spring Boot backend. This model
only learns to prioritize/rank schemes for recommendation ordering, using
labelled examples of (profile features, scheme category) -> was this a
good match.

Since we don't have real historical application data at project-start,
this script generates a realistic synthetic training set from common-sense
socio-economic patterns (e.g. students match education schemes, farmers
match agriculture schemes, low income matches financial assistance, etc).
Replace generate_synthetic_dataset() with real labelled data once the
application has collected genuine usage feedback.
"""

import numpy as np
import joblib
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight

CATEGORIES = [
    "Education", "Agriculture", "Healthcare", "Housing", "Employment",
    "Women & Child Welfare", "Financial Assistance", "Disability Support",
    "Senior Citizens",
]

FEATURE_NAMES = [
    "age", "income_lakhs", "family_size", "land_holding_acres",
    "is_student", "is_farmer", "is_senior_citizen", "has_disability",
    "is_female", "education_level_code",  # 0=none/primary,1=secondary,2=graduate,3=postgrad
]


def _sample_profile(rng):
    age = rng.integers(5, 85)
    income_lakhs = round(rng.uniform(0.2, 15), 2)
    family_size = rng.integers(1, 9)
    land = round(rng.exponential(1.5), 2) if rng.random() < 0.35 else 0.0
    is_student = 1 if (age < 25 and rng.random() < 0.6) else 0
    is_farmer = 1 if (land > 0 and rng.random() < 0.8) else 0
    is_senior = 1 if age >= 60 else 0
    has_disability = 1 if rng.random() < 0.08 else 0
    is_female = rng.integers(0, 2)
    edu_level = rng.integers(0, 4)
    return [age, income_lakhs, family_size, land, is_student, is_farmer,
            is_senior, has_disability, is_female, edu_level]


def _label_for_profile(profile, rng):
    """Assigns the most plausible matching category for a synthetic profile,
    reflecting common-sense scheme targeting used by real welfare programs."""
    (age, income_lakhs, family_size, land, is_student, is_farmer,
     is_senior, has_disability, is_female, edu_level) = profile

    if has_disability and rng.random() < 0.7:
        return CATEGORIES.index("Disability Support")
    if is_senior and rng.random() < 0.6:
        return CATEGORIES.index("Senior Citizens")
    if is_student and income_lakhs < 6 and rng.random() < 0.7:
        return CATEGORIES.index("Education")
    if is_farmer and land > 0 and rng.random() < 0.7:
        return CATEGORIES.index("Agriculture")
    if is_female and age < 45 and rng.random() < 0.4:
        return CATEGORIES.index("Women & Child Welfare")
    if income_lakhs < 2.5 and rng.random() < 0.5:
        return CATEGORIES.index("Financial Assistance")
    if rng.random() < 0.25:
        return CATEGORIES.index("Housing")
    if age >= 21 and edu_level >= 1 and rng.random() < 0.3:
        return CATEGORIES.index("Employment")
    return CATEGORIES.index("Healthcare")


def generate_synthetic_dataset(n=6000, seed=42):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        profile = _sample_profile(rng)
        label = _label_for_profile(profile, rng)
        X.append(profile)
        y.append(label)
    return np.array(X, dtype=float), np.array(y)


def train_and_save(path="model.joblib"):
    X, y = generate_synthetic_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # XGBoost has no built-in class_weight="balanced" option (that's an
    # sklearn-ensemble-specific API), so we compute per-sample weights that
    # achieve the same effect: rarer classes get proportionally higher weight.
    sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)

    clf = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        num_class=len(CATEGORIES),
        eval_metric="mlogloss",
        random_state=42,
    )
    clf.fit(X_train, y_train, sample_weight=sample_weight)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("=" * 70)
    print("NOTE: This dataset is SYNTHETIC (rule-generated with randomness),")
    print("not real citizen/application history. These metrics describe how")
    print("well the model recovers the synthetic labelling logic, NOT")
    print("real-world recommendation accuracy. Replace generate_synthetic_dataset()")
    print("with real labelled data before treating these numbers as production metrics.")
    print("=" * 70)
    print(f"\nOverall accuracy on synthetic holdout set: {acc:.3f}\n")
    print("Per-class precision / recall / F1 (synthetic holdout):")
    print(classification_report(y_test, y_pred, target_names=CATEGORIES, zero_division=0))
    print("Confusion matrix (rows = true category, columns = predicted category):")
    print("Order:", CATEGORIES)
    print(confusion_matrix(y_test, y_pred))

    # Global feature importances, kept alongside the model so the
    # recommendation service can use them later for explanation text
    # (which features generally drive which category predictions).
    importances = dict(zip(FEATURE_NAMES, clf.feature_importances_.tolist()))

    joblib.dump(
        {
            "model": clf,
            "categories": CATEGORIES,
            "features": FEATURE_NAMES,
            "feature_importances": importances,
            "trained_on": "synthetic",
        },
        path,
    )
    print(f"\nModel saved to {path}")


if __name__ == "__main__":
    train_and_save()
