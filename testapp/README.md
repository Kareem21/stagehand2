# Job Auto-Apply MVP

Automated job application system using Stagehand AI agent.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd testapp
npm install
```

### 2. Configure API Key

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get API keys:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys

### 3. Configure Your Data

Edit `data/user-data.json` with your information:

```json
{
  "firstName": "Your Name",
  "lastName": "Last Name",
  "email": "your.email@example.com",
  "phone": "+1234567890",
  ...
}
```

### 4. Add Job URLs

Edit `data/jobs.json` with job application URLs:

```json
[
  "https://company1.com/apply/job123",
  "https://company2.com/apply/job456",
  ...
]
```

### 5. Run the Application

```bash
npm run apply
```

Watch the browser automatically fill out applications!

---

## 📁 Project Structure

```
testapp/
├── apply-all.ts          # Main script
├── package.json          # Dependencies
├── .env                  # API keys (create this)
├── data/
│   ├── user-data.json   # Your personal info
│   ├── jobs.json        # Job URLs to apply to
│   └── resume.pdf       # Your resume (replace placeholder)
└── results/             # Application results (auto-created)
    ├── job-0-success.json
    ├── job-1-failed.json
    └── ...
```

---

## 🎯 How It Works

1. **Loads your data** from `data/user-data.json`
2. **Loads job URLs** from `data/jobs.json`
3. **For each job:**
   - Opens browser (visible so you can watch)
   - Navigates to application URL
   - Uses AI agent to fill out form
   - Handles multi-page applications
   - Saves result to `results/`
4. **Skips already-completed** jobs on restart

---

## 🤖 AI Agent Behavior

The agent will:

✅ Fill all fields with your data
✅ Use reasonable defaults for missing data:
- Location questions → Your configured location
- Authorization questions → "Yes"
- Years of experience → Your configured experience
- Salary expectations → "Negotiable"
- Notice period → "30 days"

✅ Navigate multi-page forms
✅ Handle dropdowns and radio buttons
⏭️ Skip file uploads (resume/cover letter)
🛑 Stop at CAPTCHA or authentication

---

## ⚙️ Configuration Options

### Change LLM Model

Edit `apply-all.ts`:

```typescript
model: "anthropic/claude-sonnet-4-20250514"  // Claude Sonnet
// or
model: "openai/gpt-4o-mini"  // GPT-4 Mini (faster, cheaper)
```

### Headless Mode

To run without visible browser:

```typescript
headless: true  // Change from false
```

### Max Steps Per Application

```typescript
maxSteps: 50  // Increase for complex forms
```

---

## 📊 Results

After each job, a result file is saved:

**Success (`job-0-success.json`):**
```json
{
  "jobIndex": 0,
  "url": "https://company.com/apply",
  "status": "success",
  "timestamp": "2025-11-15T...",
  "duration": 45000,
  "actionsPerformed": ["click", "fill", "fill", ...]
}
```

**Failed (`job-1-failed.json`):**
```json
{
  "jobIndex": 1,
  "url": "https://company.com/apply",
  "status": "failed",
  "timestamp": "2025-11-15T...",
  "duration": 30000,
  "error": "Timeout waiting for element"
}
```

---

## 🔄 Resume on Crash

If the script crashes or you stop it:

1. Already-completed jobs are **skipped**
2. It continues from where it left off
3. Check `results/` to see what's done

---

## 🐛 Troubleshooting

### "No API key found"
- Create `.env` file from `.env.example`
- Add your `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

### Browser doesn't launch
```bash
npx playwright install chromium
```

### Applications failing
- Check `results/job-X-failed.json` for error details
- Increase `maxSteps` for complex forms
- Some sites may have CAPTCHA (can't automate)

### Watching too slow/fast
- Adjust delays in `apply-all.ts`
- Change `verbose` level (0=silent, 1=normal, 2=debug)

---

## 💡 Tips

1. **Test first:** Start with 2-3 job URLs to test
2. **Watch it work:** Keep `headless: false` to debug
3. **Check results:** Review `results/` files after each run
4. **Update data:** Keep `user-data.json` current
5. **Backup:** Save your `data/` folder

---

## 🔐 Privacy & Safety

- All data stays **local** on your machine
- API calls only send page structure (not your data) to LLM
- Review forms before final submission
- This is an MVP - always verify applications were submitted correctly

---

## 📈 Next Steps (Future)

- [ ] Add file upload support (resume/cover letter)
- [ ] Human-in-the-loop for review before submit
- [ ] Web UI for monitoring
- [ ] Database for tracking applications
- [ ] Queue system for parallel processing
- [ ] Browserless integration for cloud browsers

---

## 📝 License

MIT
