#!/bin/bash
# Provisions the DevOps server: Docker, private registry, k3s (Kubernetes) and Jenkins (as code).
set -eux
export DEBIAN_FRONTEND=noninteractive
REPO_URL="https://github.com/sushitrashcc/shopease-devops.git"

# 4 GB swap as headroom for image builds
if [ ! -f /swapfile ]; then fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile; fi

# ---- Docker Engine ----
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
systemctl enable --now docker

# ---- Private Docker registry (images built by Jenkins are pushed here) ----
docker inspect registry >/dev/null 2>&1 || docker run -d --restart=always --name registry -p 5000:5000 registry:2

# ---- k3s: lightweight certified Kubernetes, configured to pull from the local registry ----
mkdir -p /etc/rancher/k3s
cat > /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  "localhost:5000":
    endpoint:
      - "http://localhost:5000"
EOF
command -v k3s >/dev/null || curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644 --disable traefik" sh -
until kubectl get nodes 2>/dev/null | grep -q " Ready"; do sleep 5; done
mkdir -p /home/ubuntu/.kube && cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config && chown -R ubuntu:ubuntu /home/ubuntu/.kube

# ---- Jenkins (custom image with Docker CLI, kubectl, Trivy, Gitleaks, Semgrep + JCasC jobs) ----
[ -f /home/ubuntu/jenkins-admin.pass ] && ADMIN_PASSWORD=$(cat /home/ubuntu/jenkins-admin.pass) || ADMIN_PASSWORD=$(openssl rand -hex 12)
echo "$ADMIN_PASSWORD" > /home/ubuntu/jenkins-admin.pass && chown ubuntu:ubuntu /home/ubuntu/jenkins-admin.pass && chmod 600 /home/ubuntu/jenkins-admin.pass
docker build -t shopease-jenkins /opt/shopease/jenkins
docker volume create jenkins_home
docker rm -f jenkins >/dev/null 2>&1 || true
docker run -d --name jenkins --restart=always --network host \
  --group-add "$(getent group docker | cut -d: -f3)" \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/rancher/k3s/k3s.yaml:/kube/config:ro \
  -e KUBECONFIG=/kube/config \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -e REPO_URL="$REPO_URL" \
  shopease-jenkins

until curl -sf -o /dev/null http://localhost:8080/login; do sleep 5; done
install -m 755 /opt/shopease/scripts/jenkins-build.sh /usr/local/bin/jenkins-build
touch /opt/shopease-ready
echo "BOOTSTRAP COMPLETE"
