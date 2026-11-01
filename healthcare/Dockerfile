# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- SCA: fail the build on HIGH/CRITICAL dependency vulnerabilities ----------
FROM deps AS audit
RUN npm audit --omit=dev --audit-level=high

# ---------- unit + security tests ----------
FROM deps AS test
COPY . .
RUN npm test

# ---------- hardened runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --chown=root:root package.json ./
COPY --chown=root:root src ./src
# Application files are owned by root and read-only for the runtime user
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/server.js"]
