# UCC-MCA Intelligence Platform - Terraform Infrastructure

This directory contains Terraform configuration to provision AWS infrastructure for the UCC-MCA Intelligence Platform.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Outputs](#outputs)
- [Cost Estimation](#cost-estimation)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This Terraform configuration provisions a complete production-ready infrastructure on AWS including:

- **Networking**: VPC with public, private, and database subnets across multiple availability zones
- **Database**: RDS PostgreSQL 14+ with Multi-AZ, automated backups, and encryption
- **Caching**: ElastiCache Redis 7+ with replication and encryption
- **Storage**: S3 buckets for data exports and backups with lifecycle policies
- **Monitoring**: CloudWatch logs, metrics, and alarms with SNS notifications
- **Security**: Security groups, encrypted storage, and IAM roles following best practices

### Resources Created

| Resource Type | Purpose | High Availability |
|---------------|---------|-------------------|
| VPC | Network isolation | Multi-AZ |
| RDS PostgreSQL | Primary database | Multi-AZ |
| ElastiCache Redis | Caching layer | Multi-AZ with replication |
| S3 Buckets | Data exports & backups | Cross-region replication ready |
| Security Groups | Network security | N/A |
| CloudWatch | Monitoring & alerting | Regional |
| SNS Topics | Alert notifications | Regional |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VPC (10.0.0.0/16)                    │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │  Public AZ-A  │  │  Public AZ-B  │  │  Public AZ-C  │  │
│  │  10.0.1.0/24  │  │  10.0.2.0/24  │  │  10.0.3.0/24  │  │
│  │  NAT Gateway  │  │  NAT Gateway  │  │  NAT Gateway  │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  │
│          │                  │                  │           │
│  ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐  │
│  │ Private AZ-A  │  │ Private AZ-B  │  │ Private AZ-C  │  │
│  │ 10.0.11.0/24  │  │ 10.0.12.0/24  │  │ 10.0.13.0/24  │  │
│  │  App Servers  │  │  App Servers  │  │  App Servers  │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│          │                  │                  │           │
│  ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐  │
│  │Database AZ-A  │  │Database AZ-B  │  │Database AZ-C  │  │
│  │ 10.0.21.0/24  │  │ 10.0.22.0/24  │  │ 10.0.23.0/24  │  │
│  │  RDS Primary  │  │  RDS Standby  │  │     Redis     │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
          ┌───▼────┐                   ┌────▼────┐
          │   S3   │                   │CloudWatch│
          │ Buckets│                   │   SNS   │
          └────────┘                   └─────────┘
```

## 📦 Prerequisites

### Required Tools

- [Terraform](https://www.terraform.io/downloads.html) >= 1.10
- [AWS CLI](https://aws.amazon.com/cli/) >= 2.x
- Access to [HCP Terraform](https://app.terraform.io/) (recommended) or AWS credentials

### AWS Permissions

The AWS user/role needs the following permissions:
- VPC management (EC2)
- RDS instance creation and management
- ElastiCache cluster creation and management
- S3 bucket creation and management
- CloudWatch logs and alarms
- SNS topic creation
- IAM role creation (for RDS monitoring)

### HCP Terraform Setup

1. Create an account at [HCP Terraform](https://app.terraform.io/)
2. Create an organization or use an existing one
3. Set the organization name in `providers.tf`:
   ```hcl
   cloud {
     organization = "your-org-name"  # Update this
     workspaces {
       name = "public-record-data-scrapper"
     }
   }
   ```
4. Authenticate: `terraform login`

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ivi374forivi/public-record-data-scrapper.git
cd public-record-data-scrapper/terraform
```

### 2. Configure Variables

Create a `terraform.tfvars` file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
# Required Variables
db_master_password = "YourSecurePassword123!"
redis_auth_token   = "YourSecureRedisToken456!"
alert_email        = "your-email@example.com"

# Optional - Override defaults
environment        = "production"
aws_region         = "us-east-1"
project_name       = "ucc-mca-platform"
```

**⚠️ Security Note**: Never commit `terraform.tfvars` to version control. Use HCP Terraform workspace variables for production.

### 3. Initialize Terraform

```bash
terraform init
```

This will:
- Download required provider plugins (AWS, Random)
- Download required modules (VPC, Security Groups, S3)
- Configure HCP Terraform backend

### 4. Review the Plan

```bash
terraform plan
```

Review the resources that will be created. Expected resource count: ~40 resources.

### 5. Apply Configuration

```bash
terraform apply
```

Type `yes` when prompted. Infrastructure provisioning takes approximately 15-20 minutes.

## ⚙️ Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `db_master_password` | PostgreSQL master password | `SecurePass123!` |
| `redis_auth_token` | Redis authentication token | `RedisToken456!` |

### Important Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `environment` | `production` | Environment name (dev/staging/production) |
| `aws_region` | `us-east-1` | AWS region for resources |
| `vpc_cidr` | `10.0.0.0/16` | VPC CIDR block |
| `db_instance_class` | `db.t3.large` | RDS instance type |
| `db_allocated_storage` | `100` | RDS storage in GB |
| `redis_node_type` | `cache.t3.medium` | Redis node type |
| `alert_email` | `""` | Email for CloudWatch alerts |

### Environment-Specific Configurations

#### Development

```hcl
environment               = "dev"
db_instance_class        = "db.t3.medium"
db_multi_az              = false
redis_node_type          = "cache.t3.micro"
redis_num_cache_nodes    = 1
db_deletion_protection   = false
```

#### Staging

```hcl
environment               = "staging"
db_instance_class        = "db.t3.large"
db_multi_az              = true
redis_node_type          = "cache.t3.small"
redis_num_cache_nodes    = 2
```

#### Production

```hcl
environment               = "production"
db_instance_class        = "db.t3.xlarge"
db_multi_az              = true
redis_node_type          = "cache.t3.medium"
redis_num_cache_nodes    = 2
db_deletion_protection   = true
```

## 📤 Outputs

After successful deployment, Terraform provides the following outputs:

### Connection Information

```bash
# View all outputs
terraform output

# View specific output
terraform output database_endpoint
terraform output redis_endpoint
```

### Key Outputs

| Output | Description | Usage |
|--------|-------------|-------|
| `database_endpoint` | PostgreSQL connection string | Application DATABASE_URL |
| `redis_endpoint` | Redis primary endpoint | Application REDIS_URL |
| `data_exports_bucket_name` | S3 bucket for exports | Data export destination |
| `vpc_id` | VPC identifier | Network reference |
| `nat_gateway_ips` | NAT Gateway IPs | Whitelist for external APIs |

### Environment Variables for Application

Create `.env` file using outputs:

```bash
# Generate .env from Terraform outputs
cat > .env << EOF
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://$(terraform output -raw database_endpoint)?sslmode=require
DB_NAME=$(terraform output -raw database_name)

# Redis Configuration
REDIS_URL=redis://$(terraform output -raw redis_endpoint):$(terraform output -raw redis_port)

# S3 Configuration
S3_EXPORTS_BUCKET=$(terraform output -raw data_exports_bucket_name)
S3_BACKUPS_BUCKET=$(terraform output -raw backups_bucket_name)

# AWS Configuration
AWS_REGION=us-east-1
EOF
```

## 💰 Cost Estimation

### Monthly Cost Breakdown (Production Configuration)

| Resource | Configuration | Estimated Monthly Cost |
|----------|---------------|------------------------|
| RDS PostgreSQL | db.t3.large, 100GB, Multi-AZ | ~$220 |
| ElastiCache Redis | cache.t3.medium x2, Multi-AZ | ~$120 |
| VPC | NAT Gateways x3 | ~$100 |
| S3 Storage | 100GB | ~$2.50 |
| CloudWatch | Logs + Alarms | ~$20 |
| Data Transfer | Varies | ~$50 |
| **Total** | | **~$512.50/month** |

### Cost Optimization Tips

1. **Development/Staging**: Use smaller instance types and disable Multi-AZ
2. **Right-sizing**: Monitor CloudWatch metrics and adjust instance sizes
3. **Reserved Instances**: Purchase 1-year or 3-year reserved instances for 30-70% savings
4. **S3 Lifecycle**: Configure lifecycle policies to transition old data to Glacier
5. **NAT Gateways**: Consider NAT instances for dev/staging environments

### Development Configuration Cost

With `db.t3.medium` (no Multi-AZ) and `cache.t3.micro`: **~$150/month**

## 🔒 Security

### Security Features Implemented

✅ **Encryption at Rest**
- RDS: Encrypted storage with AWS KMS
- ElastiCache: Encryption enabled
- S3: Server-side encryption (AES-256)

✅ **Encryption in Transit**
- Redis: TLS/SSL enabled
- RDS: SSL/TLS enforced
- S3: HTTPS required

✅ **Network Security**
- Private subnets for databases
- Security groups with least privilege
- No public access to databases

✅ **Access Control**
- IAM roles with minimal permissions
- Redis authentication enabled
- PostgreSQL password authentication

✅ **Monitoring**
- CloudWatch logs for all services
- Alarms for critical metrics
- SNS notifications for alerts

### Best Practices

1. **Secrets Management**
   - Use HCP Terraform workspace variables (marked as sensitive)
   - Never commit secrets to version control
   - Rotate credentials regularly

2. **Network Access**
   - Use VPN or bastion hosts for database access
   - Restrict SSH access with `allowed_ssh_cidr`
   - Enable VPC Flow Logs for audit

3. **Backup & Recovery**
   - Automated RDS backups (7-day retention)
   - Redis snapshots (5-day retention)
   - S3 versioning enabled

## 🔧 Troubleshooting

### Common Issues

#### 1. Terraform Init Fails

```bash
Error: Failed to install provider
```

**Solution**: Ensure you have internet access and run:
```bash
terraform init -upgrade
```

#### 2. AWS Authentication Errors

```bash
Error: error configuring Terraform AWS Provider
```

**Solution**: Configure AWS credentials:
```bash
aws configure
# OR
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

#### 3. Resource Already Exists

```bash
Error: error creating DB Instance: DBInstanceAlreadyExists
```

**Solution**: Import existing resource or use different identifier:
```bash
terraform import aws_db_instance.postgresql existing-db-identifier
```

#### 4. Insufficient Permissions

```bash
Error: AccessDenied: User is not authorized
```

**Solution**: Ensure AWS user has required permissions (see Prerequisites).

#### 5. HCP Terraform Backend Issues

```bash
Error: Error loading state
```

**Solution**: Authenticate with HCP Terraform:
```bash
terraform login
```

### Validation Commands

```bash
# Validate configuration
terraform validate

# Format configuration
terraform fmt -recursive

# Check for drift
terraform plan -refresh-only

# View state
terraform show
```

### Debugging

Enable detailed logging:

```bash
export TF_LOG=DEBUG
terraform apply
```

## 📖 Additional Resources

### Terraform Documentation
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [HCP Terraform](https://developer.hashicorp.com/terraform/cloud-docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

### AWS Documentation
- [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [ElastiCache Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)
- [VPC Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-best-practices.html)

### Project Documentation
- [Main README](../README.md)
- [Deployment Guide](../docs/technical/DEPLOYMENT.md)
- [Database Schema](../database/README.md)

## 🔄 Maintenance

### Regular Tasks

1. **Updates**: Review and apply Terraform provider updates monthly
2. **Security**: Monitor AWS security bulletins and apply patches
3. **Backups**: Verify automated backups are completing successfully
4. **Costs**: Review AWS Cost Explorer monthly
5. **Logs**: Review CloudWatch logs for errors and warnings

### Updating Infrastructure

```bash
# Update providers
terraform init -upgrade

# Review changes
terraform plan

# Apply updates
terraform apply
```

### Destroying Infrastructure

⚠️ **WARNING**: This will delete all resources and data.

```bash
# Review what will be destroyed
terraform plan -destroy

# Destroy infrastructure
terraform destroy
```

Before destroying production:
1. Backup all data
2. Export critical logs
3. Notify stakeholders
4. Disable deletion protection: `db_deletion_protection = false`

## 📝 License

This infrastructure configuration is part of the UCC-MCA Intelligence Platform and is licensed under the MIT License.

---

**Need Help?** Open an issue on [GitHub](https://github.com/ivi374forivi/public-record-data-scrapper/issues) or contact the infrastructure team.
