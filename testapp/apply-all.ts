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
  status: "success" | "failed" | "skipped";
  timestamp: string;
  duration?: number;
  error?: string;
  actionsPerformed?: string[];
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
  stagehand: Stagehand,
  jobUrl: string,
  userData: UserData,
  resumeMarkdown: string,
  jobIndex: number
): Promise<JobResult> {
  const startTime = Date.now();
  const result: JobResult = {
    jobIndex,
    url: jobUrl,
    status: "failed",
    timestamp: new Date().toISOString(),
    actionsPerformed: [],
  };

  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎯 Job ${jobIndex + 1}: ${jobUrl}`);
    console.log("=".repeat(80));

    const page = stagehand.context.pages()[0];

    console.log("📄 Navigating to job application...");
    await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("🤖 Starting AI agent to fill application...");

    // Use agent to fill the entire form with Sonnet for better planning
    const agent = stagehand.agent({
      model: "anthropic/claude-sonnet-4-20250514" // Force Sonnet for intelligent planning
    });

    const instruction = `
You are filling out a job application form. Work EFFICIENTLY - minimize observation, maximize action.

CANDIDATE DATA:
${resumeMarkdown}

STRATEGY:
1. Scan the page ONCE to identify all visible form fields
2. Fill each field immediately - do NOT screenshot between every field
3. Only take additional observations if:
   - A field fails to fill
   - You encounter a dropdown/multi-step element
   - You need to navigate to next page
4. For missing data, use these defaults:
   - Work authorization: "Yes"
   - Salary: "Negotiable"
   - Notice period: "30 days"
   - Yes/No skills questions: "Yes" (if reasonable)
   - Demographics: "Prefer not to say"

EXECUTE NOW:
- Fill ALL visible fields efficiently
- Click "Next"/"Continue" for multi-page forms
- Click "Submit" when form is complete
- Skip file uploads
- Stop at CAPTCHA/authentication
`;

    const agentResult = await agent.execute(instruction, {
      maxSteps: 150, // Allow sufficient steps for complex forms
    });

    result.actionsPerformed = agentResult.actions?.map(a => a.type) || [];
    result.status = "success";
    result.duration = Date.now() - startTime;

    // Count action types
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

  } catch (error: any) {
    result.status = "failed";
    result.error = error.message;
    result.duration = Date.now() - startTime;

    console.error(`\n❌ Application failed: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log("🚀 Job Auto-Apply MVP Starting...\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error("❌ Error: No API key found!");
    console.error("Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env file");
    process.exit(1);
  }

  // Load data
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

  // Initialize Stagehand
  console.log("🌐 Initializing Stagehand...");
  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 2, // Maximum logging
    headless: false, // Watch it work!
    enableCaching: true, // Enable caching for speed
    model: process.env.ANTHROPIC_API_KEY
      ? "anthropic/claude-sonnet-4-20250514"
      : "openai/gpt-4o-mini",
  });

  await stagehand.init();
  console.log("   ✓ Browser ready\n");

  // Process jobs
  const results: JobResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < jobUrls.length; i++) {
    const jobUrl = jobUrls[i];

    // Skip if already completed
    if (completedJobs.has(i)) {
      console.log(`⏭️  Skipping job ${i + 1} (already completed)`);
      skipCount++;
      continue;
    }

    const result = await applyToJob(stagehand, jobUrl, userData, resumeMarkdown, i);
    saveResult(result);
    results.push(result);

    if (result.status === "success") {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between applications
    if (i < jobUrls.length - 1) {
      console.log("\n⏳ Waiting 5 seconds before next application...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 APPLICATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total jobs: ${jobUrls.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`\n📁 Results saved to: ${join(process.cwd(), "results")}`);

  await stagehand.close();
  console.log("\n✨ Done!");
}

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
