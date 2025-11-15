/**
 * Standalone Snapshot Extractor - Option B (Enhanced)
 *
 * This version works ANYWHERE and provides more detailed analysis.
 * Uses direct Playwright + CDP to capture the accessibility tree.
 *
 * Setup:
 *   npm init -y
 *   npm install playwright tsx
 *
 * Run:
 *   node --import tsx snapshot-extractor-standalone-b.ts <URL>
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

interface AccessibilityNode {
  role?: string;
  name?: string;
  children?: AccessibilityNode[];
}

async function extractSnapshot(url: string) {
  console.log(`🚀 Extracting snapshot from: ${url}\n`);

  console.log("🌐 Launching browser...");
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log("📄 Navigating to URL...");
    const startNav = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const navTime = Date.now() - startNav;
    console.log(`   ✓ Loaded in ${navTime}ms`);

    console.log("\n⏳ Waiting for dynamic content...");
    await page.waitForTimeout(3000);

    console.log("\n📸 Capturing accessibility tree...");
    const snapshotStart = Date.now();

    // Get the accessibility tree using CDP
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send("Accessibility.enable");

    const { nodes } = await cdpSession.send("Accessibility.getFullAXTree");
    const snapshotTime = Date.now() - snapshotStart;
    console.log(`   ✓ Captured in ${snapshotTime}ms`);

    // Build a text representation of the tree
    const treeText = buildAccessibilityTreeText(nodes);

    // Analyze the tree
    console.log("\n🔍 Analyzing elements...");
    const analysis = analyzeAccessibilityTree(nodes);

    // Get page HTML for reference
    const htmlContent = await page.content();

    // Create output directory
    const outputDir = path.join(process.cwd(), "snapshot-output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedUrl = url.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    const prefix = `${sanitizedUrl}_${timestamp}`;

    console.log("\n💾 Saving outputs...");

    // 1. Accessibility tree (text format)
    const treePath = path.join(outputDir, `${prefix}_accessibility-tree.txt`);
    fs.writeFileSync(treePath, treeText, "utf-8");
    console.log(`   ✅ Accessibility tree: ${path.basename(treePath)}`);

    // 2. Raw accessibility nodes (JSON)
    const nodesPath = path.join(outputDir, `${prefix}_accessibility-nodes.json`);
    fs.writeFileSync(nodesPath, JSON.stringify(nodes, null, 2), "utf-8");
    console.log(`   ✅ Raw nodes: ${path.basename(nodesPath)}`);

    // 3. Element analysis
    const analysisPath = path.join(outputDir, `${prefix}_element-analysis.json`);
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");
    console.log(`   ✅ Analysis: ${path.basename(analysisPath)}`);

    // 4. HTML content
    const htmlPath = path.join(outputDir, `${prefix}_page.html`);
    fs.writeFileSync(htmlPath, htmlContent, "utf-8");
    console.log(`   ✅ HTML: ${path.basename(htmlPath)}`);

    // 5. Summary
    const summary = {
      url,
      timestamp: new Date().toISOString(),
      timings: {
        navigationMs: navTime,
        snapshotMs: snapshotTime,
        totalMs: navTime + 3000 + snapshotTime,
      },
      stats: {
        totalNodes: nodes.length,
        buttons: analysis.buttons.length,
        textInputs: analysis.textInputs.length,
        links: analysis.links.length,
        headings: analysis.headings.length,
        treeLines: treeText.split("\n").length,
        htmlSize: htmlContent.length,
      },
      files: {
        tree: path.basename(treePath),
        nodes: path.basename(nodesPath),
        analysis: path.basename(analysisPath),
        html: path.basename(htmlPath),
      },
    };

    const summaryPath = path.join(outputDir, `${prefix}_summary.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    console.log(`   ✅ Summary: ${path.basename(summaryPath)}`);

    console.log("\n📊 Statistics:");
    console.log(`   ⏱️  Total time: ${summary.timings.totalMs}ms`);
    console.log(`   🔢 Total nodes: ${summary.stats.totalNodes}`);
    console.log(`   📝 Tree lines: ${summary.stats.treeLines}`);

    console.log("\n🎯 Interactive Elements:");
    console.log(`   🔘 Buttons: ${summary.stats.buttons}`);
    console.log(`   ✍️  Text inputs: ${summary.stats.textInputs}`);
    console.log(`   🔗 Links: ${summary.stats.links}`);
    console.log(`   📰 Headings: ${summary.stats.headings}`);

    if (analysis.textInputs.length > 0) {
      console.log("\n📝 Text Input Fields:");
      analysis.textInputs.slice(0, 10).forEach((field, idx) => {
        console.log(`   ${idx + 1}. ${field}`);
      });
      if (analysis.textInputs.length > 10) {
        console.log(`   ... and ${analysis.textInputs.length - 10} more`);
      }
    }

    console.log("\n✨ Done! Outputs saved to:", outputDir);

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    console.log("\n🧹 Cleaning up...");
    await browser.close();
  }
}

function buildAccessibilityTreeText(nodes: any[]): string {
  if (!nodes || nodes.length === 0) return "";

  // Build a map of nodeId -> node
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Find root nodes (nodes with no parent)
  const rootNodes = nodes.filter(n => !n.parentId);

  function formatNode(node: any, indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    const role = node.role?.value || "unknown";
    const name = node.name?.value || "";
    const line = `${prefix}${role}${name ? `: ${name}` : ""}`;

    let result = line;

    // Process children
    if (node.childIds && node.childIds.length > 0) {
      for (const childId of node.childIds) {
        const child = nodeMap.get(childId);
        if (child) {
          result += "\n" + formatNode(child, indent + 1);
        }
      }
    }

    return result;
  }

  return rootNodes.map(n => formatNode(n)).join("\n");
}

function analyzeAccessibilityTree(nodes: any[]) {
  const analysis = {
    buttons: [] as string[],
    textInputs: [] as string[],
    links: [] as string[],
    headings: [] as string[],
    checkboxes: [] as string[],
    comboboxes: [] as string[],
    other: [] as string[],
  };

  for (const node of nodes) {
    const role = node.role?.value?.toLowerCase() || "";
    const name = node.name?.value || "(no label)";

    switch (role) {
      case "button":
        analysis.buttons.push(name);
        break;
      case "textbox":
        analysis.textInputs.push(name);
        break;
      case "link":
        analysis.links.push(name);
        break;
      case "heading":
        analysis.headings.push(name);
        break;
      case "checkbox":
        analysis.checkboxes.push(name);
        break;
      case "combobox":
      case "listbox":
        analysis.comboboxes.push(name);
        break;
      default:
        if (role && role !== "generic" && role !== "rootwebarea") {
          analysis.other.push(`${role}: ${name}`);
        }
    }
  }

  return analysis;
}

const url = process.argv[2];

if (!url) {
  console.error("❌ Please provide a URL");
  console.log("\nUsage: node --import tsx snapshot-extractor-standalone-b.ts <URL>");
  console.log("Example: node --import tsx snapshot-extractor-standalone-b.ts https://jobs.example.com/apply");
  process.exit(1);
}

extractSnapshot(url).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
