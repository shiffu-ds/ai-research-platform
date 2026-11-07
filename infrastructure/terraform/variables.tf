variable "project_name" {
  description = "Logical name of the platform."
  type        = string
  default     = "autonomous-ai-research-platform"
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition = contains(
      ["development", "staging", "production"],
      var.environment
    )

    error_message = "environment must be development, staging, or production."
  }
}
