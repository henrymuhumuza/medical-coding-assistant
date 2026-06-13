# Custom Medical Code Imports

Place your custom CSV files in this directory to seed or expand the Medical Coding Assistant database.

## Supported Files

1. **ICD-10-CM Codes**
   - File name: `icd_10_cm.csv`
   - Expected columns: `code`, `description`
   - Example:
     ```csv
     code,description
     E11.9,Type 2 diabetes mellitus without complications
     I10,Essential (primary) hypertension
     ```

2. **CPT & HCPCS Codes**
   - File name: `cpt.csv`
   - Expected columns: `HCPCS`, `DESCRIPTION`
   - Example:
     ```csv
     HCPCS,DESCRIPTION
     99213,Office or other outpatient visit low complexity
     J1885,Injection ketorolac tromethamine up to 15 mg
     ```

## Automatic Importing

Upon restarting the server, the system automatically checks this folder, parses the CSVs, and imports the codes into the local SQLite database (`clinical_coding.db`).
If these files are missing, the system automatically falls back to the default diagnostic seed.
