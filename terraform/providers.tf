# Terraform Version and Provider Configuration
# Last Updated: 2025-11-20

terraform {
  required_version = ">= 1.10"

  # HCP Terraform Backend Configuration
  cloud {
    organization = "<HCP_TERRAFORM_ORG>" # Replace with your HCP Terraform organization name

    workspaces {
      name = "public-record-data-scrapper" # Workspace name matches GitHub repository
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21" # Latest: 6.21.0
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7" # Latest: 3.7.2
    }
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Application = "UCC-MCA-Intelligence-Platform"
      Repository  = "public-record-data-scrapper"
    }
  }
}
