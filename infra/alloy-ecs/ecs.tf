resource "aws_ecs_task_definition" "alloy" {
  family                   = "popsuites-alloy"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([
    {
      name      = "alloy"
      image     = "${aws_ecr_repository.alloy.repository_url}:2026-08-18"
      essential = true
      secrets = [
        {
          name      = "GRAFANA_CLOUD_USERNAME"
          valueFrom = "${aws_secretsmanager_secret.grafana_cloud.arn}:username::"
        },
        {
          name      = "GRAFANA_CLOUD_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.grafana_cloud.arn}:password::"
        },
        {
          name      = "METRICS_SCRAPE_TOKEN"
          valueFrom = aws_secretsmanager_secret.metrics_scrape_token.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/popsuites-alloy"
          "awslogs-region"        = "ap-south-1"
          "awslogs-stream-prefix" = "alloy"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "alloy" {
  name                           = "popsuites-alloy-service"
  cluster                        = aws_ecs_cluster.alloy.id
  task_definition                = aws_ecs_task_definition.alloy.arn
  desired_count                  = 1
  launch_type                    = "FARGATE"
  availability_zone_rebalancing  = "ENABLED"

  network_configuration {
    subnets          = local.subnet_ids
    security_groups  = [data.aws_security_group.default.id]
    assign_public_ip = true
  }
}
