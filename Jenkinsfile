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