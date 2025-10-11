pipeline {
    agent any

    tools {
        nodejs 'NodeJs' 
    }

    environment {
        // File to store the baseline build size
        BASELINE_FILE = 'build-size.txt'
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                echo 'Building...'
                sh 'node --version'
                sh 'npm --version'
                sh 'npm install'
                sh 'npm run lint'
                sh 'npm run build'
                // sh 'mvn clean package'
                // sh 'python setup.py build'
            }
        }

        stage('Calculate Build Size') {
            steps {
                script {
                    // Calculate current build size (adjust the path to your build output)
                    def buildPath = 'dist' // Change to your build output folder (e.g., 'build', 'dist', 'public')
                    
                    if (fileExists(buildPath)) {
                        def currentSize = sh(
                            script: "du -sb ${buildPath} | cut -f1",
                            returnStdout: true
                        ).trim().toInteger()
                        
                        env.CURRENT_BUILD_SIZE = currentSize
                        
                        echo "📦 Current build size: ${formatBytes(currentSize)}"
                        
                        // Store as baseline if on main branch
                        if (env.BRANCH_NAME == 'main') {
                            writeFile file: BASELINE_FILE, text: currentSize.toString()
                            echo "✅ Baseline build size updated: ${formatBytes(currentSize)}"
                        }
                    } else {
                        echo "⚠️ Build path '${buildPath}' not found"
                    }
                }
            }
        }

        stage('Compare Build Size') {
            when {
                not { branch 'main' }
            }
            steps {
                script {
                    if (env.CURRENT_BUILD_SIZE) {
                        def currentSize = env.CURRENT_BUILD_SIZE.toInteger()
                        
                        // Try to read baseline from file
                        def baselineSize = 0
                        if (fileExists(BASELINE_FILE)) {
                            baselineSize = readFile(BASELINE_FILE).trim().toInteger()
                        } else {
                            echo "⚠️ No baseline found. This will be established when merged to main."
                            return
                        }
                        
                        def diff = currentSize - baselineSize
                        def diffPercent = baselineSize > 0 ? ((diff / baselineSize) * 100).round(2) : 0
                        
                        def emoji = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➡️')
                        def sign = diff > 0 ? '+' : ''
                        
                        echo """
════════════════════════════════════════════
${emoji} BUILD SIZE COMPARISON
════════════════════════════════════════════
Baseline (main):  ${formatBytes(baselineSize)}
Current (PR):     ${formatBytes(currentSize)}
Difference:       ${sign}${formatBytes(diff)} (${sign}${diffPercent}%)
════════════════════════════════════════════
"""
                        
                        // Store for potential GitHub comment
                        env.BUILD_SIZE_DIFF = diff
                        env.BUILD_SIZE_DIFF_PERCENT = diffPercent
                        env.BUILD_SIZE_BASELINE = baselineSize
                        env.BUILD_SIZE_CURRENT = currentSize
                        
                        // Warning if build size increased significantly
                        if (diffPercent > 10) {
                            echo "⚠️ WARNING: Build size increased by more than 10%!"
                        } else if (diffPercent < -10) {
                            echo "🎉 Great! Build size decreased by more than 10%!"
                        }
                    }
                }
            }
        }
        
        stage('Post Build Size to PR') {
            when {
                changeRequest()
            }
            steps {
                script {
                    if (env.BUILD_SIZE_DIFF && env.CHANGE_ID) {
                        def diff = env.BUILD_SIZE_DIFF.toInteger()
                        def diffPercent = env.BUILD_SIZE_DIFF_PERCENT
                        def baselineSize = env.BUILD_SIZE_BASELINE.toInteger()
                        def currentSize = env.BUILD_SIZE_CURRENT.toInteger()
                        
                        def emoji = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➡️')
                        def sign = diff > 0 ? '+' : ''
                        def status = diff > 0 ? '⚠️ Increased' : (diff < 0 ? '✅ Decreased' : '➡️ No change')
                        
                        def comment = """## ${emoji} Build Size Report
                        
| Metric | Size |
|--------|------|
| **Baseline** (main) | ${formatBytes(baselineSize)} |
| **Current** (PR) | ${formatBytes(currentSize)} |
| **Difference** | ${sign}${formatBytes(diff)} (${sign}${diffPercent}%) |
| **Status** | ${status} |
"""
                        
                        // Post comment to GitHub PR
                        withCredentials([string(credentialsId: 'github-token-secret', variable: 'GITHUB_TOKEN')]) {
                            sh """
                                curl -X POST \
                                -H "Authorization: token \${GITHUB_TOKEN}" \
                                -H "Accept: application/vnd.github.v3+json" \
                                https://api.github.com/repos/\${CHANGE_AUTHOR}/\${env.JOB_BASE_NAME}/issues/${env.CHANGE_ID}/comments \
                                -d '{"body": ${groovy.json.JsonOutput.toJson(comment)}}'
                            """
                        }
                        
                        echo "📝 Build size comment posted to PR #${env.CHANGE_ID}"
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                echo 'Running tests...'
                // Examples:
                // sh 'npm test'
                // sh 'mvn test'
                // sh 'pytest'
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo 'Deploying to production...'
                // This only runs when merging to main
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline succeeded!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}

// Helper function to format bytes into human-readable format
def formatBytes(bytes) {
    def units = ['B', 'KB', 'MB', 'GB']
    def unitIndex = 0
    def size = bytes.toDouble()
    
    while (size >= 1024 && unitIndex < units.size() - 1) {
        size /= 1024
        unitIndex++
    }
    
    return "${size.round(2)} ${units[unitIndex]}"
}
