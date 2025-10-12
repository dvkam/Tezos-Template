const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const BUILD_DIR = process.env.BUILD_DIR || "dist";
const BRANCH_NAME = process.env.BRANCH_NAME || "unknown";
const IS_PR = process.env.CHANGE_ID ? true : false;
const TARGET_BRANCH = process.env.CHANGE_TARGET || "main";

// Helper function to get directory size
function getDirectorySize(dirPath) {
  try {
    const result = execSync(`du -sb ${dirPath} | cut -f1`, {
      encoding: "utf8",
    });
    return parseInt(result.trim(), 10);
  } catch (error) {
    console.error(`❌ Error calculating size for ${dirPath}:`, error.message);
    process.exit(1);
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Helper function to get current git commit
function getCurrentCommit() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch (error) {
    return "unknown";
  }
}

// Helper function to get current branch
function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return "unknown";
  }
}

// Main function
function main() {
  console.log("🔍 Calculating build size...\n");

  // Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`❌ Build directory '${BUILD_DIR}' not found`);
    process.exit(1);
  }

  // Calculate current build size (PR branch)
  const currentSize = getDirectorySize(BUILD_DIR);
  const currentCommit = getCurrentCommit();
  console.log(
    `📦 Current build size (${BRANCH_NAME}): ${formatBytes(currentSize)}`
  );
  console.log(`   Commit: ${currentCommit.substring(0, 7)}\n`);

  // If not a PR, just report the size and exit
  if (!IS_PR) {
    console.log(`BUILD_SIZE=${currentSize}`);
    process.exit(0);
  }

  // For PRs: Build the target branch and compare
  console.log(`🔄 Building ${TARGET_BRANCH} branch for comparison...\n`);

  try {
    // Save current state
    const prBranch = getCurrentBranch();
    const prCommit = getCurrentCommit();

    // Stash any changes (shouldn't be any in CI, but just in case)
    try {
      execSync("git stash --include-untracked", { stdio: "pipe" });
    } catch (e) {
      // No changes to stash
    }

    // Fetch and checkout target branch
    execSync(`git fetch origin ${TARGET_BRANCH}`, { stdio: "inherit" });
    execSync(`git checkout origin/${TARGET_BRANCH}`, { stdio: "inherit" });

    const baselineCommit = getCurrentCommit();
    console.log(
      `✓ Checked out ${TARGET_BRANCH} at ${baselineCommit.substring(0, 7)}\n`
    );

    // Clean old build
    if (fs.existsSync(BUILD_DIR)) {
      execSync(`rm -rf ${BUILD_DIR}`, { stdio: "inherit" });
    }

    // Install dependencies and build (skip lint and tests for speed)
    console.log("📦 Installing dependencies for baseline...");
    execSync("npm install", { stdio: "inherit" });

    console.log("🔨 Building baseline...");
    execSync("npm run build", { stdio: "inherit" });

    // Calculate baseline size
    const baselineSize = getDirectorySize(BUILD_DIR);
    console.log(
      `\n📦 Baseline build size (${TARGET_BRANCH}): ${formatBytes(
        baselineSize
      )}`
    );
    console.log(`   Commit: ${baselineCommit.substring(0, 7)}\n`);

    // Switch back to PR branch
    execSync(`git checkout ${prCommit}`, { stdio: "inherit" });
    console.log(`✓ Switched back to PR branch\n`);

    // Clean and rebuild PR version
    if (fs.existsSync(BUILD_DIR)) {
      execSync(`rm -rf ${BUILD_DIR}`, { stdio: "inherit" });
    }

    console.log("📦 Reinstalling dependencies for PR...");
    execSync("npm install", { stdio: "inherit" });

    console.log("🔨 Rebuilding PR version...");
    execSync("npm run build", { stdio: "inherit" });

    // Calculate final PR size (should match what we measured earlier, but rebuild to be sure)
    const finalPrSize = getDirectorySize(BUILD_DIR);

    // Calculate difference
    const diff = finalPrSize - baselineSize;
    const diffPercent =
      baselineSize > 0 ? ((diff / baselineSize) * 100).toFixed(2) : 0;

    const emoji = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
    const sign = diff > 0 ? "+" : "";
    const status =
      diff > 0 ? "⚠️  Increased" : diff < 0 ? "✅ Decreased" : "➡️ No change";

    // Print comparison table
    console.log("\n════════════════════════════════════════════");
    console.log(`${emoji} BUILD SIZE COMPARISON`);
    console.log("════════════════════════════════════════════");
    console.log(`Baseline (${TARGET_BRANCH}):  ${formatBytes(baselineSize)}`);
    console.log(`Current (PR):     ${formatBytes(finalPrSize)}`);
    console.log(
      `Difference:       ${sign}${formatBytes(diff)} (${sign}${diffPercent}%)`
    );
    console.log(`Status:           ${status}`);
    console.log("════════════════════════════════════════════\n");

    // Warning for significant changes
    if (Math.abs(diffPercent) > 10) {
      if (diff > 0) {
        console.log("⚠️  WARNING: Build size increased by more than 10%!\n");
      } else {
        console.log("🎉 Great! Build size decreased by more than 10%!\n");
      }
    }

    // Output for Jenkins environment variables
    console.log(`BUILD_SIZE=${finalPrSize}`);
    console.log(`BUILD_SIZE_BASELINE=${baselineSize}`);
    console.log(`BUILD_SIZE_DIFF=${diff}`);
    console.log(`BUILD_SIZE_DIFF_PERCENT=${diffPercent}`);

    // Generate GitHub comment
    const comment = `## ${emoji} Build Size Report

| Metric | Size |
|--------|------|
| **Baseline** (${TARGET_BRANCH}) | ${formatBytes(baselineSize)} |
| **Current** (PR) | ${formatBytes(finalPrSize)} |
| **Difference** | ${sign}${formatBytes(diff)} (${sign}${diffPercent}%) |
| **Status** | ${status} |

<details>
<summary>Build Details</summary>

- **Baseline commit:** \`${baselineCommit.substring(0, 7)}\`
- **PR commit:** \`${prCommit.substring(0, 7)}\`
- **Comparison performed:** ${new Date().toISOString()}

</details>
`;

    // Write comment to file for Jenkins to post
    fs.writeFileSync("build-size-comment.md", comment, "utf8");
    console.log("📝 GitHub comment generated: build-size-comment.md\n");
  } catch (error) {
    console.error("\n❌ Error during branch comparison:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
