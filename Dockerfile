FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /home/pwuser/app

# Install node dependencies from lockfile first to maximize layer cache reuse.
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy repository files after dependencies.
COPY . .

# Run tests as non-root by default.
USER pwuser

CMD ["npx", "playwright", "test", "--reporter=list", "--workers=1"]
