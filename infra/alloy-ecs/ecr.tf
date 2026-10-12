resource "aws_ecs_cluster" "alloy" {
  name = "popsuites-observability"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecr_repository" "alloy" {
  name                 = "popsuites-alloy"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}
