# Deployment

## Ziel

- Web ueber Nginx auf Port 80/443
- API intern auf `127.0.0.1:4000`
- Web intern auf `127.0.0.1:3000`
- Worker als separater systemd-Dienst

## Serverpfad

- Repo: `/opt/kleinanzeige`

## Erstes Setup

```bash
sudo mkdir -p /opt/kleinanzeige
sudo chown -R $USER:$USER /opt/kleinanzeige
git clone git@github.com:kiratz/Kleinanzeige.git /opt/kleinanzeige
cd /opt/kleinanzeige
cp .env.example .env
npm install
```

## Dienste installieren

```bash
sudo cp deploy/kleinanzeige-api.service /etc/systemd/system/
sudo cp deploy/kleinanzeige-web.service /etc/systemd/system/
sudo cp deploy/kleinanzeige-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kleinanzeige-api kleinanzeige-web kleinanzeige-worker
```

## Nginx installieren

```bash
sudo cp deploy/nginx.kleinanzeige.conf /etc/nginx/sites-available/kleinanzeige.conf
sudo ln -sf /etc/nginx/sites-available/kleinanzeige.conf /etc/nginx/sites-enabled/kleinanzeige.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Update

```bash
cd /opt/kleinanzeige
git pull
npm install
sudo systemctl restart kleinanzeige-api kleinanzeige-web kleinanzeige-worker
```
