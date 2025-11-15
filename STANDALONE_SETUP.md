# 🚀 Standalone Snapshot Extractor - Setup Guide

These are **standalone versions** that work anywhere on your machine - not just in this repo.

---

## 📦 Quick Start (Copy & Paste)

### Step 1: Create a new folder
```bash
mkdir job-analyzer
cd job-analyzer
```

### Step 2: Copy ONE of these files to your folder
- `snapshot-extractor-standalone-a.ts` (uses Stagehand npm package)
- `snapshot-extractor-standalone-b.ts` (uses Playwright directly)

### Step 3: Choose your option and install dependencies

#### **Option A: Using Stagehand (Recommended)**
```bash
# Initialize package.json
npm init -y

# Install dependencies
npm install @browserbasehq/stagehand tsx zod

# Run it
node --import tsx snapshot-extractor-standalone-a.ts https://example.com
```

#### **Option B: Using Playwright (More control)**
```bash
# Initialize package.json
npm init -y

# Install dependencies
npm install playwright tsx

# Install browser
npx playwright install chromium

# Run it
node --import tsx snapshot-extractor-standalone-b.ts https://example.com
```

---

## 🎯 Full Example Session

```bash
# 1. Create project
mkdir job-analyzer
cd job-analyzer

# 2. Copy the standalone file
# (Copy snapshot-extractor-standalone-a.ts to this folder)

# 3. Setup
npm init -y
npm install @browserbasehq/stagehand tsx zod

# 4. Run on a job application
node --import tsx snapshot-extractor-standalone-a.ts https://jobs.lever.co/example/apply

# 5. Check results
ls snapshot-output/
cat snapshot-output/*_summary.json
```

---

## 📁 What Gets Created

```
job-analyzer/
├── snapshot-extractor-standalone-a.ts    # Your script
├── package.json                          # Dependencies
├── node_modules/                         # Installed packages
└── snapshot-output/                      # Results
    ├── *_extracted-data.json             # Structured data
    ├── *_page.html                       # Raw HTML
    └── *_summary.json                    # Stats
```

---

## 🔍 Differences Between Options

| Feature | Option A (Stagehand) | Option B (Playwright) |
|---------|---------------------|----------------------|
| **Dependencies** | `@browserbasehq/stagehand`, `zod` | `playwright` only |
| **Setup** | Simpler | Need to install chromium |
| **Output** | Structured data via LLM | Raw accessibility tree |
| **Speed** | Slower (uses LLM) | Faster (direct CDP) |
| **Data Format** | JSON schema-based | Accessibility nodes |
| **Cost** | May use API credits | Free (local only) |
| **Best For** | Getting structured form data | Getting raw tree structure |

---

## ⚙️ Environment Variables (Option A only)

If using Option A with OpenAI:

```bash
# Create .env file
echo "OPENAI_API_KEY=your-key-here" > .env

# Or export directly
export OPENAI_API_KEY=your-key-here
```

---

## 🐛 Troubleshooting

### "Cannot find module @browserbasehq/stagehand"
```bash
npm install @browserbasehq/stagehand
```

### "Browser not found" (Option B)
```bash
npx playwright install chromium
```

### "tsx: command not found"
```bash
npm install tsx
# Or use npx:
npx tsx snapshot-extractor-standalone-a.ts https://example.com
```

### TypeScript errors
The scripts are designed to run with `tsx` which handles TypeScript automatically.
No `tsconfig.json` needed!

---

## 🎓 Use Cases

### Analyze 100 job applications
```bash
# Create a file with URLs
cat urls.txt
https://company1.com/apply
https://company2.com/apply
https://company3.com/apply

# Process them all
while read url; do
  echo "Processing: $url"
  node --import tsx snapshot-extractor-standalone-a.ts "$url"
  sleep 2
done < urls.txt

# Analyze results
ls snapshot-output/ | wc -l
```

### Compare form complexity
```bash
# Run on multiple sites
node --import tsx snapshot-extractor-standalone-a.ts https://netflix.com/apply
node --import tsx snapshot-extractor-standalone-a.ts https://google.com/apply

# Compare field counts
jq '.stats.formFieldCount' snapshot-output/*_summary.json
```

---

## 📊 Example Output (Option A)

```json
{
  "url": "https://jobs.example.com/apply",
  "timestamp": "2025-11-15T10:30:00.000Z",
  "stats": {
    "formFieldCount": 12,
    "buttonCount": 3,
    "linkCount": 8,
    "htmlSize": 45230
  },
  "data": {
    "pageTitle": "Software Engineer Application",
    "formFields": [
      { "label": "Full Name", "type": "text" },
      { "label": "Email Address", "type": "email" },
      { "label": "Phone Number", "type": "tel" }
    ],
    "buttons": ["Submit Application", "Save Draft", "Cancel"],
    "links": ["Privacy Policy", "Terms of Service"]
  }
}
```

---

## 🚀 Next Steps

1. **Copy** one of the standalone files to your local folder
2. **Install** dependencies (see Quick Start above)
3. **Run** on a job application URL
4. **Analyze** the output files

No need to clone the entire Stagehand repo!
