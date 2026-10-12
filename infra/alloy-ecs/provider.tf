terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state for now. Revisit S3 remote state + DynamoDB locking once
  # there's a co-founder/hire also touching this infra.
}

provider "aws" {
  region = "ap-south-1"

  default_tags {
    tags = {
      Project   = "popsuites"
      Component = "alloy-observability"
      ManagedBy = "terraform"
    }
  }
}
