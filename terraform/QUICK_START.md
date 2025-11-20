# Terraform Quick Start Guide

This guide will help you quickly set up the AWS infrastructure for the UCC-MCA Intelligence Platform.

## Prerequisites

Before you begin, ensure you have:

- [x] AWS account with appropriate permissions
- [x] [Terraform](https://www.terraform.io/downloads.html) >= 1.10 installed
- [x] [AWS CLI](https://aws.amazon.com/cli/) configured
- [x] [HCP Terraform](https://app.terraform.io/) account (free tier available)

## Step 1: Configure HCP Terraform

### 1.1 Create HCP Terraform Account

1. Go to [HCP Terraform](https://app.terraform.io/)
2. Sign up for a free account (if you don't have one)
3. Create a new organization or use an existing one

### 1.2 Update Organization Name

Edit `terraform/providers.tf` and update the organization name:

```hcl
cloud {
  organization = "your-organization-name"  # ← Change this
  workspaces {
    name = "public-record-data-scrapper"
  }
}
```

### 1.3 Authenticate

```bash
terraform login
```

Follow the prompts to create an API token.

## Step 2: Configure AWS Credentials

### Option A: AWS CLI (Recommended)

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

### Option B: Environment Variables

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Option C: HCP Terraform Variables (For CI/CD)

1. Go to your workspace in HCP Terraform
2. Navigate to Variables
3. Add environment variables:
   - `AWS_ACCESS_KEY_ID` (sensitive)
   - `AWS_SECRET_ACCESS_KEY` (sensitive)

## Step 3: Configure Terraform Variables

### 3.1 Create Variables File

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

### 3.2 Edit Variables

Open `terraform.tfvars` and configure:

```hcl
# Required Variables
db_master_password = "YourSecurePassword123!"  # CHANGE THIS
redis_auth_token   = "YourSecureRedisToken456!" # CHANGE THIS
alert_email        = "your-email@example.com"   # CHANGE THIS

# Optional - Customize as needed
environment        = "production"
aws_region         = "us-east-1"
project_name       = "ucc-mca-platform"
```

**⚠️ Security Warning**: Never commit `terraform.tfvars` to git!

### 3.3 Alternative: Use HCP Terraform Variables

Instead of `terraform.tfvars`, you can set variables in HCP Terraform:

1. Go to your workspace → Variables
2. Add Terraform variables:
   - `db_master_password` (mark as sensitive)
   - `redis_auth_token` (mark as sensitive)
   - `alert_email`

## Step 4: Initialize Terraform

```bash
cd terraform
terraform init
```

Expected output:
```
Initializing modules...
Initializing the backend...
Initializing provider plugins...
Terraform has been successfully initialized!
```

## Step 5: Review the Plan

```bash
terraform plan
```

This will show you:
- Resources to be created (~40 resources)
- Estimated cost
- Configuration details

**Review carefully** before proceeding!

## Step 6: Apply Configuration

### For Production

```bash
terraform apply
```

Type `yes` when prompted.

⏱️ **Deployment time**: 15-20 minutes

### For Testing (Development)

Create a dev-specific variables file:

```bash
# terraform/dev.tfvars
environment              = "dev"
db_instance_class       = "db.t3.medium"
db_multi_az             = false
db_deletion_protection  = false
redis_node_type         = "cache.t3.micro"
redis_num_cache_nodes   = 1
db_master_password      = "DevPassword123!"
redis_auth_token        = "DevRedisToken456789!"
```

Apply with dev configuration:

```bash
terraform apply -var-file=dev.tfvars
```

## Step 7: Get Infrastructure Outputs

After successful deployment:

```bash
# View all outputs
terraform output

# View specific outputs
terraform output database_endpoint
terraform output redis_endpoint
terraform output data_exports_bucket_name
```

## Step 8: Configure Application

Create `.env` file in the application root:

```bash
# Generate .env from Terraform outputs
cat > ../.env << EOF
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://uccadmin:$(terraform output -raw db_master_password)@$(terraform output -raw database_endpoint | cut -d: -f1):5432/ucc_intelligence?sslmode=require
DB_NAME=$(terraform output -raw database_name)

# Redis Configuration
REDIS_URL=redis://$(terraform output -raw redis_endpoint):$(terraform output -raw redis_port)
REDIS_PASSWORD=$(terraform output -raw redis_auth_token)

# S3 Configuration
S3_EXPORTS_BUCKET=$(terraform output -raw data_exports_bucket_name)
S3_BACKUPS_BUCKET=$(terraform output -raw backups_bucket_name)

# AWS Configuration
AWS_REGION=us-east-1
EOF
```

## Step 9: Verify Deployment

### 9.1 Check AWS Console

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Verify resources:
   - **VPC**: `ucc-mca-platform-production-vpc`
   - **RDS**: `ucc-mca-platform-production-postgresql`
   - **ElastiCache**: `ucc-mca-platform-production-redis`
   - **S3**: Two buckets created

### 9.2 Test Database Connection

```bash
# Install PostgreSQL client
brew install postgresql  # macOS
# OR
sudo apt-get install postgresql-client  # Ubuntu

# Test connection
psql "$(terraform output -raw database_endpoint)"
```

### 9.3 Monitor Resources

- **CloudWatch**: Check logs and metrics
- **SNS**: Verify email subscription (check your inbox)
- **S3**: Verify buckets are created

## Troubleshooting

### Issue: "Error: Access Denied"

**Solution**: Verify AWS credentials are correct:
```bash
aws sts get-caller-identity
```

### Issue: "Error: Backend configuration changed"

**Solution**: Reinitialize Terraform:
```bash
terraform init -reconfigure
```

### Issue: "Error: Resource already exists"

**Solution**: Import existing resource or change identifier:
```bash
terraform import aws_db_instance.postgresql existing-db-id
```

### Issue: "Error: Insufficient capacity"

**Solution**: Try a different instance type or region:
```hcl
db_instance_class = "db.t3.medium"  # Use smaller instance
```

## Environment-Specific Configurations

### Development Environment

Minimal cost configuration:

```hcl
environment              = "dev"
db_instance_class       = "db.t3.medium"
db_allocated_storage    = 50
db_multi_az             = false
db_deletion_protection  = false
redis_node_type         = "cache.t3.micro"
redis_num_cache_nodes   = 1
```

**Est. Cost**: ~$150/month

### Staging Environment

Production-like with reduced redundancy:

```hcl
environment              = "staging"
db_instance_class       = "db.t3.large"
db_multi_az             = true
redis_node_type         = "cache.t3.small"
```

**Est. Cost**: ~$350/month

### Production Environment

High availability and performance:

```hcl
environment              = "production"
db_instance_class       = "db.t3.xlarge"
db_allocated_storage    = 500
db_multi_az             = true
db_deletion_protection  = true
redis_node_type         = "cache.t3.medium"
redis_num_cache_nodes   = 2
```

**Est. Cost**: ~$512/month

## Updating Infrastructure

```bash
# Pull latest changes
git pull

# Review changes
terraform plan

# Apply updates
terraform apply
```

## Destroying Infrastructure

**⚠️ WARNING**: This will delete all resources and data!

### Before Destroying

1. Backup all data
2. Export critical logs
3. Notify stakeholders
4. Disable deletion protection:

```hcl
# In terraform.tfvars
db_deletion_protection = false
```

```bash
terraform apply  # Apply the change first
```

### Destroy Resources

```bash
terraform destroy
```

Type `yes` when prompted.

## Cost Optimization Tips

1. **Right-size instances**: Monitor CloudWatch metrics and adjust
2. **Use Reserved Instances**: Save 30-70% for 1-3 year commitments
3. **Development environments**: Use smaller instances and disable Multi-AZ
4. **S3 Lifecycle policies**: Already configured for automatic archival
5. **Stop non-production**: Shut down dev/staging outside business hours

## Next Steps

- [ ] Set up monitoring dashboards
- [ ] Configure backup verification
- [ ] Set up bastion host for database access
- [ ] Configure VPN for secure access
- [ ] Review and optimize security groups
- [ ] Set up cost alerts
- [ ] Configure log retention policies
- [ ] Set up disaster recovery plan

## Additional Resources

- [Full Documentation](README.md)
- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [HCP Terraform Docs](https://developer.hashicorp.com/terraform/cloud-docs)

## Support

Need help? 

- Open an [issue](https://github.com/ivi374forivi/public-record-data-scrapper/issues)
- Check [troubleshooting guide](README.md#troubleshooting)
- Review [AWS documentation](https://docs.aws.amazon.com/)

---

**Last Updated**: 2025-11-20  
**Terraform Version**: 1.10+  
**AWS Provider Version**: 6.21.0
