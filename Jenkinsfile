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

                // High or critical dependency vulnerabilities fail the pipeline.
                // Moderate findings are reported for review.
                bat 'npm audit --omit=dev --audit-level=high'

                bat 'echo Packaging approved build as evat-api:%BUILD_NUMBER%...'
                bat 'docker build -t evat-api:%BUILD_NUMBER% server\\node-api'

                bat 'docker image inspect evat-api:%BUILD_NUMBER% --format "{{.Id}}"'
            }
        }

        stage('Deployment') {
            steps {
                bat 'echo Deploying EVAT API to staging...'

                // Ensure staging Docker network exists.
                bat '''
                @echo off
                docker network inspect evat-staging >nul 2>&1
                if errorlevel 1 docker network create evat-staging
                '''

                // Ensure staging MongoDB exists and is running.
                bat '''
                @echo off
                docker inspect evat-mongo-staging >nul 2>&1
                if errorlevel 1 (
                    echo Creating staging MongoDB...
                    docker run -d --name evat-mongo-staging --network evat-staging mongo:7
                    if errorlevel 1 exit /b 1
                ) else (
                    docker start evat-mongo-staging >nul 2>&1
                    echo Staging MongoDB is available.
                )
                '''

                // Replace previous staging API with this Jenkins build.
                bat 'docker rm -f evat-api-staging 2>nul || echo No existing staging API container'

                bat '''
                docker run -d --name evat-api-staging --network evat-staging -p 8081:8080 -e PORT=8080 -e JWT_SECRET=staging-test-only -e MONGODB_URI=mongodb://evat-mongo-staging:27017/evat-staging -e PUBLIC_API_URL=http://localhost:8081 evat-api:%BUILD_NUMBER%
                '''

                // Wait for the application rather than assuming a fixed startup time.
                bat '''
                @echo off
                echo Waiting for EVAT staging API to become healthy...

                for /L %%i in (1,1,24) do (
                    curl --fail --silent http://localhost:8081/api-docs/json >nul 2>&1
                    if not errorlevel 1 (
                        echo EVAT staging API is healthy.
                        exit /b 0
                    )

                    echo Health check attempt %%i/24 - waiting 5 seconds...
                    powershell -NoProfile -Command "Start-Sleep -Seconds 5"
                )

                echo ERROR: EVAT staging API did not become healthy.
                docker logs --tail 50 evat-api-staging
                exit /b 1
                '''

                // Infrastructure verification.
                bat 'docker inspect -f "{{.State.Running}}" evat-api-staging | findstr /I "true"'
                bat 'docker inspect evat-api-staging --format "{{.Config.Image}}"'

                bat 'echo EVAT staging deployment completed successfully.'
            }
        }

        stage('Release') {
            steps {
                bat 'echo Promoting tested EVAT image to release...'

                // Promote the exact image that passed all previous gates.
                bat 'docker tag evat-api:%BUILD_NUMBER% evat-api:release-%BUILD_NUMBER%'
                bat 'docker tag evat-api:%BUILD_NUMBER% evat-api:latest'

                bat 'docker image inspect evat-api:release-%BUILD_NUMBER% --format "{{.Id}}"'

                bat 'echo EVAT release created: evat-api:release-%BUILD_NUMBER%'
            }
        }

        stage('Monitoring') {
            steps {
                bat 'echo Running EVAT deployment monitoring checks...'

                // Container-level monitoring.
                bat 'docker inspect -f "{{.State.Running}}" evat-api-staging | findstr /I "true"'

                // Application-level monitoring.
                bat 'curl --fail --silent --show-error http://localhost:8081/api-docs/json >nul'

                bat 'echo EVAT MONITOR STATUS: HEALTHY'
                bat 'echo Container is running and the application health endpoint is responding.'
            }
        }
    }

    post {
        success {
            echo '============================================'
            echo 'EVAT DEVOPS PIPELINE COMPLETED SUCCESSFULLY'
            echo 'Build, Test, Code Quality, Security, Deployment, Release and Monitoring PASSED.'
            echo '============================================'
        }

        failure {
            echo '============================================'
            echo 'EVAT PIPELINE FAILED'
            echo 'Check the failed stage and console output.'
            echo '============================================'
        }

        always {
            echo "Pipeline build number: ${env.BUILD_NUMBER}"
        }
    }
}