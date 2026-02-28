
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
