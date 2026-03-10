pipeline {
    agent any

    // ── Parameters: build any branch, default to main ─────────────────────
    parameters {
        string(
            name: 'BRANCH',
            defaultValue: 'dev',
            description: 'Git branch to build (e.g. dev, feature_branch)'
        )
        string(
            name: 'IMAGE_TAG',
            defaultValue: '',
            description: 'Docker image tag (leave blank to auto-generate: branch-buildNumber)'
        )
    }

    environment {
        DOCKERHUB_REPO  = "pallavi3110/pallavisrepo"
        IMAGE_TAG       = "${params.IMAGE_TAG ?: "${params.BRANCH}-${BUILD_NUMBER}"}"
        FULL_IMAGE      = "${DOCKERHUB_REPO}:${IMAGE_TAG}"
        K8S_DEPLOYMENT  = "testapp"
        K8S_NAMESPACE   = "testapp-ns"
    }

    stages {

        // ── Stage 1: Clone ─────────────────────────────────────────────────
        stage('Clone') {
            steps {
                git branch: "${params.BRANCH}",
                    url: 'https://github.com/pall111/docker-testapp.git'
                echo "Checked out branch: ${params.BRANCH}"
            }
        }

        // ── Stage 2: Install Dependencies ──────────────────────────────────
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        // ── Stage 3: Lint ──────────────────────────────────────────────────
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        // ── Stage 4: Unit Tests ────────────────────────────────────────────
        stage('Unit Tests') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'coverage/junit.xml'
                }
            }
        }

        // ── Stage 5: Build Docker Image (dev branch only) ──────────────────
        stage('Build Docker Image') {
            when { expression { params.BRANCH == 'dev' } }
            steps {
                sh "docker build -t ${FULL_IMAGE} ."
                echo "Built image: ${FULL_IMAGE}"
            }
        }

        // ── Stage 6: Push Artifacts (dev only) ────────────────────────────
        stage('Push Artifacts') {
            when { expression { params.BRANCH == 'dev' } }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${FULL_IMAGE}
                        docker logout
                    '''
                }
            }
        }

        // ── Stage 7: Deploy to Kubernetes (dev only) ───────────────────────
        stage('Deploy to Kubernetes') {
            when { expression { params.BRANCH == 'dev' } }
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-local', variable: 'KUBECONFIG')]) {
                    sh """
                        kubectl set image deployment/${K8S_DEPLOYMENT} \
                            ${K8S_DEPLOYMENT}=${FULL_IMAGE} \
                            -n ${K8S_NAMESPACE}
                        kubectl rollout status deployment/${K8S_DEPLOYMENT} \
                            -n ${K8S_NAMESPACE} --timeout=120s
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline SUCCESS — image: ${FULL_IMAGE}"
        }
        failure {
            echo "Pipeline FAILED on branch: ${params.BRANCH} — check logs above"
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
