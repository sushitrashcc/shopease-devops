# Custom Jenkins controller image: Jenkins LTS + Docker CLI + kubectl + security scanners,
# plugins pre-installed and all jobs created through Configuration-as-Code (no manual clicking).
FROM jenkins/jenkins:lts-jdk17

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg jq git openssl python3-pip \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
 && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
 && rm -rf /var/lib/apt/lists/*

# kubectl
RUN curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.31.4/bin/linux/amd64/kubectl" && chmod +x /usr/local/bin/kubectl

# Trivy (container / filesystem / IaC scanner) - pinned version
ARG TRIVY_VERSION=0.72.0
RUN curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" | tar -xz -C /usr/local/bin trivy

# Gitleaks (secret scanner) - pinned version
ARG GITLEAKS_VERSION=8.21.2
RUN curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" | tar -xz -C /usr/local/bin gitleaks

# Semgrep (SAST)
RUN pip3 install --no-cache-dir --break-system-packages semgrep

USER jenkins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
COPY casc/ /usr/share/jenkins/ref/casc/
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc/jenkins.yaml \
    JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
