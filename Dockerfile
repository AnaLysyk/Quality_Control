FROM mcr.microsoft.com/playwright:v1.37.0-focal

WORKDIR /workspace

# Copy package files first for caching
COPY package.json package-lock.json* ./

RUN npm ci --prefer-offline --no-audit --progress=false

# Copy the rest of the repo
COPY . .

# Install playwright browsers (image may already include them)
RUN npx playwright install --with-deps || true

# Default command: run tests
CMD ["npx", "playwright", "test", "--reporter=list", "--workers=1"]
