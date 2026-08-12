# Deployment Guide - War Card Game Simulator

This guide provides step-by-step instructions for deploying the War Card Game Simulator across various cloud hosting platforms.

---

## 🐋 1. Local & Production Deployment with Docker Compose

### Prerequisites
- Docker & Docker Compose installed.

### Steps
1. Configure environment credentials in `.env`:
   ```env
   TURSO_DATABASE_URL=libsql://war-game-maazkhurshid60.aws-ap-south-1.turso.io
   TURSO_AUTH_TOKEN=your-turso-token-here
   CORS_ORIGINS=http://localhost:3000
   ```
2. Build and launch services:
   ```bash
   docker-compose up --build -d
   ```
3. Access endpoints:
   - Frontend UI: `http://localhost:3000`
   - FastAPI Docs: `http://localhost:8000/docs`

---

## ⚡ 2. Deploy Frontend to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Deploy from the `frontend/` directory:
   ```bash
   cd frontend
   vercel --prod
   ```
3. Set Environment Variable in Vercel Dashboard:
   - `REACT_APP_API_URL`: `https://your-backend-railway-url.up.railway.app`

---

## 🚂 3. Deploy Backend to Railway

1. Install Railway CLI or connect via GitHub:
   ```bash
   railway login
   railway init
   ```
2. Set Root Directory to `backend/` in Railway dashboard.
3. Configure Railway Environment Variables:
   - `TURSO_DATABASE_URL`: `libsql://war-game-maazkhurshid60.aws-ap-south-1.turso.io`
   - `TURSO_AUTH_TOKEN`: `your-turso-token-here`
   - `CORS_ORIGINS`: `https://your-frontend-vercel.app`
4. Start command automatically detected from `Dockerfile` or `Procfile`:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

---

## 🟣 4. Deploy Backend to Heroku

1. Login and create Heroku app:
   ```bash
   heroku login
   heroku create war-card-game-api
   ```
2. Set Buildpack / Container:
   ```bash
   heroku stack:set container
   ```
3. Set Config Vars:
   ```bash
   heroku config:set TURSO_DATABASE_URL="libsql://war-game-maazkhurshid60.aws-ap-south-1.turso.io"
   heroku config:set TURSO_AUTH_TOKEN="your-token"
   heroku config:set CORS_ORIGINS="https://your-app.vercel.app"
   ```
4. Push and Deploy:
   ```bash
   git push heroku main
   ```

---

## 🌐 5. Deploy to Platform.sh

1. Add `.platform.app.yaml` in the root:
   ```yaml
   name: backend
   type: python:3.10
   disk: 1024
   hooks:
     build: |
       pip install -r backend/requirements.txt
   web:
     commands:
       start: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
   ```
2. Deploy via Platform CLI:
   ```bash
   platform push
   ```
