# =============================================================================
# Phase 2: AWS Infrastructure for Subsidy Matching System
# =============================================================================
# このTerraformは以下のリソースを作成します：
# - S3: 添付ファイル・変換結果保存
# - SQS: ジョブキュー（DLQ付き）
# - API Gateway: Cloudflareからの入口
# - Lambda: job-submit（HTTPトリガー）、worker（SQSトリガー）
# - CloudWatch: ログ・メトリクス
# =============================================================================

terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "subsidy-app"
}

variable "internal_jwt_secret" {
  description = "Internal JWT secret for AWS-Cloudflare communication (shared secret)"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for LLM processing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_api_base_url" {
  description = "Cloudflare Pages/Workers public URL for internal API calls"
  type        = string
  default     = ""
}

locals {
  prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# S3 Bucket: 添付ファイル・変換結果保存
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "attachments" {
  bucket = "${local.prefix}-attachments"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "move-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    filter {
      prefix = "attachments/"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# SQS: ジョブキュー（DLQ付き）
# -----------------------------------------------------------------------------
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.prefix}-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.common_tags
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${local.prefix}-jobs"
  visibility_timeout_seconds = 900  # 15 minutes (Lambda timeout + buffer)
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 20   # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# IAM Role: Lambda実行ロール
# -----------------------------------------------------------------------------
resource "aws_iam_role" "lambda_execution" {
  name = "${local.prefix}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.prefix}-lambda-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.attachments.arn,
          "${aws_s3_bucket.attachments.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.jobs.arn,
          aws_sqs_queue.jobs_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -----------------------------------------------------------------------------
# Lambda: job-submit（HTTPトリガー）
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "job_submit" {
  filename         = "${path.module}/../lambda/job-submit/dist/function.zip"
  function_name    = "${local.prefix}-job-submit"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      ENVIRONMENT               = var.environment
      S3_BUCKET                 = aws_s3_bucket.attachments.bucket
      SQS_QUEUE_URL             = aws_sqs_queue.jobs.url
      INTERNAL_JWT_SECRET       = var.internal_jwt_secret
      JGRANTS_API_BASE          = "https://api.jgrants-portal.go.jp"
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "job_submit" {
  name              = "/aws/lambda/${aws_lambda_function.job_submit.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

# -----------------------------------------------------------------------------
# Lambda: worker（SQSトリガー）
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "worker" {
  filename         = "${path.module}/../lambda/worker/dist/function.zip"
  function_name    = "${local.prefix}-worker"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 600  # 10 minutes for LLM processing
  memory_size      = 1024 # More memory for PDF processing

  environment {
    variables = {
      ENVIRONMENT               = var.environment
      S3_BUCKET                 = aws_s3_bucket.attachments.bucket
      SQS_QUEUE_URL             = aws_sqs_queue.jobs.url
      INTERNAL_JWT_SECRET       = var.internal_jwt_secret
      CLOUDFLARE_API_BASE_URL   = var.cloudflare_api_base_url
      OPENAI_API_KEY            = var.openai_api_key
      ANTHROPIC_API_KEY         = var.anthropic_api_key
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${aws_lambda_function.worker.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

# SQS -> Lambda トリガー
resource "aws_lambda_event_source_mapping" "worker_sqs" {
  event_source_arn                   = aws_sqs_queue.jobs.arn
  function_name                      = aws_lambda_function.worker.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0
  enabled                            = true
}

# -----------------------------------------------------------------------------
# API Gateway: HTTP API（Cloudflareからの入口）
# -----------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 300
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.prefix}"
  retention_in_days = 14
  tags              = local.common_tags
}

# API Gateway -> Lambda 統合
resource "aws_apigatewayv2_integration" "job_submit" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.job_submit.invoke_arn
  payload_format_version = "2.0"
}

# ルート定義
resource "aws_apigatewayv2_route" "ingest" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /jobs/ingest"
  target    = "integrations/${aws_apigatewayv2_integration.job_submit.id}"
}

resource "aws_apigatewayv2_route" "status" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /jobs/{job_id}/status"
  target    = "integrations/${aws_apigatewayv2_integration.job_submit.id}"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.job_submit.id}"
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_submit.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "s3_bucket_name" {
  description = "S3 bucket name for attachments"
  value       = aws_s3_bucket.attachments.bucket
}

output "sqs_queue_url" {
  description = "SQS queue URL for jobs"
  value       = aws_sqs_queue.jobs.url
}

output "lambda_job_submit_arn" {
  description = "Job submit Lambda ARN"
  value       = aws_lambda_function.job_submit.arn
}

output "lambda_worker_arn" {
  description = "Worker Lambda ARN"
  value       = aws_lambda_function.worker.arn
}
