# Runbook: Cloud Deployment (VPS + SSL + Domain + Backups)

## 1) Provision VPS and base hardening

Run as non-root user `deploy`:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
sudo apt install docker-compose-plugin -y
sudo apt install certbot python3-certbot-nginx -y
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

Configure firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2) Deploy application on VPS

```bash
sudo mkdir -p /opt/iqra-sms
sudo chown deploy:deploy /opt/iqra-sms
cd /opt/iqra-sms
git clone https://github.com/SAHAL-gpp-hub/sms.git .
```

Copy production env file from local machine (do not commit it):

```bash
scp .env.production deploy@<VPS_IP>:/opt/iqra-sms/.env
```

## 3) Domain + SSL

1. Point DNS A record (`iqraschool.in`, `www`) to VPS IP.
2. Wait for DNS propagation.
3. Request certificate:

```bash
sudo certbot --nginx -d iqraschool.in -d www.iqraschool.in
```

## 4) Start production stack

```bash
cd /opt/iqra-sms
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker exec sms_backend alembic upgrade head
```

## 5) Automated backups

```bash
chmod +x /opt/iqra-sms/scripts/backup.sh /opt/iqra-sms/scripts/restore.sh
```

Install daily cron:

```bash
crontab -e
```

```cron
0 2 * * * /opt/iqra-sms/scripts/backup.sh >> /var/log/iqra-backup.log 2>&1
```

Optional cloud sync is supported if `b2` CLI is installed and configured.

## 6) Zero-downtime migration checklist

1. Freeze risky changes Friday afternoon.
2. Take final DB backup on existing host.
3. Restore latest backup on VPS and run smoke tests.
4. Lower DNS TTL before cutover.
5. Switch DNS to VPS.
6. Validate login, student list, fees, marks, and payment webhook.
7. Keep old host on standby for rollback window.
