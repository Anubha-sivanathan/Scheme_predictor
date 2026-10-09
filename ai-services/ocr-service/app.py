"""
State Government Sponsored Scheme Eligibility Predictor Engine

OCR Microservice - Port 5002

Provides:
- GET  /health  -> Health check status
- POST /extract -> Extracts structured fields from uploaded document images/PDFs

Supported document types:
A) AADHAAR
B) INCOME_CERTIFICATE
C) CASTE_CERTIFICATE / COMMUNITY_CERTIFICATE
D) RESIDENCE_CERTIFICATE / NATIVITY_CERTIFICATE
E) RATION_CARD / FAMILY_CARD
F) EDUCATION / EDUCATION_CERTIFICATE / STUDENT_CERTIFICATE
G) DISABILITY / DISABILITY_CERTIFICATE
H) LAND / LAND_DOCUMENT / PATTA_CHITTA
I) EMPLOYMENT / EMPLOYMENT_DOCUMENT / LABOUR_DOCUMENT
J) BANK_PASSBOOK
"""

import os
import re
import tempfile
import logging

from flask import Flask, request, jsonify


# =========================================================
# FLASK APP
# =========================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

app = Flask(__name__)

_reader = None


# =========================================================
# EASY OCR LAZY INITIALIZATION
# =========================================================

def get_reader():
    """Lazily load EasyOCR reader."""
    global _reader

    if _reader is None:
        import easyocr

        logger.info("Initializing EasyOCR reader (English)...")
        _reader = easyocr.Reader(["en"], gpu=False)

    return _reader


def extract_raw_text(image_path):
    """Extract raw text from uploaded image/PDF using EasyOCR."""

    reader = get_reader()

    results = reader.readtext(
        image_path,
        detail=0
    )

    return "\n".join(results)


# =========================================================
# OCR CLEANING & CORRECTION HELPERS
# =========================================================

def clean_ocr_text(text):
    """Normalize whitespace while preserving line structure."""

    if not text:
        return ""

    lines = [
        re.sub(r"[ \t]+", " ", line).strip()
        for line in text.splitlines()
    ]

    return "\n".join(
        line for line in lines if line
    )


def fix_numeric_ocr(text):
    """
    Safely fix common OCR digit misreads.
    """

    if not text:
        return ""

    mapping = {
        "O": "0",
        "o": "0",
        "I": "1",
        "l": "1",
        "|": "1",
        "i": "1",
        "S": "5",
        "s": "5",
        "B": "8",
        "Z": "2",
        "z": "2",
    }

    return "".join(
        mapping.get(c, c)
        for c in text
    )


def fix_ifsc_code(code_str):
    """
    Validate and fix 11-character Indian IFSC code.
    """

    if not code_str:
        return None

    cleaned = re.sub(
        r"[^A-Za-z0-9]",
        "",
        code_str
    ).upper()

    if len(cleaned) != 11:
        return None

    bank_code = cleaned[:4]
    branch_code = cleaned[5:]

    fixed = bank_code + "0" + branch_code

    if re.match(
        r"^[A-Z]{4}0[A-Z0-9]{6}$",
        fixed
    ):
        return fixed

    return None


