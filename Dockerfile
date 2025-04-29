FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files to nginx html directory
COPY index.html video.html /usr/share/nginx/html/
COPY app.js video.js styles.css /usr/share/nginx/html/

# Create assets directory if there are any assets
RUN mkdir -p /usr/share/nginx/html/assets

# Expose port 8080
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]