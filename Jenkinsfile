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

                bat 'echo Packaging approved build as evat-api:%BUILD_NUMBER%...'
                bat 'docker build -t evat-api:%BUILD_NUMBER% server\\node-api'
            }
        }

        stage('Deployment') {
            steps {
                bat 'echo Deploying EVAT API to staging...'

                bat 'docker rm -f evat-api-staging 2>nul || echo No existing staging API container'

                bat 'docker run -d --name evat-api-staging --network evat-staging -p 8081:8080 -e PORT=8080 -e JWT_SECRET=staging-test-only -e MONGODB_URI=mongodb://evat-mongo-staging:27017/evat-staging -e PUBLIC_API_URL=http://localhost:8081 evat-api:%BUILD_NUMBER%'

                bat 'powershell -NoProfile -Command "Start-Sleep -Seconds 8"'

                bat 'curl --fail --silent --show-error http://localhost:8081/api-docs/json >nul'

                bat 'echo EVAT staging deployment passed health check.'
            }
        }

        stage('Release') {
            steps {
                bat 'echo Promoting tested EVAT image to release...'

                bat 'docker tag evat-api:%BUILD_NUMBER% evat-api:release-%BUILD_NUMBER%'
                bat 'docker tag evat-api:%BUILD_NUMBER% evat-api:latest'

                bat 'echo Release image created: evat-api:release-%BUILD_NUMBER%'
                bat 'docker image inspect evat-api:release-%BUILD_NUMBER% --format "{{.Id}}"'
            }
        }

        stage('Monitoring') {
            steps {
                bat 'echo Monitoring released EVAT staging service...'

                bat 'curl --fail --silent --show-error http://localhost:8081/api-docs/json >nul'

                bat 'docker inspect -f "{{.State.Running}}" evat-api-staging | findstr /I "true"'

                bat 'echo EVAT monitoring checks passed. Service is running and responding to HTTP requests.'
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