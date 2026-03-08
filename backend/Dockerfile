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
    # ─── Terminal multiplexer & shell ───
    tmux \
    screen \
    bash-completion \
    && rm -rf /var/lib/apt/lists/*

# Red/Blue team shell profiles
RUN echo '\n\
# Red Team prompt\n\
red_ps1() {\n\
  export PS1="\\[\\033[1;31m\\][RED-TEAM]\\[\\033[0m\\] \\[\\033[0;31m\\]\\u@\\h\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ "\n\
}\n\
# Blue Team prompt\n\
blue_ps1() {\n\
  export PS1="\\[\\033[1;34m\\][BLUE-TEAM]\\[\\033[0m\\] \\[\\033[0;36m\\]\\u@\\h\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ "\n\
}\n' >> /etc/bash.bashrc

# Red team bashrc
RUN echo '#!/bin/bash\n\
export PS1="\\[\\033[1;31m\\][RED-TEAM]\\[\\033[0m\\] \\[\\033[0;31m\\]\\u@\\h\\[\\033[0m\\]:\\w\\$ "\n\
echo -e "\\033[1;31m"\n\
echo "  ╔══════════════════════════════════════╗"\n\
echo "  ║     RED TEAM - Attack Terminal       ║"\n\
echo "  ╠══════════════════════════════════════╣"\n\
echo "  ║  nmap, hping3, curl, nc, nikto       ║"\n\
echo "  ║  masscan, socat, openssl, httpie     ║"\n\
echo "  ╚══════════════════════════════════════╝"\n\
echo -e "\\033[0m"\n\
echo -e "\\033[33mTargets: nginx(80), backend(8000), postgres(5432), redis(6379)\\033[0m"\n\
echo ""\n\
alias scan=\"nmap -sV -T4 --open\"\n\
alias flood=\"curl -s -o /dev/null -w %{http_code}\"\n\
alias headers=\"curl -sI\"\n\
' > /etc/profile.d/redteam.sh

# Blue team bashrc
RUN echo '#!/bin/bash\n\
export PS1="\\[\\033[1;34m\\][BLUE-TEAM]\\[\\033[0m\\] \\[\\033[0;36m\\]\\u@\\h\\[\\033[0m\\]:\\w\\$ "\n\
echo -e "\\033[1;34m"\n\
echo "  ╔══════════════════════════════════════╗"\n\
echo "  ║    BLUE TEAM - Defense Terminal      ║"\n\
echo "  ╠══════════════════════════════════════╣"\n\
echo "  ║  tcpdump, tshark, iptables, ss       ║"\n\
echo "  ║  netstat, lsof, strace, top          ║"\n\
echo "  ╚══════════════════════════════════════╝"\n\
echo -e "\\033[0m"\n\
echo -e "\\033[33mMonitoring: tcpdump -i any, ss -tlnp, netstat -an\\033[0m"\n\
echo ""\n\
alias watch-traffic=\"tcpdump -i any -n -c 50\"\n\
alias watch-conns=\"ss -tlnp\"\n\
alias watch-ports=\"netstat -an | grep ESTABLISHED | sort\"\n\
alias block-ip=\"iptables -A INPUT -s\"\n\
' > /etc/profile.d/blueteam.sh

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with hot-reload in development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
