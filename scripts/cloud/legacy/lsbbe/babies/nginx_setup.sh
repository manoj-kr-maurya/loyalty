#!/bin/bash

echo -e "\e[34mInstalling and configuring Nginx...\e[0m"
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo -e "\e[34mObtaining SSL certificate with Certbot...\e[0m"
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$SUBDOMAIN"

echo -e "\e[34mConfiguring Nginx...\e[0m"
sudo bash -c "cat > /etc/nginx/sites-available/$SUBDOMAIN << EOF
map \"\$http_origin\" \$cors {
  default \"\";
  \"~^https?://lsbcus\\.littlebitpositive\\.com(:[0-9]+)?\$\" \"\$http_origin\";
  \"~^https?://lsborg\\.littlebitpositive\\.com(:[0-9]+)?\$\" \"\$http_origin\";
  \"~^https?://lsborg\\.web\\.app(:[0-9]+)?\$\" \"\$http_origin\";
  \"~^https?://lsbcus\\.web\\.app(:[0-9]+)?\$\" \"\$http_origin\";
}
server {
    server_name $SUBDOMAIN;

    location / {
        proxy_pass http://localhost:3003;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' \"\$cors\" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';

        if (\$request_method = OPTIONS) {
            add_header 'Access-Control-Allow-Origin' \"\$cors\" always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Length' 0;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            return 204;
        }
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/$SUBDOMAIN/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/$SUBDOMAIN/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = $SUBDOMAIN) {
        return 301 https://\$host\$request_uri;
    } # managed by Certbot

    listen 80;
    server_name $SUBDOMAIN;
    return 404; # managed by Certbot
}
EOF"

sudo ln -s /etc/nginx/sites-available/$SUBDOMAIN /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

echo -e "\e[32mLSBBE setup is complete. Your service is up and running!\e[0m"
