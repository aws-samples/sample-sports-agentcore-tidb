#!/bin/bash
set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="nfl-agent"
IMAGE_TAG="${1:-latest}"

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "🔨 Building Docker image..."
docker build -t ${REPO_NAME}:${IMAGE_TAG} .

echo "🏷️  Tagging image..."
docker tag ${REPO_NAME}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

echo "📤 Pushing to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}

echo ""
echo "✅ Done! Image pushed to:"
echo "   ${ECR_URI}:${IMAGE_TAG}"
