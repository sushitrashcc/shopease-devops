#!/bin/bash
# Run from the AWS Academy Learner Lab terminal (AWS CLI is pre-configured there).
# Creates the security group and launches the single EC2 "DevOps server" that hosts
# Docker, a private registry, Jenkins and a k3s Kubernetes cluster.
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
REPO_RAW="https://raw.githubusercontent.com/sushitrashcc/shopease-devops/main"

VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=shopease-devops-sg Name=vpc-id,Values=$VPC \
      --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  SG=$(aws ec2 create-security-group --group-name shopease-devops-sg --vpc-id $VPC \
        --description "ShopEase DevOps PBL-III: SSH, Jenkins, app NodePorts" --query GroupId --output text)
  for p in 22 8080 30080 30081 30082 30091; do
    aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port $p --cidr 0.0.0.0/0 >/dev/null
  done
fi
echo "Security group: $SG"

AMI=$(aws ec2 describe-images --owners 099720109477 \
  --filters 'Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' 'Name=state,Values=available' \
  --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text)
echo "Ubuntu 22.04 AMI: $AMI"

curl -fsSL "$REPO_RAW/infra/user-data.sh" -o /tmp/user-data.sh

ID=$(aws ec2 run-instances --image-id $AMI --instance-type t3.large --key-name vockey \
  --security-group-ids $SG --iam-instance-profile Name=LabInstanceProfile \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --user-data file:///tmp/user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=shopease-devops-server},{Key=Project,Value=PBL-III}]' \
  --query 'Instances[0].InstanceId' --output text)
echo "Instance: $ID - waiting for it to run..."
aws ec2 wait instance-running --instance-ids $ID
aws ec2 describe-instances --instance-ids $ID \
  --query 'Reservations[0].Instances[0].{Id:InstanceId,Type:InstanceType,State:State.Name,PublicIP:PublicIpAddress,AZ:Placement.AvailabilityZone}' --output table
