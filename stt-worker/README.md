# STT Worker (Docker)

This directory contains the Docker assets for the STT worker.
The worker logic itself lives in the main repo under `scripts/`.

## Prerequisites
- Docker + Docker Compose
- Environment variables stored in `stt-worker/.env`

## Run
From the repo root:

```bash
docker compose -f stt-worker/docker-compose.yml up -d --build
```

## Logs

```bash
docker logs -f --tail 200 dialoguelab-stt-worker
```

## Stop

```bash
docker compose -f stt-worker/docker-compose.yml down
```

## Notes
- The container runs the worker script from `scripts/stt-worker.mjs`.
- Set `STT_DEBUG=1` in `stt-worker/.env` to enable config + ffprobe logs.
