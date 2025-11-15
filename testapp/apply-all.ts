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

    // Use agent to fill the entire form
    const agent = stagehand.agent();

    const instruction = `
You are filling out a job application form. Use the following data to complete the form:

Personal Information:
- First Name: ${userData.firstName}
- Last Name: ${userData.lastName}
- Email: ${userData.email}
- Phone: ${userData.phone}
${userData.location ? `- City: ${userData.location.city}` : ""}
${userData.location ? `- Country: ${userData.location.country}` : ""}

Professional Information:
${userData.currentCompany ? `- Current Company: ${userData.currentCompany}` : ""}
${userData.currentTitle ? `- Current Job Title: ${userData.currentTitle}` : ""}
${userData.yearsExperience ? `- Years of Experience: ${userData.yearsExperience}` : ""}
${userData.linkedinUrl ? `- LinkedIn: ${userData.linkedinUrl}` : ""}
${userData.portfolioUrl ? `- Portfolio: ${userData.portfolioUrl}` : ""}

Education:
${userData.education ? `- Degree: ${userData.education.degree}` : ""}
${userData.education ? `- University: ${userData.education.university}` : ""}
${userData.education ? `- Graduation Year: ${userData.education.graduationYear}` : ""}

IMPORTANT INSTRUCTIONS:
1. Fill out ALL form fields with the data provided above
2. For any fields where data is NOT provided, use reasonable defaults:
   - For "Are you authorized to work in [country]?" → Answer YES
   - For "Years of experience in [skill]?" → Use ${userData.yearsExperience || 3} years
   - For "Current salary?" → Skip or use "Negotiable"
   - For "Expected salary?" → Skip or use "Negotiable"
   - For "Notice period?" → Use "30 days" or "Immediate"
   - For location questions (city/country) → Use ${userData.location?.city || "Not specified"}, ${userData.location?.country || "Not specified"}
   - For any YES/NO questions about skills or experience → Answer YES if it seems reasonable
   - For education level → Use "${userData.education?.degree || "Bachelor's Degree"}"
   - For diversity/demographics questions → Select "Prefer not to say" if available, otherwise skip
3. If you encounter file upload fields:
   - Resume upload: Note it but skip (we'll handle separately)
   - Cover letter: Skip
4. Navigate through multi-page forms by clicking "Next" or "Continue" buttons
5. Review the form before submitting
6. Click the final "Submit Application" or "Apply" button
7. If you encounter CAPTCHA or authentication, STOP and report it

Complete the application form now.
`;

    const agentResult = await agent.execute(instruction, {
      maxSteps: 50, // Allow up to 50 actions
    });

    result.actionsPerformed = agentResult.actions?.map(a => a.type) || [];
    result.status = "success";
    result.duration = Date.now() - startTime;

    console.log(`\n✅ Application completed successfully!`);
    console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`   Actions: ${result.actionsPerformed.length}`);

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
  console.log("📂 Loading user data and job URLs...");
  const userData = await loadUserData();
  const jobUrls = await loadJobUrls();
  const completedJobs = getCompletedJobs();

  console.log(`   ✓ User: ${userData.firstName} ${userData.lastName}`);
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

    const result = await applyToJob(stagehand, jobUrl, userData, i);
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
