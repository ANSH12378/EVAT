pipeline {
    agent any

    environment {
        DOCKER_HOME = 'C:\\Users\\sudha\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin'
        PATH = "${env.PATH};${DOCKER_HOME}"
    }

    stages {
        stage('Build') {
            steps {
                bat 'echo Building EVAT server...'
                bat 'npm ci'
                bat 'npm run build:server'
            }
        }

        stage('Test') {
            steps {
                bat 'echo Running EVAT automated server tests...'
                bat 'npm run test:server -- -- --runInBand'
            }
        }

        stage('Code Quality') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'

                    withSonarQubeEnv('SonarQube') {
                        bat "\"${scannerHome}\\bin\\sonar-scanner.bat\" -Dsonar.projectKey=EVAT -Dsonar.projectName=EVAT -Dsonar.sources=server/node-api/src -Dsonar.tests=server/node-api/test -Dsonar.test.inclusions=server/node-api/test/**/*.test.ts -Dsonar.exclusions=**/node_modules/**,**/*.js -Dsonar.typescript.tsconfigPath=server/node-api/tsconfig.json"
                    }

                    timeout(time: 3, unit: 'MINUTES') {
                        waitForQualityGate abortPipeline: true
                    }
                }
            }
        }

        stage('Security') {
            steps {
                bat 'echo Running production dependency security audit...'
                bat 'npm audit --omit=dev --audit-level=high'
            }
        }
    }

    post {
        success {
            echo 'EVAT pipeline completed successfully.'
        }
        failure {
            echo 'EVAT pipeline failed. Check the console output.'
        }
    }
}