output "project_name" {
  description = "Configured project name."
  value       = var.project_name
}

output "environment" {
  description = "Configured deployment environment."
  value       = var.environment
}

output "resource_prefix" {
  description = "Standard resource naming prefix."
  value       = local.resource_prefix
}

output "common_tags" {
  description = "Standard tags to apply to infrastructure resources."
  value       = local.common_tags
}
