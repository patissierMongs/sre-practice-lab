FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    # ─── HTTP / Web ───
    curl \
    wget \
    httpie \
    # ─── Network scanning & recon ───
    nmap \
    masscan \
    nikto \
    # ─── DNS ───
    dnsutils \
    # ─── Network utilities ───
    net-tools \
    iputils-ping \
    traceroute \
    mtr-tiny \
    netcat-openbsd \
    socat \
    iproute2 \
    iptables \
    tcpdump \
    tshark \
    # ─── SSL/TLS ───
    openssl \
    sslscan \
    # ─── Text processing & scripting ───
    bc \
    jq \
    vim-tiny \
    less \
    procps \
    lsof \
    strace \
    # ─── Stress testing ───
    hping3 \
    arping \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with hot-reload in development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
