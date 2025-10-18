# Artbase Data Processor

## Request from local environment

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://artbase-data-processor-514901770365.asia-northeast1.run.app/health
```

## Firestore Authentication

To authenticate your local environment with Firestore, run the following command and follow the prompts to log in with your Google account:

```bash
gcloud auth application-default login
```

This command obtains user credentials and stores them in a known location as Application Default Credentials (ADC).

These credentials enable your local applications to access Google Cloud APIs securely without requiring explicit credential configuration in your code.

Unlike `gcloud auth login`, which authenticates the `gcloud` CLI tool itself, this command generates credentials specifically for your applications using Google Cloud client libraries. The stored credentials are typically saved at:

- Linux/macOS: `$HOME/.config/gcloud/application_default_credentials.json`
- Windows: `%APPDATA%\gcloud\application_default_credentials.json`

After running this command, your local environment will automatically use these credentials when interacting with Firestore or other Google Cloud services, simplifying authentication during development.

For more details, see the official documentation:  
https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment
