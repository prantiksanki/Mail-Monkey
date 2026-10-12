data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "popsuites-alloy-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

# AWS-managed policy, already attached
resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy already attached, granting read on the Grafana Cloud secret
data "aws_iam_policy" "grafana_secret_read" {
  name = "popsuites-grafana-secret-read"
}

resource "aws_iam_role_policy_attachment" "grafana_secret_read" {
  role       = aws_iam_role.execution.name
  policy_arn = data.aws_iam_policy.grafana_secret_read.arn
}

# Custom policy already attached, granting read on the scrape token secret
data "aws_iam_policy" "metrics_token_read" {
  name = "popsuites-metrics-token-read"
}

resource "aws_iam_role_policy_attachment" "metrics_token_read" {
  role       = aws_iam_role.execution.name
  policy_arn = data.aws_iam_policy.metrics_token_read.arn
}
