output "ecs_cluster_name" {
  value = aws_ecs_cluster.alloy.name
}

output "ecs_service_name" {
  value = aws_ecs_service.alloy.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.alloy.arn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.alloy.repository_url
}
