# Artbase Data Processor

## Deployment Instructions

1. Build Image

```bash
docker build -t asia-northeast1-docker.pkg.dev/yuich-sandbox/cloud-run-source-deploy/artbase-data-processor .
```

2. Push Image to Artifact Registry

```bash
docker push asia-northeast1-docker.pkg.dev/yuich-sandbox/cloud-run-source-deploy/artbase-data-processor
```

3. Deploy to Cloud Run

```bash
gcloud run deploy artbase-data-processor \
  --image asia-northeast1-docker.pkg.dev/yuich-sandbox/cloud-run-source-deploy/artbase-data-processor \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```
