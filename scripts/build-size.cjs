const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const BUILD_DIR = process.env.BUILD_DIR || 'dist';
const BASELINE_FILE = process.env.BASELINE_FILE || 'baseline-build-size.txt';
const BRANCH_NAME = process.env.BRANCH_NAME || 'unknown';
const IS_MAIN = BRANCH_NAME === 'main';
const IS_PR = process.env.CHANGE_ID ? true : false;

// Helper function to get directory size
function getDirectorySize(dirPath) {
  try {
    const result = execSync(`du -sb ${dirPath} | cut -f1`, { encoding: 'utf8' });
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
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Main function
function main() {
  console.log('🔍 Calculating build size...\n');

  // Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`❌ Build directory '${BUILD_DIR}' not found`);
    process.exit(1);
  }

  // Calculate current build size
  const currentSize = getDirectorySize(BUILD_DIR);
  console.log(`📦 Current build size: ${formatBytes(currentSize)}`);

  // If on main branch, save as baseline
  if (IS_MAIN) {
    fs.writeFileSync(BASELINE_FILE, currentSize.toString(), 'utf8');
    console.log(`✅ Baseline build size updated: ${formatBytes(currentSize)}\n`);

    // Output for Jenkins environment variables
    console.log(`BUILD_SIZE=${currentSize}`);
    process.exit(0);
  }

  // If on PR, compare with baseline
  if (!IS_MAIN) {
    if (!fs.existsSync(BASELINE_FILE)) {
      console.log('⚠️  No baseline found. This will be established when merged to main.\n');
      console.log(`BUILD_SIZE=${currentSize}`);
      process.exit(0);
    }

    const baselineSize = parseInt(fs.readFileSync(BASELINE_FILE, 'utf8').trim(), 10);
    const diff = currentSize - baselineSize;
    const diffPercent = baselineSize > 0 ? ((diff / baselineSize) * 100).toFixed(2) : 0;

    const emoji = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';
    const sign = diff > 0 ? '+' : '';
    const status = diff > 0 ? '⚠️  Increased' : diff < 0 ? '✅ Decreased' : '➡️ No change';

    // Print comparison table
    console.log('\n════════════════════════════════════════════');
    console.log(`${emoji} BUILD SIZE COMPARISON`);
    console.log('════════════════════════════════════════════');
    console.log(`Baseline (main):  ${formatBytes(baselineSize)}`);
    console.log(`Current (PR):     ${formatBytes(currentSize)}`);
    console.log(`Difference:       ${sign}${formatBytes(diff)} (${sign}${diffPercent}%)`);
    console.log(`Status:           ${status}`);
    console.log('════════════════════════════════════════════\n');

    // Warning for significant changes
    if (Math.abs(diffPercent) > 10) {
      if (diff > 0) {
        console.log('⚠️  WARNING: Build size increased by more than 10%!\n');
      } else {
        console.log('🎉 Great! Build size decreased by more than 10%!\n');
      }
    }

    // Output for Jenkins environment variables
    console.log(`BUILD_SIZE=${currentSize}`);
    console.log(`BUILD_SIZE_BASELINE=${baselineSize}`);
    console.log(`BUILD_SIZE_DIFF=${diff}`);
    console.log(`BUILD_SIZE_DIFF_PERCENT=${diffPercent}`);

    // Generate GitHub comment if on PR
    if (IS_PR) {
      const comment = `## ${emoji} Build Size Report

| Metric | Size |
|--------|------|
| **Baseline** (main) | ${formatBytes(baselineSize)} |
| **Current** (PR) | ${formatBytes(currentSize)} |
| **Difference** | ${sign}${formatBytes(diff)} (${sign}${diffPercent}%) |
| **Status** | ${status} |
`;

      // Write comment to file for Jenkins to post
      fs.writeFileSync('build-size-comment.md', comment, 'utf8');
      console.log('📝 GitHub comment generated: build-size-comment.md\n');
    }
  }
}

main();
