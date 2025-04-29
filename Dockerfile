FROM nginx:alpine

# Copy nginx configuration (using a command that ensures it takes precedence)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx configuration to avoid conflicts
RUN rm -f /etc/nginx/conf.d/default.conf.default

# Set the correct working directory
WORKDIR /usr/share/nginx/html

# Copy static files to nginx html directory
COPY index.html video.html ./
COPY app.js video.js styles.css ./

# Debug: List files to verify they're in the right place
RUN ls -la /usr/share/nginx/html/

# Expose port 8080
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]