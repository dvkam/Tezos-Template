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
                //sh 'npm run lint'
               // sh 'npm run build'
            }
        }

        stage('Analyze Build Size') {
            steps {
                script {
                    // Run the build size analysis script
                    def output = sh(
                        script: '''
                            export BUILD_DIR=dist
                            export BASELINE_FILE=baseline-build-size.txt
                            export BRANCH_NAME=${BRANCH_NAME}
                            export CHANGE_ID=${CHANGE_ID}
                            node scripts/build-size.cjs
                        ''',
                        returnStdout: true
                    ).trim()
                    
                    echo output
                    
                    // Parse environment variables from script output
                    output.split('\n').each { line ->
                        if (line.startsWith('BUILD_SIZE=')) {
                            env.BUILD_SIZE = line.split('=')[1]
                        } else if (line.startsWith('BUILD_SIZE_BASELINE=')) {
                            env.BUILD_SIZE_BASELINE = line.split('=')[1]
                        } else if (line.startsWith('BUILD_SIZE_DIFF=')) {
                            env.BUILD_SIZE_DIFF = line.split('=')[1]
                        } else if (line.startsWith('BUILD_SIZE_DIFF_PERCENT=')) {
                            env.BUILD_SIZE_DIFF_PERCENT = line.split('=')[1]
                        }
                    }
                }
            }
        }

        stage('Commit Baseline to Git') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Check if baseline file was created
                    if (fileExists('baseline-build-size.txt')) {
                        // Configure git
                        sh '''
                            git config user.email "jenkins@ci.local"
                            git config user.name "Jenkins CI"
                        '''
                        
                        // Check if file changed
                        def gitStatus = sh(script: 'git status --porcelain baseline-build-size.txt', returnStdout: true).trim()
                        
                        if (gitStatus) {
                            // Commit and push the baseline
                            withCredentials([usernamePassword(credentialsId: 'github-credentials', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
                                sh '''
                                    git add baseline-build-size.txt
                                    git commit -m "[Jenkins] Update baseline build size"
                                    git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/${GIT_URL#https://github.com/} HEAD:main
                                '''
                            }
                            echo '✅ Baseline committed to main branch'
                        } else {
                            echo 'ℹ️ Baseline unchanged, skipping commit'
                        }
                    }
                }
            }
        }
        
        stage('Post to GitHub PR') {
            when {
                changeRequest()
            }
            steps {
                script {
                    // Check if comment file was generated
                    if (fileExists('build-size-comment.md')) {
                        def comment = readFile('build-size-comment.md')
                        
                        // Get repository info from GIT_URL
                        def gitUrl = env.GIT_URL
                        def repoPath = gitUrl.replaceAll(/^.*github\.com[\/:]/, '').replaceAll(/\.git$/, '')
                        
                        withCredentials([string(credentialsId: 'github-token-secret', variable: 'GITHUB_TOKEN')]) {
                            sh """
                                curl -X POST \
                                -H "Authorization: token \${GITHUB_TOKEN}" \
                                -H "Accept: application/vnd.github.v3+json" \
                                https://api.github.com/repos/${repoPath}/issues/${env.CHANGE_ID}/comments \
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
