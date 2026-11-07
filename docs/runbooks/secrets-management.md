# M5 Secrets Management Policy

## Purpose

This document defines how secrets must be handled across development,
staging, CI/CD, and production for the Autonomous AI Research Platform.

## 1. What Is a Secret

Secrets include:

- Database passwords
- API keys
- AI provider credentials
- Object-storage access keys
- OAuth client secrets
- Private keys
- Signing keys
- Tokens
- Cloud credentials
- Encryption keys

Secrets must never be committed to Git.

## 2. Local Development

Local development secrets must be stored only in:

.env

The repository provides:

.env.example

as a template containing variable names but no real credentials.

Developers should create their local file with:

cp .env.example .env

The .env file must remain ignored by Git.

## 3. CI/CD

CI secrets must be stored in the CI platform's encrypted secret store.

GitHub Actions workflows must reference secrets through the platform secret
mechanism and must never hard-code credential values into workflow YAML.

Secrets must not be printed to logs.

## 4. Staging and Production

Staging and production credentials must not be stored in:

- Git
- Terraform source files
- Docker Compose files
- Environment templates
- Shell scripts
- Documentation
- Container images

The final deployment should retrieve secrets from an approved secret manager.

Examples include:

- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager

The exact production provider will be selected when the deployment platform is
confirmed.

## 5. Terraform

Terraform source code may define secret references, but not secret values.

Files that may contain secrets, including:

*.tfvars
*.tfvars.json

must remain ignored by Git.

Terraform state must be treated as sensitive because providers may store
resource values inside state.

Production Terraform state must eventually use a protected remote backend with
access control and encryption.

## 6. Rotation

Production secrets should support rotation.

If a credential is exposed:

1. Revoke or rotate it immediately.
2. Remove the exposed value from active systems.
3. Review logs and access history.
4. Replace affected application configuration.
5. Redeploy affected services.
6. Document the incident.

Removing a secret from the latest Git commit alone is not sufficient if the
secret already exists in repository history.

## 7. Logging

Applications and infrastructure must never intentionally log:

- Passwords
- API keys
- Access tokens
- Refresh tokens
- Private keys
- Full connection strings containing credentials

Logs should redact sensitive values where applicable.

## 8. Production Requirement

Production deployment is not approved until:

- Secrets are externalized
- Git contains no production credentials
- CI secrets use encrypted secret storage
- Production secret access is least-privilege
- Terraform state is protected
- Secret rotation procedures are documented
