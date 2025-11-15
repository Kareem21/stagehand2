/**
 * Standalone Snapshot Extractor - Option A (Simple)
 *
 * This version works ANYWHERE - just needs npm install!
 * Uses only the public Stagehand npm package.
 *
 * Setup:
 *   npm init -y
 *   npm install @browserbasehq/stagehand tsx zod
 *
 * Run:
 *   node --import tsx snapshot-extractor-standalone-a.ts <URL>
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

async function extractSnapshot(url: string) {
  console.log(`🚀 Extracting snapshot from: ${url}\n`);

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    headless: true,
    enableCaching: false,
  });

  try {
    console.log("🌐 Launching browser...");
    await stagehand.init();

    const page = stagehand.page;

    console.log("📄 Navigating to URL...");
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    console.log("📸 Capturing page data...");

    // Use extract() to get the full page text - this internally uses the snapshot
    const pageData = await stagehand.extract({
      instruction: "extract all text content and interactive elements from the page",
      schema: z.object({
        pageTitle: z.string().describe("The page title"),
        formFields: z.array(z.object({
          label: z.string().describe("Field label or name"),
          type: z.string().describe("Field type (text, email, etc)"),
        })).describe("All form input fields"),
        buttons: z.array(z.string()).describe("All button labels"),
        links: z.array(z.string()).describe("All link text"),
      }),
    });

    // Also get the raw HTML for reference
    const htmlContent = await page.content();

    // Create output directory
    const outputDir = join(process.cwd(), "snapshot-output");
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedUrl = url.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const prefix = `${sanitizedUrl}_${timestamp}`;

    console.log("\n💾 Saving outputs...");

    // 1. Extracted data (structured)
    const extractPath = join(outputDir, `${prefix}_extracted-data.json`);
    writeFileSync(extractPath, JSON.stringify(pageData, null, 2), "utf-8");
    console.log(`✅ Extracted data: ${extractPath}`);

    // 2. Raw HTML
    const htmlPath = join(outputDir, `${prefix}_page.html`);
    writeFileSync(htmlPath, htmlContent, "utf-8");
    console.log(`✅ HTML content: ${htmlPath}`);

    // 3. Summary
    const summary = {
      url,
      timestamp: new Date().toISOString(),
      stats: {
        formFieldCount: pageData.formFields?.length || 0,
        buttonCount: pageData.buttons?.length || 0,
        linkCount: pageData.links?.length || 0,
        htmlSize: htmlContent.length,
      },
      data: pageData,
    };

    const summaryPath = join(outputDir, `${prefix}_summary.json`);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    console.log(`✅ Summary: ${summaryPath}`);

    console.log("\n📊 Stats:");
    console.log(`   - Form fields: ${summary.stats.formFieldCount}`);
    console.log(`   - Buttons: ${summary.stats.buttonCount}`);
    console.log(`   - Links: ${summary.stats.linkCount}`);

    if (pageData.formFields && pageData.formFields.length > 0) {
      console.log("\n📝 Form Fields Found:");
      pageData.formFields.slice(0, 10).forEach((field, idx) => {
        console.log(`   ${idx + 1}. ${field.label} (${field.type})`);
      });
    }

    console.log("\n✨ Done! Outputs saved to:", outputDir);

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    console.log("\n🧹 Cleaning up...");
    await stagehand.close();
  }
}

const url = process.argv[2];

if (!url) {
  console.error("❌ Please provide a URL");
  console.log("\nUsage: node --import tsx snapshot-extractor-standalone-a.ts <URL>");
  console.log("Example: node --import tsx snapshot-extractor-standalone-a.ts https://jobs.example.com/apply");
  process.exit(1);
}

extractSnapshot(url).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
