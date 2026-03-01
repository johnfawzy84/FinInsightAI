# Step 1: Use a simple web server
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set build argument for Gemini API Key
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Fix blocked resources before and after build
RUN chmod +x fix-blocked-resources.sh && ./fix-blocked-resources.sh index.html
# Force a build of the assets
RUN npm run build 
RUN ./fix-blocked-resources.sh dist/index.html

# Step 2: Serve with Nginx to handle CSR routing
FROM nginx:alpine
# Copy the built files from the build stage
COPY --from=builder /app/dist /usr/share/nginx/html
# (Optional) Copy a custom nginx.conf if you have CSR routing issues
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]