def extract_date(text):
    """
    Extract dates in:
    DD/MM/YYYY
    DD-MM-YYYY
    DD.MM.YYYY
    YYYY-MM-DD
    """

    patterns = [
        r"\b([0-3]?\d[/-][0-1]?\d[/-](?:19|20)\d{2})\b",
        r"\b((?:19|20)\d{2}[/-][0-1]?\d[/-][0-3]?\d)\b",
        r"\b([0-3]?\d\.[0-1]?\d\.(?:19|20)\d{2})\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:

            raw = match.group(1)

            return raw.replace(
                ".",
                "/"
            )

    return None


def extract_certificate_number(text):
    """
    Find common certificate/application numbers.
    """

    patterns = [
        r"(?:Certificate\s+(?:No|Number)|"
        r"Cert\s+No|"
        r"Application\s+(?:No|Number)|"
        r"Ref\s+No)"
        r"\s*[:\-]?\s*([A-Za-z0-9/\-]+)",

        r"\b(TN[\-/]?\d{4,}[A-Za-z0-9/\-]*)\b",

        r"\b([A-Z]{2,4}/\d{4}/\d{4,})\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:

            value = match.group(1).strip()

            if (
                len(value) >= 5
                and not value.lower().startswith("date")
            ):
                return value

    return None


# =========================================================
# COMMON DISTRICTS
# =========================================================

COMMON_DISTRICTS = [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kanchipuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Trichy",
    "Tirunelveli",
    "Tirupathur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar",
]


def extract_district(text):
    """Extract district name with OCR error correction."""

    # Check known districts first
    for district in COMMON_DISTRICTS:
        if re.search(
            rf"\b{re.escape(district)}\b",
            text,
            re.IGNORECASE
        ):
            return district

    # Common OCR mistakes for district names
    ocr_corrections = {
        "cuimbalore": "Coimbatore",
        "coimbatoree": "Coimbatore",
        "coimbatore": "Coimbatore",
    }

    # Check text near the word District
    district_context = re.findall(
        r"(?:District|Dist)\s*[:\-]?\s*([A-Za-z]+)",
        text,
        re.IGNORECASE
    )

    for candidate in district_context:
        cleaned = candidate.strip()
        corrected = ocr_corrections.get(
            cleaned.lower(),
            cleaned
        )

        if corrected.lower() in [
            d.lower() for d in COMMON_DISTRICTS
        ]:
            for district in COMMON_DISTRICTS:
                if district.lower() == corrected.lower():
                    return district

    # Pattern: District name before "District"
    before_match = re.search(
        r"\b([A-Z][A-Za-z]{3,20})\s+District\b",
        text,
        re.IGNORECASE
    )

    if before_match:
        candidate = before_match.group(1).strip()

        corrected = ocr_corrections.get(
            candidate.lower(),
            candidate
        )

        if corrected.lower() in [
            d.lower() for d in COMMON_DISTRICTS
        ]:
            for district in COMMON_DISTRICTS:
                if district.lower() == corrected.lower():
                    return district

    return None


def extract_taluk(text):
    """
    Extract Taluk name.

    Important:
    Stops before District, Village, Date,
    Certificate, Address, This, etc.
    """

    patterns = [
        r"\bTaluk\s*[:\-]?\s*"
        r"([A-Za-z][A-Za-z ]{1,40}?)"
        r"(?=[.,;]|\s+(?:District|Village|Date|Certificate|"
        r"Address|State|This|This\s+certificate)\b|$)",

        r"\bTaluka\s*[:\-]?\s*"
        r"([A-Za-z][A-Za-z ]{1,40}?)"
        r"(?=[.,;]|\s+(?:District|Village|Date|Certificate|"
        r"Address|State|This|This\s+certificate)\b|$)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:

            value = match.group(1).strip()

            value = re.split(
                r"\s+\b(?:This|certificate|is|issued)\b",
                value,
                maxsplit=1,
                flags=re.IGNORECASE
            )[0].strip(" ,.-;")

            if (
                len(value) >= 3
                and not re.search(
                    r"(officer|tahsildar|certificate)",
                    value,
                    re.IGNORECASE
                )
            ):
                return value.title()

    return None


# =========================================================
# A) AADHAAR PARSER
# =========================================================

def parse_aadhaar(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    lines = [
        line.strip()
        for line in clean.splitlines()
        if line.strip()
    ]

    # 1. Aadhaar Number

    aadhaar_match = re.search(
        r"\b(\d{4}\s?\d{4}\s?\d{4})\b",
        single_line
    )

    if aadhaar_match:

        fields["aadhaarNumber"] = (
            aadhaar_match
            .group(1)
            .replace(" ", "")
        )

    # 2. Date of Birth

    dob_match = re.search(
        r"(?:DOB|D\.O\.B|Date\s+of\s+Birth|Birth)"
        r"\s*[:\-]?\s*"
        r"([0-3]?\d[/-][0-1]?\d[/-](?:19|20)\d{2})",
        single_line,
        re.IGNORECASE
    )

    if dob_match:

        fields["dateOfBirth"] = dob_match.group(1)

    else:

        raw_date = extract_date(
            single_line
        )

        if raw_date:
            fields["dateOfBirth"] = raw_date

    # 3. Year of Birth

    yob_match = re.search(
        r"(?:Year\s+of\s+Birth|YOB)"
        r"\s*[:\-]?\s*((?:19|20)\d{2})",
        single_line,
        re.IGNORECASE
    )

    if yob_match:

        fields["yearOfBirth"] = yob_match.group(1)

    elif "dateOfBirth" in fields:

        year_match = re.search(
            r"((?:19|20)\d{2})$",
            fields["dateOfBirth"]
        )

        if year_match:
            fields["yearOfBirth"] = (
                year_match.group(1)
            )

    # 4. Gender

    if re.search(
        r"\b(?:Female|பெண்)\b",
        single_line,
        re.IGNORECASE
    ):
        fields["gender"] = "Female"

    elif re.search(
        r"\b(?:Male|ஆண்)\b",
        single_line,
        re.IGNORECASE
    ):
        fields["gender"] = "Male"

    elif re.search(
        r"\bTransgender\b",
        single_line,
        re.IGNORECASE
    ):
        fields["gender"] = "Other"

    # 5. Name

    name_match = re.search(
        r"\bName\b\s*[:\-]?\s*"
        r"([A-Za-z][A-Za-z .]{1,50}?)"
        r"(?=\s+(?:DOB|D\.O\.B|Date|Gender|Male|"
        r"Female|Address|UID|VID)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        candidate = name_match.group(1).strip()

        candidate = re.sub(
            r"\s+(?:TH|fart|frt|art|TH\s+fart)\b.*$",
            "",
            candidate,
            flags=re.IGNORECASE
        ).strip()

        if (
            2 <= len(candidate) <= 50
            and not re.search(
                r"(government|india|authority|aadhaar)",
                candidate,
                re.IGNORECASE
            )
        ):
            fields["name"] = candidate

    # Fallback name

    if "name" not in fields:

        for line in lines:

            if re.search(
                r"\bName\b",
                line,
                re.IGNORECASE
            ):

                candidate = re.sub(
                    r"(?i)^.*?\bName\b\s*[:\-]?\s*",
                    "",
                    line
                ).strip()

                candidate = re.sub(
                    r"\s+(?:TH|fart|frt|art)\b.*$",
                    "",
                    candidate,
                    flags=re.IGNORECASE
                ).strip()

                if 2 <= len(candidate) <= 50:

                    fields["name"] = candidate
                    break

    # 6. Address

    address_match = re.search(
        r"\bAddress\b\s*[:\-]?\s*(.*?)"
        r"(?=\s+\b(?:Aadhaar|UID|VID|DOB|Gender|"
        r"HelpLine)\b|"
        r"\s+\d{4}\s+\d{4}\s+\d{4}\b|$)",
        single_line,
        re.IGNORECASE
    )

    if address_match:

        address = re.sub(
            r"\s+",
            " ",
            address_match.group(1)
        ).strip()

        if len(address) >= 5:
            fields["address"] = address

    # 7. State

    if re.search(
        r"\bTamil\s+Nadu\b",
        single_line,
        re.IGNORECASE
    ):
        fields["state"] = "Tamil Nadu"

    else:

        state_match = re.search(
            r"\b(Kerala|Karnataka|Andhra\s+Pradesh|"
            r"Telangana|Maharashtra)\b",
            single_line,
            re.IGNORECASE
        )

        if state_match:
            fields["state"] = (
                state_match.group(1).title()
            )

    # 8. District

    district = extract_district(
        single_line
    )

    if district:
        fields["district"] = district

    # 9. PIN Code

    pin_match = re.search(
        r"\b(?:PIN|Pincode|Pin\s+Code)"
        r"\s*[:\-]?\s*([1-9]\d{5})\b",
        single_line,
        re.IGNORECASE
    )

    if pin_match:

        fields["pinCode"] = (
            pin_match.group(1)
        )

    else:

        pin_candidates = re.findall(
            r"\b[1-9]\d{5}\b",
            single_line
        )

        if pin_candidates:
            fields["pinCode"] = (
                pin_candidates[-1]
            )

    # 10. Mobile Number

    mobile_match = re.search(
        r"(?:Mobile|Mob|Phone|Cell)"
        r"\s*[:\-]?\s*"
        r"(?:\+?91[\s\-]?)?"
        r"([6-9]\d{9})\b",
        single_line,
        re.IGNORECASE
    )

    if mobile_match:
        fields["mobileNumber"] = (
            mobile_match.group(1)
        )

    return fields


# =========================================================
# B) INCOME CERTIFICATE PARSER
# =========================================================

def parse_income_certificate(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    lines = [
        line.strip()
        for line in clean.splitlines()
        if line.strip()
    ]

    # 1. Name of Applicant

    name_match = re.search(
        r"(?:Name\s+of\s+the\s+Applicant|"
        r"Applicant\s+Name|Applicant)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z][A-Za-z .]{1,50}?)"
        r"(?=\s+(?:Father|Father's|Husband|Address|"
        r"Annual|Income|Financial|Certificate|Date|"
        r"District|Taluk)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        name = name_match.group(1).strip()

        if 2 <= len(name) <= 50:
            fields["name"] = name

    # Fallback Name

    if "name" not in fields:

        for line in lines:

            match = re.search(
                r"(?:Name\s+of\s+the\s+Applicant|"
                r"Applicant\s+Name)"
                r"\s*[:\-]?\s*(.+)",
                line,
                re.IGNORECASE
            )

            if match:

                name = match.group(1).strip()

                name = re.split(
                    r"\b(?:Father|Father's|Husband|Address|"
                    r"Annual|Income)\b",
                    name,
                    flags=re.IGNORECASE
                )[0].strip()

                if 2 <= len(name) <= 50:

                    fields["name"] = name
                    break

    # 2. Annual Family Income

    income_match = re.search(
        r"(?:Annual\s+Family\s+Income|"
        r"Family\s+Annual\s+Income|"
        r"Annual\s+Income|Family\s+Income|"
        r"income\s+from\s+all\s+sources)"
        r"(?:\s+(?:from\s+all\s+sources|is|of))*"
        r"\s*[:\-]?\s*"
        r"(?:Rs\.?|INR|₹)?\s*([\d,]+)",
        single_line,
        re.IGNORECASE
    )

    if income_match:

        income = (
            income_match
            .group(1)
            .replace(",", "")
            .strip()
        )

        if (
            income.isdigit()
            and int(income) >= 1000
        ):
            fields["annualIncome"] = income

    if "annualIncome" not in fields:

        fallback_income = re.search(
            r"(?:Rs\.?|INR|₹)\s*([\d,]+)(?:\s*/-)?",
            single_line,
            re.IGNORECASE
        )

        if fallback_income:

            inc = fallback_income.group(1).replace(",", "").strip()

            if inc.isdigit() and int(inc) >= 1000:
                fields["annualIncome"] = inc

    # 3. Financial Year

    year_match = re.search(
        r"(?:Financial\s+Year|F\.Y\.?)"
        r"\s*[:\-]?\s*"
        r"((?:20\d{2})\s*[-–]\s*(?:20\d{2}|\d{2}))",
        single_line,
        re.IGNORECASE
    )

    if year_match:

        fields["financialYear"] = re.sub(
            r"\s+",
            " ",
            year_match.group(1)
        ).strip()

    # Fallback Financial Year

    if "financialYear" not in fields:

        year_match = re.search(
            r"\b(20\d{2}\s*[-–]\s*(?:20\d{2}|\d{2}))\b",
            single_line
        )

        if year_match:
            fields["financialYear"] = (
                year_match.group(1).strip()
            )

    # 4. Certificate Number

    cert_no = extract_certificate_number(
        single_line
    )

    if cert_no:
        fields["certificateNumber"] = cert_no

    # 5. Issue Date

    date_match = re.search(
        r"(?:Date\s+of\s+Issue|Issue\s+Date)"
        r"\s*[:\-]?\s*"
        r"([0-3]?\d[/-][0-1]?\d[/-](?:19|20)\d{2})",
        single_line,
        re.IGNORECASE
    )

    if date_match:

        fields["issueDate"] = (
            date_match.group(1)
        )

    else:

        raw_date = extract_date(
            single_line
        )

        if raw_date:
            fields["issueDate"] = raw_date

    # 6. District

    district_match = re.search(
        r"\bDistrict\s*[:\-]?\s*"
        r"([A-Za-z ]{2,40})",
        single_line,
        re.IGNORECASE
    )

    if district_match:

        district = (
            district_match
            .group(1)
            .strip()
        )

        district = re.split(
            r"\b(?:Taluk|Village|Date|Certificate|Address)\b",
            district,
            flags=re.IGNORECASE
        )[0].strip()

        if district:
            fields["district"] = district

    else:

        district = extract_district(
            single_line
        )

        if district:
            fields["district"] = district

    # 7. Taluk
    #
    # IMPORTANT:
    # This block is INSIDE the function.
    # It prevents OCR output such as:
    # "Coimbatore This"
    # from being returned as the Taluk.

    taluk_match = re.search(
        r"\bTaluk\s*[:\-]?\s*"
        r"([A-Za-z][A-Za-z ]{1,40}?)"
        r"(?=[.,;]|\s+(?:District|Village|Date|Certificate|"
        r"Address|State|This|This\s+certificate)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if taluk_match:

        taluk = taluk_match.group(1).strip()

        taluk = re.split(
            r"\s+\b(?:This|certificate|is|issued)\b",
            taluk,
            maxsplit=1,
            flags=re.IGNORECASE
        )[0].strip(" ,.-;")

        if taluk:
            fields["taluk"] = taluk

    else:

        taluk = extract_taluk(
            single_line
        )

        if taluk:

            taluk = re.split(
                r"\s+\b(?:This|certificate|is|issued)\b",
                taluk,
                maxsplit=1,
                flags=re.IGNORECASE
            )[0].strip()

            if taluk:
                fields["taluk"] = taluk

    # 8. Address

    address_match = re.search(
        r"\bAddress\s*[:\-]?\s*(.*?)"
        r"(?=\s+\b(?:Annual\s+Family\s+Income|"
        r"Annual\s+Income|Financial\s+Year|"
        r"Certificate\s+Number|Date\s+of\s+Issue|"
        r"District|Taluk)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if address_match:

        address = re.sub(
            r"\s+",
            " ",
            address_match.group(1)
        ).strip()

        if len(address) >= 5:
            fields["address"] = address

    return fields


# =========================================================
# C) COMMUNITY / CASTE CERTIFICATE PARSER
# =========================================================

def parse_caste_certificate(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Name

    name_match = re.search(
        r"(?:Thiru|Tmt|Selvi|Mr\.|Ms\.|Shri|Smt\.?)"
        r"\s+"
        r"([A-Za-z][A-Za-z .]{2,50}?)"
        r"(\s+(?:son|daughter|wife|belongs|residing)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        candidate = name_match.group(1).strip()

        if len(candidate) >= 2:
            fields["name"] = candidate

    else:

        candidate_match = re.search(
            r"(?:Name\s+of\s+the\s+Applicant|Name)"
            r"\s*[:\-]?\s*"
            r"([A-Za-z .]{2,50})",
            single_line,
            re.IGNORECASE
        )

        if candidate_match:

            fields["name"] = (
                candidate_match
                .group(1)
                .strip()
            )

    # 2. Category

    category_patterns = [

        (
            r"\b(?:Most\s+Backward\s+Class|MBC)\b",
            "MBC"
        ),

        (
            r"\b(?:Backward\s+Class|BC)\b",
            "BC"
        ),

        (
            r"\b(?:Other\s+Backward\s+Class|OBC)\b",
            "OBC"
        ),

        (
            r"\b(?:Scheduled\s+Caste|SC)\b",
            "SC"
        ),

        (
            r"\b(?:Scheduled\s+Tribe|ST)\b",
            "ST"
        ),

        (
            r"\b(?:Economically\s+Weaker\s+Section|EWS)\b",
            "EWS"
        ),

        (
            r"\b(?:General|OC)\b",
            "General"
        ),
    ]

    for pattern, category in category_patterns:

        if re.search(
            pattern,
            single_line,
            re.IGNORECASE
        ):

            fields["category"] = category
            break

    # 3. Community

    community_match = re.search(
        r"(?:Community|Caste)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z ]{3,40}?)"
        r"(?=\s+(?:Community|Category|recognized|Government)|$)",
        single_line,
        re.IGNORECASE
    )

    if community_match:

        value = (
            community_match
            .group(1)
            .strip()
        )

        if not re.search(
            r"(certificate|backward|scheduled|class)",
            value,
            re.IGNORECASE
        ):
            fields["community"] = value

    # 4. Certificate Number

    cert_no = extract_certificate_number(
        single_line
    )

    if cert_no:
        fields["certificateNumber"] = cert_no

    # 5. Issue Date

    date_value = extract_date(
        single_line
    )

    if date_value:
        fields["issueDate"] = date_value

    # 6. District

    district = extract_district(
        single_line
    )

    if district:
        fields["district"] = district

    # 7. Taluk

    taluk = extract_taluk(
        single_line
    )

    if taluk:
        fields["taluk"] = taluk

    return fields


# =========================================================
# D) RESIDENCE / NATIVITY CERTIFICATE PARSER
# =========================================================

def parse_residence_certificate(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Name

    name_match = re.search(
        r"(?:Thiru|Tmt|Selvi|Mr\.|Ms\.|Shri|Smt\.?)"
        r"\s+"
        r"([A-Za-z][A-Za-z .]{2,50}?)"
        r"(\s+(?:is|residing|son|daughter|wife)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        candidate = name_match.group(1).strip()

        if len(candidate) >= 2:
            fields["name"] = candidate

    # 2. State

    if re.search(
        r"\bTamil\s+Nadu\b",
        single_line,
        re.IGNORECASE
    ):

        fields["state"] = "Tamil Nadu"

    else:

        state_match = re.search(
            r"(?:State)\s*[:\-]?\s*"
            r"([A-Za-z ]{3,30})",
            single_line,
            re.IGNORECASE
        )

        if state_match:

            fields["state"] = (
                state_match
                .group(1)
                .strip()
                .title()
            )

    # 3. District

    district = extract_district(
        single_line
    )

    if district:
        fields["district"] = district

    # 4. Taluk

    taluk = extract_taluk(
        single_line
    )

    if taluk:
        fields["taluk"] = taluk

    # 5. Village

    village_match = re.search(
        r"(?:Village|Town)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z ]{3,30})",
        single_line,
        re.IGNORECASE
    )

    if village_match:

        value = village_match.group(1).strip()

        value = re.split(
            r"(?:Taluk|District|PIN|,|\.)",
            value,
            flags=re.IGNORECASE
        )[0].strip()

        if value:
            fields["village"] = value.title()

    # 6. Address

    address_match = re.search(
        r"(?:residing\s+at|Address)"
        r"\s*[:\-]?\s*"
        r"(.{10,250}?)"
        r"(?=\s+(?:Certificate|Date|District|Village|Taluk)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if address_match:

        fields["address"] = re.sub(
            r"\s+",
            " ",
            address_match.group(1)
        ).strip()

    # 7. Certificate Number

    cert_no = extract_certificate_number(
        single_line
    )

    if cert_no:
        fields["certificateNumber"] = cert_no

    # 8. Issue Date

    date_value = extract_date(
        single_line
    )

    if date_value:
        fields["issueDate"] = date_value

    return fields


# =========================================================
# E) RATION / FAMILY CARD PARSER
# =========================================================

def parse_ration_card(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    lines = [
        line.strip()
        for line in clean.splitlines()
        if line.strip()
    ]

    # 1. Family Card Number

    card_match = re.search(
        r"(?:Card\s+(?:No|Number)|"
        r"Family\s+Card\s+No|அட்டை\s+எண்)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9/\-]+)",
        single_line,
        re.IGNORECASE
    )

    if card_match:

        raw_card = card_match.group(1).strip()

        if raw_card.isdigit():
            fields["familyCardNumber"] = (
                fix_numeric_ocr(raw_card)
            )
        else:
            fields["familyCardNumber"] = raw_card

    else:

        alternative = re.search(
            r"\b(\d{2}/[A-Z]/\d{7})\b",
            single_line
        )

        if alternative:
            fields["familyCardNumber"] = (
                alternative.group(1)
            )

    # 2. Card Type

    card_types = [
        "PHH-AAY",
        "NPHH-S",
        "AAY",
        "PHH",
        "NPHH",
    ]

    for card_type in card_types:

        if re.search(
            rf"\b{re.escape(card_type)}\b",
            single_line,
            re.IGNORECASE
        ):

            fields["cardType"] = card_type
            break

    # 3. Head of Family

    head_match = re.search(
        r"(?:Head\s+of\s+(?:the\s+)?Family|"
        r"Family\s+Head|குடும்பத்\s+தலைவர்)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z .]{2,50}?)"
        r"(?=\s+(?:Total|Members|Card|Address|FPS|Self|Wife)|$)",
        single_line,
        re.IGNORECASE
    )

    if head_match:

        fields["headOfFamily"] = (
            head_match
            .group(1)
            .strip()
        )

    # 4. Family Size

    size_match = re.search(
        r"(?:Family\s+Size|No\s+of\s+Members|"
        r"Total\s+Members|உறுப்பினர்கள்)"
        r"\s*[:\-]?\s*(\d{1,2})",
        single_line,
        re.IGNORECASE
    )

    if size_match:

        fields["familySize"] = str(
            int(size_match.group(1))
        )

    members = []
    relationships = []

    relationship_pattern = (
        r"\b(?:Self|Wife|Husband|Son|Daughter|"
        r"Father|Mother|Brother|Sister)\b"
    )

    for line in lines:

        relationship_match = re.search(
            relationship_pattern,
            line,
            re.IGNORECASE
        )

        if relationship_match:

            relationship = (
                relationship_match
                .group(0)
                .title()
            )

            relationships.append(
                relationship
            )

            name_part = re.sub(
                relationship_pattern,
                "",
                line,
                flags=re.IGNORECASE
            )

            name_clean = re.sub(
                r"[\d/.\-:]",
                "",
                name_part
            ).strip()

            if 2 <= len(name_clean) <= 40:
                members.append(name_clean)

    if members:

        fields["familyMembers"] = ", ".join(
            members[:8]
        )

        if "familySize" not in fields:
            fields["familySize"] = str(
                len(members)
            )

    if relationships:

        fields["relationships"] = ", ".join(
            relationships[:8]
        )

    # 5. Address / FPS

    address_match = re.search(
        r"(?:Address|FPS\s+Code|Shop)"
        r"\s*[:\-]?\s*"
        r"(.{10,250}?)"
        r"(?=\s+(?:Card|Members|Head)\b|$)",
        single_line,
        re.IGNORECASE
    )

    if address_match:

        fields["address"] = re.sub(
            r"\s+",
            " ",
            address_match.group(1)
        ).strip()

    return fields


# =========================================================
# F) EDUCATION / STUDENT CERTIFICATE PARSER
# =========================================================

def parse_education_certificate(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Student Name

    name_match = re.search(
        r"(?:Name\s+of\s+the\s+Student|"
        r"Student\s+Name|Name|"
        r"This\s+is\s+to\s+certify\s+that)"
        r"\s*[:\-]?\s*"
        r"(?:Mr\.|Ms\.|Selvi\s+)?"
        r"([A-Za-z][A-Za-z .]{2,50}?)"
        r"(?=\s+(?:is|has|bearing|son|daughter|"
        r"student|DOB|,)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        candidate = name_match.group(1).strip()

        if (
            len(candidate) >= 2
            and not re.search(
                r"(college|institution|university)",
                candidate,
                re.IGNORECASE
            )
        ):
            fields["name"] = candidate

    # 2. DOB

    dob_match = re.search(
        r"(?:DOB|D\.O\.B|Date\s+of\s+Birth|Birth)"
        r"\s*[:\-]?\s*"
        r"([0-3]?\d[/-][0-1]?\d[/-](?:19|20)\d{2})",
        single_line,
        re.IGNORECASE
    )

    if dob_match:

        fields["dateOfBirth"] = (
            dob_match.group(1)
        )

    else:

        date_value = extract_date(
            single_line
        )

        if date_value:
            fields["dateOfBirth"] = date_value

    # 3. Institution

    institution_match = re.search(
        r"(?:Institution|College|School|University)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9 .,&'\-]{5,80})",
        single_line,
        re.IGNORECASE
    )

    if institution_match:

        fields["institution"] = (
            institution_match
            .group(1)
            .strip()
        )

    else:

        institution_fallback = re.search(
            r"\b([A-Za-z ]{4,40}\s+"
            r"(?:College|University|Institute|"
            r"Higher\s+Secondary\s+School|Academy))\b",
            single_line,
            re.IGNORECASE
        )

        if institution_fallback:

            fields["institution"] = (
                institution_fallback
                .group(1)
                .strip()
            )

    # 4. Course

    course_match = re.search(
        r"(?:Course|Branch|Degree)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9 .,()\-]{2,50}?)"
        r"(?=\s+(?:during|academic|year|institution|,|$))",
        single_line,
        re.IGNORECASE
    )

    if not course_match:

        course_match = re.search(
            r"(?:Studying\s+in)"
            r"\s*[:\-]?\s*"
            r"([A-Za-z0-9 .,()\-]{2,50}?)"
            r"(?=\s+(?:during|academic|year|institution|,|$))",
            single_line,
            re.IGNORECASE
        )

    if course_match:

        fields["course"] = (
            course_match
            .group(1)
            .strip(" ,.-;")
        )

    else:

        degrees = [
            "B.E",
            "B.Tech",
            "B.Sc",
            "B.Com",
            "B.A",
            "BBA",
            "BCA",
            "MBBS",
            "BDS",
            "M.E",
            "M.Tech",
            "M.Sc",
            "M.Com",
            "M.A",
            "MBA",
            "MCA",
            "Ph.D",
            "Diploma",
            "HSC",
            "SSLC",
            "Class 10",
            "Class 12",
        ]

        for degree in degrees:

            if re.search(
                rf"\b{re.escape(degree)}\b",
                single_line,
                re.IGNORECASE
            ):

                fields["course"] = degree
                break

    # 5. Education Level

    if re.search(
        r"\b(?:Ph\.D|Doctorate|Doctor\s+of\s+Philosophy)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "Doctorate"

    elif re.search(
        r"\b(?:Post\s+Graduate|Master|M\.E|M\.Tech|M\.Sc|"
        r"M\.Com|M\.A|MBA|MCA)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "PG"

    elif re.search(
        r"\b(?:Under\s+Graduate|Bachelor|Degree|B\.E|B\.Tech|"
        r"B\.Sc|B\.Com|B\.A|BBA|BCA)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "UG"

    elif re.search(
        r"\b(?:Diploma|Polytechnic)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "Diploma"

    elif re.search(
        r"\b(?:Higher\s+Secondary|HSC|Plus\s+Two|12th|Class\s+12)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "Higher Secondary"

    elif re.search(
        r"\b(?:Secondary|SSLC|10th|Class\s+10)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["educationLevel"] = "Secondary"

    # 6. Year of Study

    year_study_match = re.search(
        r"\b(1st|2nd|3rd|4th|First|Second|Third|Fourth|Final)"
        r"\s+(?:Year|Yr|Semester|Sem)\b",
        single_line,
        re.IGNORECASE
    )

    if year_study_match:

        raw_year = (
            year_study_match
            .group(0)
            .title()
        )

        raw_year = re.sub(
            r"\b(\d+)(St|Nd|Rd|Th)\b",
            lambda match: (
                match.group(1)
                + match.group(2).lower()
            ),
            raw_year
        )

        fields["yearOfStudy"] = raw_year

    # 7. Student Status

    if re.search(
        r"\b(?:bonafide\s+student|regular\s+student|"
        r"currently\s+studying|enrolled|pursuing)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["studentStatus"] = "Enrolled"

    elif re.search(
        r"\b(?:completed|graduated|passed)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["studentStatus"] = "Completed"

    else:

        fields["studentStatus"] = "Enrolled"

    # 8. Academic Year

    academic_year_match = re.search(
        r"(?:Academic\s+Year|Year)"
        r"\s*[:\-]?\s*"
        r"((?:20\d{2})[-–](?:20\d{2}|\d{2}))",
        single_line,
        re.IGNORECASE
    )

    if academic_year_match:

        fields["academicYear"] = (
            academic_year_match
            .group(1)
        )

    return fields


# =========================================================
# G) DISABILITY CERTIFICATE PARSER
# =========================================================

def parse_disability_certificate(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Name

    name_match = re.search(
        r"(?:Name\s+of\s+the\s+Person|"
        r"Name\s+of\s+Beneficiary|Name)"
        r"\s*[:\-]?\s*"
        r"(?:Mr\.|Ms\.|Shri|Smt\.?)?"
        r"\s*"
        r"([A-Za-z][A-Za-z .]{2,50}?)"
        r"(?=\s+(?:son|daughter|wife|age|gender|"
        r"having|suffering|,)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        fields["name"] = (
            name_match
            .group(1)
            .strip()
        )

    # 2. Disability Type

    disability_types = [

        "Locomotor Disability",
        "Visual Impairment",
        "Blindness",
        "Low Vision",
        "Hearing Impairment",
        "Deaf",
        "Hard of Hearing",
        "Speech and Language",
        "Intellectual Disability",
        "Mental Illness",
        "Autism Spectrum Disorder",
        "Cerebral Palsy",
        "Muscular Dystrophy",
        "Chronic Neurological",
        "Multiple Disabilities",
        "Leprosy Cured",
        "Dwarfism",
        "Acid Attack Victim",
    ]

    for disability_type in disability_types:

        if re.search(
            rf"\b{re.escape(disability_type)}\b",
            single_line,
            re.IGNORECASE
        ):

            fields["disabilityType"] = (
                disability_type
            )
            break

    # 3. Disability Percentage

    percentage_match = re.search(
        r"(?:Disability\s+Percentage|"
        r"Percentage\s+of\s+Disability|"
        r"Disability\s+is)"
        r"\s*[:\-]?\s*(\d{1,3})\s*%",
        single_line,
        re.IGNORECASE
    )

    if percentage_match:

        fields["disabilityPercentage"] = (
            percentage_match.group(1)
        )

    else:

        percentage_alt = re.search(
            r"\b(\d{2,3})\s*%"
            r"\s*(?:disability|permanent|benchmark)",
            single_line,
            re.IGNORECASE
        )

        if percentage_alt:

            fields["disabilityPercentage"] = (
                percentage_alt.group(1)
            )

    # 4. UDID

    udid_match = re.search(
        r"(?:UDID\s+(?:No|Number|Card)|"
        r"Unique\s+Disability\s+ID)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9/\-]+)",
        single_line,
        re.IGNORECASE
    )

    if udid_match:

        fields["udid"] = (
            udid_match
            .group(1)
            .strip()
        )

    else:

        udid_direct = re.search(
            r"\b([A-Z]{2}\d{14,16})\b",
            single_line
        )

        if udid_direct:
            fields["udid"] = (
                udid_direct.group(1)
            )

    # 5. Issue Date

    date_value = extract_date(
        single_line
    )

    if date_value:
        fields["issueDate"] = date_value

    # 6. Validity

    if re.search(
        r"\bPermanent\b",
        single_line,
        re.IGNORECASE
    ):

        fields["validity"] = "Permanent"

    elif re.search(
        r"\b(?:Temporary|Valid\s+up\s+to)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["validity"] = "Temporary"

    # 7. Benchmark Disability

    if "disabilityPercentage" in fields:

        try:

            percentage = int(
                fields["disabilityPercentage"]
            )

            if percentage >= 40:
                fields["disabilityCategory"] = (
                    "Benchmark Disability"
                )

        except ValueError:
            pass

    return fields


# =========================================================
# H) LAND RECORDS PARSER
# =========================================================

def parse_land_document(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Owner Name

    owner_match = re.search(
        r"(?:Pattadhar\s+Name|Owner\s+Name|"
        r"பட்டாதாரர்\s+பெயர்)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z .]{2,50}?)"
        r"(?=\s+(?:Survey|Sub|Extent|Village|"
        r"Taluk|District|Land)|$)",
        single_line,
        re.IGNORECASE
    )

    if owner_match:

        fields["ownerName"] = (
            owner_match
            .group(1)
            .strip()
        )

    # 2. Survey Number

    survey_match = re.search(
        r"(?:Survey\s+No|Survey\s+Number|புல\s+எண்)"
        r"\s*[:\-]?\s*"
        r"([0-9]+[A-Za-z0-9/\-]*)",
        single_line,
        re.IGNORECASE
    )

    if survey_match:

        fields["surveyNumber"] = (
            survey_match
            .group(1)
            .strip()
        )

    # 3. Land Area

    area_match = re.search(
        r"(?:Extent|Area|பரப்பளவு|Land\s+Area)"
        r"\s*[:\-]?\s*"
        r"(\d+(?:\.\d+)?)"
        r"\s*"
        r"(Acres?|Cents?|Hectares?|Sq\.?\s*Ft|Hec|Acre)",
        single_line,
        re.IGNORECASE
    )

    if area_match:

        number = float(
            area_match.group(1)
        )

        unit = (
            area_match
            .group(2)
            .lower()
        )

        if (
            unit.endswith("s")
            and not unit.startswith("c")
        ):
            unit = unit[:-1]

        fields["landArea"] = (
            f"{number} {unit.title()}"
        )

        fields["unit"] = unit.title()

        if "hec" in unit:

            acres = round(
                number * 2.47105,
                2
            )

        elif "cent" in unit:

            acres = round(
                number / 100.0,
                2
            )

        elif "sq" in unit:

            acres = round(
                number / 43560.0,
                2
            )

        else:

            acres = round(
                number,
                2
            )

        fields["landHoldingAcres"] = str(
            acres
        )

    else:

        number_unit = re.search(
            r"\b(\d+(?:\.\d+)?)\s+"
            r"(Acres?|Cents?|Hectares?)\b",
            single_line,
            re.IGNORECASE
        )

        if number_unit:

            number = float(
                number_unit.group(1)
            )

            unit = (
                number_unit
                .group(2)
                .lower()
            )

            if (
                unit.endswith("s")
                and not unit.startswith("c")
            ):
                unit = unit[:-1]

            fields["landArea"] = (
                f"{number} {unit.title()}"
            )

            fields["unit"] = unit.title()

            if "hec" in unit:

                acres = round(
                    number * 2.47105,
                    2
                )

            elif "cent" in unit:

                acres = round(
                    number / 100.0,
                    2
                )

            else:

                acres = round(
                    number,
                    2
                )

            fields["landHoldingAcres"] = str(
                acres
            )

    # 4. Village

    village_match = re.search(
        r"(?:Village|கிராமம்)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z ]{3,30})",
        single_line,
        re.IGNORECASE
    )

    if village_match:

        fields["village"] = (
            village_match
            .group(1)
            .strip()
            .title()
        )

    # 5. Taluk

    taluk = extract_taluk(
        single_line
    )

    if taluk:
        fields["taluk"] = taluk

    # 6. District

    district = extract_district(
        single_line
    )

    if district:
        fields["district"] = district

    # 7. Land Type

    if re.search(
        r"\b(?:Wet\s+Land|Nanja|நன்செய்)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["landType"] = "Wet (Nanja)"

    elif re.search(
        r"\b(?:Dry\s+Land|Punja|புன்செய்)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["landType"] = "Dry (Punja)"

    # 8. Crop

    crop_match = re.search(
        r"(?:Crop\s+Cultivated|Crop|பயிர்)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z ]{3,30})",
        single_line,
        re.IGNORECASE
    )

    if crop_match:

        fields["crop"] = (
            crop_match
            .group(1)
            .strip()
            .title()
        )

        fields["cultivationStatus"] = (
            "Cultivated"
        )

    return fields


# =========================================================
# I) EMPLOYMENT / LABOUR DOCUMENT PARSER
# =========================================================

def parse_employment_document(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Name

    name_match = re.search(
        r"(?:Name\s+of\s+Worker|"
        r"Employee\s+Name|Name)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z .]{2,50}?)"
        r"(?=\s+(?:Occupation|Worker|Employer|Designation)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        fields["name"] = (
            name_match
            .group(1)
            .strip()
        )

    # 2. Occupation

    occupation_match = re.search(
        r"(?:Occupation|Trade|Designation|Nature\s+of\s+Work)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z ]{3,40}?)"
        r"(?=\s+(?:Worker|Employer|Category|Monthly|"
        r"Annual|Salary|e-Shram|UAN)|$)",
        single_line,
        re.IGNORECASE
    )

    if occupation_match:

        fields["occupation"] = (
            occupation_match
            .group(1)
            .strip()
            .title()
        )

    else:

        occupations = [
            "Farmer",
            "Agricultural Labourer",
            "Construction Worker",
            "Weaver",
            "Fisherman",
            "Carpenter",
            "Driver",
            "Tailor",
            "Electrician",
            "Shopkeeper",
            "Teacher",
        ]

        for occupation in occupations:

            if re.search(
                rf"\b{re.escape(occupation)}\b",
                single_line,
                re.IGNORECASE
            ):

                fields["occupation"] = occupation
                break

    # 3. Employment Status

    if re.search(
        r"\b(?:Unorganized|Unorganised|e-Shram)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["workerCategory"] = (
            "Unorganized Worker"
        )

        fields["employmentStatus"] = (
            "Daily Wage / Unorganized"
        )

    elif re.search(
        r"\bSelf\s+Employed\b",
        single_line,
        re.IGNORECASE
    ):

        fields["employmentStatus"] = (
            "Self-Employed"
        )

    elif re.search(
        r"\b(?:Salaried|Regular|Permanent\s+Employee)\b",
        single_line,
        re.IGNORECASE
    ):

        fields["employmentStatus"] = "Employed"
        fields["workerCategory"] = "Organized"

    elif re.search(
        r"\bStudent\b",
        single_line,
        re.IGNORECASE
    ):

        fields["employmentStatus"] = "Student"

    # 4. Employer

    employer_match = re.search(
        r"(?:Employer|Company|Establishment|Welfare\s+Board)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9 .,&'\-]{3,60})",
        single_line,
        re.IGNORECASE
    )

    if employer_match:

        fields["employer"] = (
            employer_match
            .group(1)
            .strip()
        )

    # 5. Monthly Income

    income_match = re.search(
        r"(?:Monthly\s+Income|Salary|Wages)"
        r"\s*[:\-]?\s*"
        r"(?:Rs\.?|INR|₹)?\s*([\d,]+)",
        single_line,
        re.IGNORECASE
    )

    if income_match:

        monthly_income = (
            income_match
            .group(1)
            .replace(",", "")
        )

        if monthly_income.isdigit():

            fields["monthlyIncome"] = (
                monthly_income
            )

            fields["annualIncome"] = str(
                int(monthly_income) * 12
            )

    # 6. Labour Registration

    uan_match = re.search(
        r"(?:UAN|Registration\s+(?:No|Number)|e-Shram\s+No)"
        r"\s*[:\-]?\s*"
        r"([0-9\s\-]{8,20})",
        single_line,
        re.IGNORECASE
    )

    if uan_match:

        raw_uan = re.sub(
            r"[^0-9]",
            "",
            uan_match.group(1)
        )

        if len(raw_uan) >= 8:

            fields["labourRegistrationDetails"] = (
                raw_uan
            )

    return fields


# =========================================================
# J) BANK PASSBOOK PARSER
# =========================================================

def parse_bank_passbook(text):

    fields = {}

    clean = clean_ocr_text(text)

    single_line = re.sub(
        r"\s+",
        " ",
        clean
    )

    # 1. Bank Name

    known_banks = [

        "State Bank of India",
        "Canara Bank",
        "Indian Bank",
        "Indian Overseas Bank",
        "HDFC Bank",
        "ICICI Bank",
        "Punjab National Bank",
        "Bank of Baroda",
        "Union Bank of India",
        "Axis Bank",
        "Tamilnad Mercantile Bank",
        "State Bank",
        "IOB",
        "SBI",
        "PNB",
        "TMB",
    ]

    for bank in known_banks:

        if re.search(
            rf"\b{re.escape(bank)}\b",
            single_line,
            re.IGNORECASE
        ):

            if bank in [
                "SBI",
                "State Bank"
            ]:
                fields["bankName"] = (
                    "State Bank of India"
                )
            else:
                fields["bankName"] = bank

            break

    if "bankName" not in fields:

        bank_match = re.search(
            r"\b([A-Za-z ]{3,30}\s+Bank)\b",
            single_line,
            re.IGNORECASE
        )

        if bank_match:

            fields["bankName"] = (
                bank_match
                .group(1)
                .strip()
            )

    # 2. Account Holder Name

    name_match = re.search(
        r"(?:Account\s+Holder|Name|A/c\s+Holder)"
        r"\s*[:\-]?\s*"
        r"(?:Mr\.|Ms\.|Mrs\.|Shri|Smt\.?)?"
        r"\s*"
        r"([A-Za-z][A-Za-z .]{2,50}?)"
        r"(?=\s+(?:Account|A/c|Branch|IFSC|Joint|,)|$)",
        single_line,
        re.IGNORECASE
    )

    if name_match:

        candidate = (
            name_match
            .group(1)
            .strip()
        )

        if (
            len(candidate) >= 2
            and not re.search(
                r"(bank|branch|manager)",
                candidate,
                re.IGNORECASE
            )
        ):
            fields["accountHolderName"] = candidate

    # 3. Account Number

    account_match = re.search(
        r"(?:Account\s+(?:No|Number)|"
        r"A/c\s+No|SB\s+A/c\s+No)"
        r"\s*[:\-]?\s*"
        r"([0-9\s]{9,22})\b",
        single_line,
        re.IGNORECASE
    )

    if account_match:

        cleaned_account = re.sub(
            r"\s+",
            "",
            account_match.group(1)
        )

        fields["accountNumber"] = (
            cleaned_account
        )

    else:

        account_alt = re.search(
            r"\b([0-9]{11,18})\b",
            single_line
        )

        if account_alt:

            fields["accountNumber"] = (
                account_alt.group(1)
            )

    # 4. IFSC

    ifsc_match = re.search(
        r"(?:IFSC|IFS\s+Code)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9]{11})\b",
        single_line,
        re.IGNORECASE
    )

    if ifsc_match:

        fixed = fix_ifsc_code(
            ifsc_match.group(1)
        )

        fields["ifsc"] = (
            fixed
            if fixed
            else ifsc_match.group(1).upper()
        )

    else:

        ifsc_direct = re.search(
            r"\b([A-Z]{4}0[A-Z0-9]{6})\b",
            single_line
        )

        if ifsc_direct:

            fields["ifsc"] = (
                ifsc_direct.group(1)
            )

    # 5. Branch

    branch_match = re.search(
        r"(?:Branch\s+Name|Branch)"
        r"\s*[:\-]?\s*"
        r"([A-Za-z0-9 ]{3,35}?)"
        r"(?=\s+(?:IFSC|MICR|Date|Phone|City|,)|$)",
        single_line,
        re.IGNORECASE
    )

    if branch_match:

        branch = (
            branch_match
            .group(1)
            .strip()
        )

        if (
            len(branch) >= 3
            and not re.search(
                r"(code|manager|bank)",
                branch,
                re.IGNORECASE
            )
        ):

            fields["branch"] = branch.title()

    return fields


# =========================================================
# DOCUMENT TYPE AUTO-DETECTION
# =========================================================

def detect_document_type(text):
    """
    Detect document type when documentType is OTHER
    or not supplied.
    """

    lower = text.lower()

    if (
        "aadhaar" in lower
        or "unique identification" in lower
        or "uidai" in lower
    ):
        return "AADHAAR"

    if (
        "income certificate" in lower
        or "annual income" in lower
        or "வருமானச்" in lower
    ):
        return "INCOME_CERTIFICATE"

    if (
        "community certificate" in lower
        or "caste certificate" in lower
        or "சாதிச்" in lower
        or "backward class" in lower
    ):
        return "CASTE_CERTIFICATE"

    if (
        "residence certificate" in lower
        or "nativity certificate" in lower
        or "இருப்பிடச்" in lower
    ):
        return "RESIDENCE_CERTIFICATE"

    if (
        "family card" in lower
        or "ration card" in lower
        or "குடும்ப அட்டை" in lower
        or "fair price shop" in lower
    ):
        return "RATION_CARD"

    if (
        "patta" in lower
        or "chitta" in lower
        or "adangal" in lower
        or "பட்டா" in lower
        or "survey no" in lower
    ):
        return "LAND"

    if (
        "disability" in lower
        or "udid" in lower
        or "differently abled" in lower
    ):
        return "DISABILITY"

    if (
        "passbook" in lower
        or "ifsc" in lower
        or "savings bank" in lower
        or "account number" in lower
    ):
        return "BANK_PASSBOOK"

    if (
        "bonafide" in lower
        or "degree certificate" in lower
        or "mark sheet" in lower
        or "student" in lower
    ):
        return "EDUCATION"

    if (
        "e-shram" in lower
        or "labour" in lower
        or "unorganized worker" in lower
    ):
        return "EMPLOYMENT"

    return "OTHER"


# =========================================================
# GENERIC PARSER
# =========================================================

def parse_generic(text):

    return {
        "rawTextPreview": text[:300]
    }


# =========================================================
# DOCUMENT PARSER REGISTRY
# =========================================================

PARSERS = {

    # Aadhaar
    "AADHAAR": parse_aadhaar,

    # Income
    "INCOME_CERTIFICATE": parse_income_certificate,

    # Caste / Community
    "CASTE_CERTIFICATE": parse_caste_certificate,
    "COMMUNITY_CERTIFICATE": parse_caste_certificate,

    # Residence / Nativity
    "RESIDENCE_CERTIFICATE": parse_residence_certificate,
    "NATIVITY_CERTIFICATE": parse_residence_certificate,

    # Ration / Family Card
    "RATION_CARD": parse_ration_card,
    "FAMILY_CARD": parse_ration_card,

    # Education / Student
    "EDUCATION": parse_education_certificate,
    "EDUCATION_CERTIFICATE": parse_education_certificate,
    "STUDENT_CERTIFICATE": parse_education_certificate,

    # Disability
    "DISABILITY": parse_disability_certificate,
    "DISABILITY_CERTIFICATE": parse_disability_certificate,

    # Land
    "LAND": parse_land_document,
    "LAND_DOCUMENT": parse_land_document,
    "PATTA_CHITTA": parse_land_document,

    # Employment / Labour
    "EMPLOYMENT": parse_employment_document,
    "EMPLOYMENT_DOCUMENT": parse_employment_document,
    "LABOUR_DOCUMENT": parse_employment_document,

    # Bank
    "BANK_PASSBOOK": parse_bank_passbook,
    "BANK": parse_bank_passbook,
}


# =========================================================
# FLASK REST ENDPOINTS
# =========================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({

        "status": "ok",

        "service": "ocr-service",

        "supportedDocumentTypes": sorted(
            list(PARSERS.keys())
        )
    })


@app.route("/extract", methods=["POST"])
def extract():

    # Check file
    if "file" not in request.files:

        return jsonify({
            "error": "No file provided"
        }), 400

    file = request.files["file"]

    # Get document type
    document_type = (
        request.form
        .get("documentType", "OTHER")
        .upper()
        .strip()
    )

    # Determine extension
    suffix = (
        os.path.splitext(
            file.filename or "upload"
        )[1]
        or ".jpg"
    )

    # Save temporary file
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    ) as tmp:

        file.save(tmp.name)

        tmp_path = tmp.name

    try:

        # OCR
        raw_text = extract_raw_text(
            tmp_path
        )

        # Auto-detect document type
        if (
            document_type == "OTHER"
            or document_type not in PARSERS
        ):

            detected = detect_document_type(
                raw_text
            )

            if detected != "OTHER":
                document_type = detected

        # Select parser
        parser = PARSERS.get(
            document_type,
            parse_generic
        )

        # Parse fields
        fields = parser(
            raw_text
        )

        logger.info(
            "Successfully processed %s OCR with %d fields extracted.",
            document_type,
            len(fields)
        )

        return jsonify({

            "documentType": document_type,

            "fields": fields
        })

    except Exception as error:

        logger.error(
            "OCR processing failed: %s",
            error
        )

        return jsonify({

            "error": (
                f"OCR processing failed: {error}"
            )

        }), 500

    finally:

        try:

            os.remove(
                tmp_path
            )

        except OSError:

            pass


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5002
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=True
    )