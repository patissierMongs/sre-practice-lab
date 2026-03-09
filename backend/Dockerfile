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
    # ─── Terminal multiplexer & shell ───
    tmux \
    screen \
    bash-completion \
    && rm -rf /var/lib/apt/lists/*

# Red/Blue team shell profiles — COPY proper script files
COPY scripts/redteam.sh /etc/profile.d/redteam.sh
COPY scripts/blueteam.sh /etc/profile.d/blueteam.sh
RUN chmod +x /etc/profile.d/redteam.sh /etc/profile.d/blueteam.sh

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with hot-reload in development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
