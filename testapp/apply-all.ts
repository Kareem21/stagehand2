/**
 * Auto Job Application MVP
 *
 * Processes multiple job applications using Stagehand agent
 *
 * Usage:
 *   npm install
 *   npm run apply
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import "dotenv/config";

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  currentTitle?: string;
  yearsExperience?: number;
  education?: {
    degree: string;
    university: string;
    graduationYear: number;
  };
  location?: {
    city: string;
    country: string;
  };
  resumePath: string;
  coverLetterPath?: string;
}

interface JobResult {
  jobIndex: number;
  url: string;
  domain: string;
  status: "success" | "failed" | "skipped";
  timestamp: string;
  duration?: number;
  error?: string;
  actionsPerformed?: string[];
  validated?: boolean;
  cacheHit?: boolean;
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return 'unknown';
  }
}

async function loadUserData(): Promise<UserData> {
  const dataPath = join(process.cwd(), "data", "user-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  return data;
}

async function loadUserResume(): Promise<string> {
  const resumePath = join(process.cwd(), "data", "resume.md");
  return readFileSync(resumePath, "utf-8");
}

async function loadJobUrls(): Promise<string[]> {
  const jobsPath = join(process.cwd(), "data", "jobs.json");
  const urls = JSON.parse(readFileSync(jobsPath, "utf-8"));
  return urls;
}

function getCompletedJobs(): Set<number> {
  const resultsDir = join(process.cwd(), "results");
  if (!existsSync(resultsDir)) return new Set();

  const files = readdirSync(resultsDir);
  const completed = new Set<number>();

  for (const file of files) {
    const match = file.match(/^job-(\d+)-/);
    if (match) {
      completed.add(parseInt(match[1]));
    }
  }

  return completed;
}

function saveResult(result: JobResult) {
  const resultsDir = join(process.cwd(), "results");
  const filename = `job-${result.jobIndex}-${result.status}.json`;
  const filepath = join(resultsDir, filename);
  writeFileSync(filepath, JSON.stringify(result, null, 2), "utf-8");
}

async function applyToJob(
  jobUrl: string,
  userData: UserData,
  resumeMarkdown: string,
  jobIndex: number
): Promise<JobResult> {
  const startTime = Date.now();
  const domain = extractDomain(jobUrl);
  const result: JobResult = {
    jobIndex,
    url: jobUrl,
    domain,
    status: "failed",
    timestamp: new Date().toISOString(),
    actionsPerformed: [],
  };

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 2,
    headless: false,
    cacheDir: `./cache/${domain}`,
    model: {
      modelName: "anthropic/claude-haiku-4-5-20251001",
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    }
  });

  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 Job ${jobIndex + 1}: ${jobUrl}`);
    console.log(`📦 Domain: ${domain} | Cache: ./cache/${domain}`);
    console.log("=".repeat(80));

    await stagehand.init();
    const page = stagehand.context.pages()[0];

    console.log("📄 Navigating to job application...");
    await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("⚡ Optimizing DOM for faster processing...");
    await page.evaluate(() => {
      document.querySelectorAll('video, iframe, [style*="animation"]').forEach(el => el.remove());
    });

    console.log("🤖 Starting AI agent to fill application...");

    const agent = stagehand.agent({
      model: {
        modelName: "anthropic/claude-haiku-4-5-20251001",
        apiKey: process.env.ANTHROPIC_API_KEY || ''
      }
    });

    const instruction = `
Fill this job application using the candidate information below:

${resumeMarkdown}

INSTRUCTIONS:
- Fill ALL form fields with data from the resume above
- For ANY question not covered in the resume, make up a reasonable answer
- NEVER leave fields empty
- Examples of reasonable defaults:
  • Work authorization: "Yes"
  • Salary expectations: "Negotiable" or "Market rate"
  • Notice period: "30 days" or "Immediately"
  • Years of experience with specific tech: Estimate based on resume context
  • Diversity/demographics: "Prefer not to say"

WORKFLOW:
1. Identify all visible form fields
2. Fill each field immediately (no screenshots between fields)
3. Click "Next"/"Continue" for multi-page forms
4. Click "Submit" when complete
5. Skip file uploads

SUCCESS CRITERIA:
Stop when you see "Application Submitted", "Thank you", or confirmation message.

Execute now.
`;

    const agentResult = await agent.execute(instruction, {
      maxSteps: 150,
    });

    const history = await stagehand.history;

    const recipe = history
        .filter(entry => entry.method === 'act')
        .map(entry => {
          const actResult = entry.result as any;
          if (actResult?.actions && Array.isArray(actResult.actions)) {
            return actResult.actions.map((action: any) => ({
              action: action.method || 'unknown',
              xpath: action.selector || '',
              arguments: action.arguments || []
            }));
          }
          return [];
        })
        .flat();

    const recipeFilename = `job-${jobIndex}-recipe.json`;
    const recipeFilepath = join(process.cwd(), "results", recipeFilename);
    writeFileSync(recipeFilepath, JSON.stringify(recipe, null, 2), "utf-8");

    result.actionsPerformed = agentResult.actions?.map(a => a.type) || [];
    result.duration = Date.now() - startTime;

    console.log("🔍 Validating submission...");
    const pageUrl = page.url();
    const pageContent = await page.content();

    const successIndicators = [
      pageUrl.includes('success'),
      pageUrl.includes('confirmation'),
      pageUrl.includes('thank'),
      pageContent.toLowerCase().includes('application submitted'),
      pageContent.toLowerCase().includes('thank you for applying'),
      pageContent.toLowerCase().includes('application received')
    ];

    result.validated = successIndicators.some(indicator => indicator);
    result.status = "success";

    console.log("⏱️ Waiting 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    const fillActions = result.actionsPerformed.filter(a => a === 'fill').length;
    const clickActions = result.actionsPerformed.filter(a => a === 'click').length;
    const screenshotActions = result.actionsPerformed.filter(a => a === 'screenshot').length;
    const observeActions = result.actionsPerformed.filter(a => a === 'observe' || a === 'ariaTree').length;

    console.log(`\n✅ Application completed!`);
    console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`   Total actions: ${result.actionsPerformed.length}`);
    console.log(`   └─ Fields filled: ${fillActions}`);
    console.log(`   └─ Clicks: ${clickActions}`);
    console.log(`   └─ Screenshots: ${screenshotActions}`);
    console.log(`   └─ Observations: ${observeActions}`);
    console.log(`   └─ Validated: ${result.validated ? '✅ Yes' : '⚠️ No'}`);

  } catch (error: any) {
    result.status = "failed";
    result.error = error.message;
    result.duration = Date.now() - startTime;

    console.error(`\n❌ Application failed: ${error.message}`);
  } finally {
    await stagehand.close();
  }

  return result;
}

async function main() {
  console.log("🚀 Job Auto-Apply MVP Starting...\n");

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error("❌ Error: No API key found!");
    console.error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env file");
    process.exit(1);
  }

  console.log("📂 Loading resume and job URLs...");
  const userData = await loadUserData();
  const resumeMarkdown = await loadUserResume();
  const jobUrls = await loadJobUrls();
  const completedJobs = getCompletedJobs();

  console.log(`   ✓ User: ${userData.firstName} ${userData.lastName}`);
  console.log(`   ✓ Resume loaded: ${resumeMarkdown.length} characters`);
  console.log(`   ✓ Jobs to process: ${jobUrls.length}`);
  console.log(`   ✓ Already completed: ${completedJobs.size}`);
  console.log(`   ✓ Remaining: ${jobUrls.length - completedJobs.size}\n`);

  const results: JobResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < jobUrls.length; i++) {
    const jobUrl = jobUrls[i];

    if (completedJobs.has(i)) {
      console.log(`⏭️  Skipping job ${i + 1} (already completed)`);
      skipCount++;
      continue;
    }

    const result = await applyToJob(jobUrl, userData, resumeMarkdown, i);
    saveResult(result);
    results.push(result);

    if (result.status === "success") {
      successCount++;
    } else {
      failCount++;
    }

    if (i < jobUrls.length - 1) {
      console.log("\n⏳ Waiting 5 seconds before next application...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 APPLICATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total jobs: ${jobUrls.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`\n📁 Results saved to: ${join(process.cwd(), "results")}`);
  console.log("\n✨ Done!");
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
