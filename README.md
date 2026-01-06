<h1>FinSight AI</h1>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1W9CbM8eaoJN78loPkgeBtKwZyXwIp7Hy

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Dockerfile
```
# Step 1: Use a simple web server
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Force a build of the assets
RUN npm run build 

# Step 2: Serve with Nginx to handle CSR routing
FROM nginx:alpine
# Copy the built files from AI Studio
COPY --from=builder /app/dist /usr/share/nginx/html
# (Optional) Copy a custom nginx.conf if you have CSR routing issues
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
