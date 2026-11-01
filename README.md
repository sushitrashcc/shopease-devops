# ShopEase DevOps Platform — PBL-III

**Luv Arora · RA2311027010117 · Section AM2**

An end-to-end DevOps project built on **AWS Academy Learner Lab** for an e-commerce company (*ShopEase*) and its
healthcare partner service (*MediCare+*). It covers three practicals:

| # | Practical | Jenkins job | Live URL |
|---|-----------|-------------|----------|
| 7 | CI/CD pipeline to deploy a Dockerized app on Kubernetes using Jenkins | `P7-ShopEase-CICD` | `http://<EC2-IP>:30080` |
| 8 | Automated Blue-Green deployment using Jenkins, Kubernetes, Docker | `P8-ShopEase-BlueGreen` | live `:30081`, preview `:30091` |
| 9 | Secure DevOps (DevSecOps) implementation in a healthcare system | `P9-MediCare-DevSecOps` | `http://<EC2-IP>:30082` |

## Architecture

```
 Developer ──git push──▶ GitHub (this repo)
                             │  pollSCM (every 2 min)
                             ▼
 ┌──────────────────── AWS EC2 t3.large (Ubuntu 22.04) ─────────────────────┐
 │  Jenkins (Docker, Configuration-as-Code)                                  │
 │    ├─ Docker CLI ──▶ Docker Engine ──▶ Private registry  localhost:5000   │
 │    ├─ Gitleaks · Semgrep · Trivy · OWASP ZAP  (security gates)            │
 │    └─ kubectl ──▶ k3s Kubernetes cluster                                  │
 │                    ├─ ns shopease     : Deployment x2 + NodePort 30080    │
 │                    ├─ ns shopease-bg  : blue/green Deployments,           │
 │                    │                    live svc 30081 / preview 30091    │
 │                    └─ ns medicare     : hardened Deployment, Secret,      │
 │                                         NetworkPolicy, PSA "restricted"   │
 └───────────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
app/              ShopEase storefront + REST API (Node.js/Express), multi-stage Dockerfile, unit tests
healthcare/       MediCare+ patient-records API with security controls, audit/test stages
k8s/cicd/         Practical 7 manifests
k8s/bluegreen/    Practical 8 services + deployment template
k8s/devsecops/    Practical 9 hardened manifests (PSA restricted, NetworkPolicy, non-root, read-only FS)
pipelines/        Jenkinsfile.cicd, Jenkinsfile.bluegreen, Jenkinsfile.devsecops
jenkins/          Custom Jenkins image + JCasC (jobs created automatically)
infra/            launch-ec2.sh (run in Learner Lab terminal), user-data.sh, bootstrap.sh
.semgrep/         Custom SAST rules for healthcare code
scripts/          jenkins-build helper
```

## Run it

1. Start the Learner Lab, open its terminal and run
   `curl -fsSL https://raw.githubusercontent.com/sushitrashcc/shopease-devops/main/infra/launch-ec2.sh | bash`
2. Wait ~10 min for the bootstrap (`sudo tail -f /var/log/shopease-bootstrap.log` on the instance).
3. Open Jenkins at `http://<EC2-IP>:8080` (anonymous read; admin password in `~/jenkins-admin.pass`).
4. Trigger builds: `jenkins-build P7-ShopEase-CICD`, `jenkins-build P8-ShopEase-BlueGreen VERSION=v2`,
   `jenkins-build P9-MediCare-DevSecOps`.
5. **Stop the instance when done** to save lab credit.

## Tools used
Git/GitHub · Jenkins (Pipeline, JCasC, Job DSL) · Docker (multi-stage builds) · Docker Registry · Kubernetes (k3s) ·
AWS EC2/VPC/Security Groups/IAM instance profile · Gitleaks · Semgrep · npm audit · Trivy (fs, image, IaC) · OWASP ZAP
