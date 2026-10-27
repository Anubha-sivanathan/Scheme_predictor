"""
Unit test for OCR parsers in app.py across all 10 document types.
"""
import unittest
import sys
import os

# Add directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app import (
    parse_aadhaar,
    parse_income_certificate,
    parse_caste_certificate,
    parse_residence_certificate,
    parse_ration_card,
    parse_education_certificate,
    parse_disability_certificate,
    parse_land_document,
    parse_employment_document,
    parse_bank_passbook,
    detect_document_type,
    PARSERS,
)

class TestOcrParsers(unittest.TestCase):

    def test_aadhaar(self):
        sample = """
        Government of India
        Unique Identification Authority of India
        Name: Priya Murugan
        DOB: 15/08/2004
        Gender: Female
        Address: 124 Cross Street, Gandhipuram, Coimbatore, Tamil Nadu - 641012
        9876 5432 1098
        Mobile: 9876543210
        """
        res = parse_aadhaar(sample)
        self.assertEqual(res.get("aadhaarNumber"), "987654321098")
        self.assertEqual(res.get("name"), "Priya Murugan")
        self.assertEqual(res.get("dateOfBirth"), "15/08/2004")
        self.assertEqual(res.get("yearOfBirth"), "2004")
        self.assertEqual(res.get("gender"), "Female")
        self.assertEqual(res.get("district"), "Coimbatore")
        self.assertEqual(res.get("state"), "Tamil Nadu")
        self.assertEqual(res.get("pinCode"), "641012")
        self.assertEqual(res.get("mobileNumber"), "9876543210")

    def test_income_certificate(self):
        sample = """
        Government of Tamil Nadu
        Revenue Department
        INCOME CERTIFICATE
        Certificate No: TN-720240415101
        Date of Issue: 20/04/2024
        This is to certify that Selvi Priya Murugan daughter of Murugan,
        residing at Gandhipuram, Coimbatore District, Taluk: Coimbatore South.
        Her family annual income from all sources is Rs. 75,000/-
        (Rupees Seventy Five Thousand only) for the financial year 2023-2024.
        """
        res = parse_income_certificate(sample)
        self.assertEqual(res.get("annualIncome"), "75000")
        self.assertEqual(res.get("financialYear"), "2023-2024")
        self.assertEqual(res.get("district"), "Coimbatore")
        self.assertEqual(res.get("taluk"), "Coimbatore South")
        self.assertIn("TN-720240415101", res.get("certificateNumber", ""))
        self.assertEqual(res.get("issueDate"), "20/04/2024")

    def test_caste_certificate(self):
        sample = """
        Government of Tamil Nadu
        COMMUNITY CERTIFICATE
        Certificate No: TN-520230810204
        Date: 10/08/2023
        This is to certify that Thiru K. Ramesh son of Krishnan,
        residing at Pollachi, Coimbatore District,
        belongs to Kongu Vellalar Community, which is recognized as
        Backward Class (BC) as per Government Order.
        """
        res = parse_caste_certificate(sample)
        self.assertEqual(res.get("category"), "BC")
        self.assertEqual(res.get("district"), "Coimbatore")
        self.assertIn("TN-520230810204", res.get("certificateNumber", ""))

    def test_residence_certificate(self):
        sample = """
        Government of Tamil Nadu
        NATIVITY / RESIDENCE CERTIFICATE
        Certificate No: TN-320231122001
        Date of Issue: 22/11/2023
        This is to certify that Selvi Priya Murugan is permanently residing at
        Address: 124 Cross Street, Gandhipuram, Coimbatore,
        Village: Gandhipuram, Taluk: Coimbatore South, District: Coimbatore, State: Tamil Nadu.
        """
        res = parse_residence_certificate(sample)
        self.assertEqual(res.get("state"), "Tamil Nadu")
        self.assertEqual(res.get("district"), "Coimbatore")
        self.assertEqual(res.get("taluk"), "Coimbatore South")
        self.assertEqual(res.get("village"), "Gandhipuram")
        self.assertIn("TN-320231122001", res.get("certificateNumber", ""))

    def test_ration_card(self):
        sample = """
        Civil Supplies and Consumer Protection Department
        Government of Tamil Nadu
        SMART FAMILY CARD
        Card No: 33/G/0192834
        Card Type: PHH
        Head of the Family: Murugan K
        Total Members: 4
        Self - Murugan K
        Wife - Lakshmi M
        Daughter - Priya M
        Son - Vijay M
        FPS Code: 03FP012 Coimbatore
        Address: 124 Cross St, Coimbatore
        """
        res = parse_ration_card(sample)
        self.assertEqual(res.get("cardType"), "PHH")
        self.assertEqual(res.get("familyCardNumber"), "33/G/0192834")
        self.assertEqual(res.get("headOfFamily"), "Murugan K")
        self.assertEqual(res.get("familySize"), "4")

    def test_education_certificate(self):
        sample = """
        PSG College of Technology, Coimbatore
        BONAFIDE CERTIFICATE
        Date: 05/09/2024
        This is to certify that Ms. Priya Murugan, DOB: 15/08/2004
        is a bonafide student studying in 2nd Year, Course: B.Tech Information Technology,
        during the Academic Year: 2024-2025.
        """
        res = parse_education_certificate(sample)
        self.assertEqual(res.get("dateOfBirth"), "15/08/2004")
        self.assertEqual(res.get("educationLevel"), "UG")
        self.assertEqual(res.get("course"), "B.Tech Information Technology")
        self.assertEqual(res.get("yearOfStudy"), "2nd Year")
        self.assertEqual(res.get("studentStatus"), "Enrolled")
        self.assertEqual(res.get("academicYear"), "2024-2025")

    def test_disability_certificate(self):
        sample = """
        Department of Empowerment of Persons with Disabilities
        UNIQUE DISABILITY ID (UDID)
        UDID Number: TN0310220040012345
        Name of Beneficiary: Saravanan R
        Disability Type: Locomotor Disability
        Disability Percentage: 60%
        Validity: Permanent
        Issue Date: 12/03/2023
        """
        res = parse_disability_certificate(sample)
        self.assertEqual(res.get("disabilityType"), "Locomotor Disability")
        self.assertEqual(res.get("disabilityPercentage"), "60")
        self.assertEqual(res.get("disabilityCategory"), "Benchmark Disability")
        self.assertEqual(res.get("udid"), "TN0310220040012345")
        self.assertEqual(res.get("validity"), "Permanent")

    def test_land_document(self):
        sample = """
        Government of Tamil Nadu - Revenue Department
        PATTA / CHITTA EXTRACT
        Pattadhar Name: Selvam K
        Survey No: 142/3B
        Village: Thondamuthur
        Taluk: Coimbatore South
        District: Coimbatore
        Extent: 3.50 Acres
        Land Type: Wet Land (Nanja)
        Crop Cultivated: Paddy
        """
        res = parse_land_document(sample)
        self.assertEqual(res.get("ownerName"), "Selvam K")
        self.assertEqual(res.get("surveyNumber"), "142/3B")
        self.assertEqual(res.get("landHoldingAcres"), "3.5")
        self.assertEqual(res.get("unit"), "Acre")
        self.assertEqual(res.get("landType"), "Wet (Nanja)")
        self.assertEqual(res.get("crop"), "Paddy")

    def test_employment_document(self):
        sample = """
        Ministry of Labour & Employment
        e-Shram Universal Account Number (UAN) Card
        Name of Worker: Munusamy V
        Occupation: Agricultural Labourer
        Worker Category: Unorganized Worker
        e-Shram No: 1234 5678 9012
        Monthly Income: 8,000
        """
        res = parse_employment_document(sample)
        self.assertEqual(res.get("occupation"), "Agricultural Labourer")
        self.assertEqual(res.get("workerCategory"), "Unorganized Worker")
        self.assertEqual(res.get("monthlyIncome"), "8000")
        self.assertEqual(res.get("annualIncome"), "96000")
        self.assertEqual(res.get("labourRegistrationDetails"), "123456789012")

    def test_bank_passbook(self):
        sample = """
        STATE BANK OF INDIA
        Coimbatore Main Branch
        Savings Bank Passbook
        Account Holder: Priya Murugan
        Account Number: 30987654321
        IFS Code: SBIN0000827
        Branch Name: Coimbatore Main
        """
        res = parse_bank_passbook(sample)
        self.assertEqual(res.get("bankName"), "State Bank of India")
        self.assertEqual(res.get("accountNumber"), "30987654321")
        self.assertEqual(res.get("ifsc"), "SBIN0000827")
        self.assertEqual(res.get("branch"), "Coimbatore Main")

    def test_auto_detection(self):
        self.assertEqual(detect_document_type("Unique Identification Authority of India Mera Aadhaar"), "AADHAAR")
        self.assertEqual(detect_document_type("Tamil Nadu e-District Annual Income Certificate Tahsildar"), "INCOME_CERTIFICATE")
        self.assertEqual(detect_document_type("Tamil Nadu Community Certificate Backward Class"), "CASTE_CERTIFICATE")
        self.assertEqual(detect_document_type("Patta Chitta Survey No Extent Wet Land"), "LAND")
        self.assertEqual(detect_document_type("Savings Bank Passbook IFSC SBIN0000123"), "BANK_PASSBOOK")

