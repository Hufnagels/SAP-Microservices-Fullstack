#!/bin/bash
# Run once as root on the LXC (10.63.10.111) to install Docker and prepare dirs
# ssh root@10.63.10.111 'bash -s' < scripts/lxc-setup.sh
set -e

echo "=== MicroServices — LXC bootstrap ==="

# Detect distro
if [ -f /etc/debian_version ]; then
  DISTRO="debian"
  OS_ID=$(. /etc/os-release && echo "$ID")   # ubuntu or debian
else
  echo "Only Debian/Ubuntu supported. Exiting."
  exit 1
fi

apt-get update -qq
apt-get install -y ca-certificates curl gnupg lsb-release

# Docker CE
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/$OS_ID \
  $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# Add pisti to docker group so non-root can manage containers
usermod -aG docker pisti 2>/dev/null || true

# Deployment directory structure
mkdir -p /opt/microservices
mkdir -p /opt/microservices/data/{pg-auth,pg-shared,pg-files,pg-maps,pg-labeling,pg-opcua,influxdb,prometheus,loki,grafana}
mkdir -p /opt/microservices/files
chmod -R 755 /opt/microservices

# Fix data directory ownership for containers that run as non-root UIDs:
#   mssql / Loki   → UID 10001
#   Grafana        → UID 472
#   Prometheus     → UID 65534 (nobody)
#   InfluxDB       → UID 1000
chown -R 10001:10001 /opt/microservices/data/mssql
chown -R 10001:10001 /opt/microservices/data/loki
chown -R 472:472     /opt/microservices/data/grafana
chown -R 65534:65534 /opt/microservices/data/prometheus
chown -R 1000:1000   /opt/microservices/data/influxdb

echo ""
echo "=== LXC ready ==="
echo "Now from your Mac, run:"
echo "  ./scripts/deploy.sh 10.63.10.111"
echo ""
echo "Then on the LXC:"
echo "  cd /opt/microservices"
echo "  cp .env.example .env && nano .env"
echo ""
echo "Start MSSQL and run init.sql:"
echo "  sudo docker compose -f infrastructure/mssql/docker-compose.yml up -d"
echo "  sleep 30"
echo "  sudo docker exec -i mssql_server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YOUR_SA_PASS' -No -C < infrastructure/mssql/init.sql"
