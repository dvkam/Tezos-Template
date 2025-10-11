pipeline {
    agent any
    
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
                // Examples:
                sh 'npm run lint'
                sh 'npm run build'
                // sh 'mvn clean package'
                // sh 'python setup.py build'
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