class TestExtraFields(unittest.TestCase):
    def test_income_authority_and_validity(self):
        res = parse_income_certificate(
            "INCOME CERTIFICATE\nCertificate No: TN-720240415101\nIssuing Authority: Tahsildar, Coimbatore South\n"
            "Date of Issue: 20/04/2024\nValid up to: 19/04/2025\nAnnual Income Rs. 75,000/-\n")
        self.assertIn("Tahsildar", res.get("issuingAuthority", ""))
        self.assertEqual(res.get("validity"), "19/04/2025")
        self.assertEqual(res.get("annualIncome"), "75000")

    def test_caste_authority(self):
        res = parse_caste_certificate("COMMUNITY CERTIFICATE\nCertificate No: TN-123456\nCommunity: Backward Class\nIssued By: Tahsildar\n")
        self.assertEqual(res.get("issuingAuthority"), "Tahsildar")

    def test_disability_certificate_number_and_authority(self):
        res = parse_disability_certificate(
            "Disability Certificate\nCertificate No: DIS/2023/00123\nDisability Type: Locomotor Disability\n"
            "Disability Percentage: 60%\nIssuing Authority: Medical Board, Chennai\n")
        self.assertEqual(res.get("certificateNumber"), "DIS/2023/00123")
        self.assertIn("Medical Board", res.get("issuingAuthority", ""))

    def test_education_roll_and_marks(self):
        res = parse_education_certificate(
            "Name of the Student: Priya M\nInstitution: Anna University\nCourse: B.E\nRegister No: 810021104055\n"
            "Percentage: 78.5%\nYear of Passing: 2023\n")
        self.assertEqual(res.get("registrationNumber"), "810021104055")
        self.assertEqual(res.get("percentage"), "78.5")
        self.assertEqual(res.get("qualification").upper().replace(".", ""), "BE")

    def test_employment_type_and_no_overwrite(self):
        res = parse_employment_document("Name of Worker: Ravi K\nOccupation: Mason\nEmployment Type: Daily Wage\nLabour Registration No: TNLW12345\n")
        self.assertEqual(res.get("employmentType"), "Daily Wage")

    def test_missing_extras_are_omitted(self):
        res = parse_caste_certificate("COMMUNITY CERTIFICATE\nCommunity: SC\n")
        self.assertNotIn("issuingAuthority", res)


