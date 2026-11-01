#!/bin/bash
# EC2 user-data: clone the project and run the bootstrap. Log: /var/log/shopease-bootstrap.log
exec > /var/log/shopease-bootstrap.log 2>&1
set -eux
apt-get update -y
apt-get install -y git jq curl
git clone https://github.com/sushitrashcc/shopease-devops.git /opt/shopease
bash /opt/shopease/infra/bootstrap.sh
