# Guardrails for AI Code Assistant

## Security Rules
- Never expose or print credentials.
- Secrets must be stored only in `.env` files.
- Do not commit `.env` files to the repository.

## Salesforce Integration Rules
- Use environment variables for all Salesforce credentials:
  - SALESFORCE_USERNAME
  - SALESFORCE_PASSWORD
  - SALESFORCE_SECURITY_TOKEN
  - SALESFORCE_CLIENT_ID
  - SALESFORCE_CLIENT_SECRET

- Do not hardcode credentials in code.

## Code Standards
- Follow project folder structure.
- Use environment configuration from `.env`.
- Validate all external API responses.

## Logging Rules
- Never log passwords or tokens.
- Mask sensitive data.

Example:Token: ****1234


## Deployment Rules
- Production credentials must come from environment variables or secret manager.
- `.env` files must not be committed to Git.