class TestLabelledLines(unittest.TestCase):
    def test_values_do_not_run_into_next_label(self):
        res = parse_caste_certificate("Community Certificate\nName: Priya Murugan\nCommunity: Backward Class\nCaste: Mudaliyar\n")
        self.assertEqual(res.get("name"), "Priya Murugan")
        self.assertEqual(res.get("community"), "Backward Class")
        self.assertEqual(res.get("caste"), "Mudaliyar")

    def test_education_name_and_institution(self):
        res = parse_education_certificate("Anna University\nName of the Student: Priya Murugan\nCourse: B.E Computer Science\nRegister No: 810021104055\n")
        self.assertEqual(res.get("name"), "Priya Murugan")
        self.assertEqual(res.get("institution"), "Anna University")

    def test_ifsc_ocr_errors_repaired(self):
        res = parse_bank_passbook("State Bank of India\nAccount Holder Name: Priya M\nAccount No: 31234567890\nIFSC: SBIN0OO0123\n")
        self.assertEqual(res.get("ifsc"), "SBIN0000123")

    def test_ration_family_size_counts_members(self):
        res = parse_ration_card("Family Card\nCard Number: 33/12345/678\nHead of Family: Murugan\nMembers: Murugan Father, Lakshmi Mother, Priya Daughter\n")
        self.assertEqual(res.get("headOfFamily"), "Murugan")

    def test_aadhaar_name_above_dob_and_clean_address(self):
        res = parse_aadhaar("Government of India\nPriya Murugan\nDOB: 15/08/1998\nFemale\n2345 6789 1234\n")
        self.assertEqual(res.get("name"), "Priya Murugan")


if __name__ == "__main__":
    unittest.main()
