#!/bin/bash
export PS1="\[\033[1;31m\][RED-TEAM]\[\033[0m\] \[\033[0;31m\]\u@\h\[\033[0m\]:\w\$ "
echo -e "\033[1;31m"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     RED TEAM - Attack Terminal       ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║  nmap, hping3, curl, nc, masscan     ║"
echo "  ║  masscan, socat, openssl, httpie     ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "\033[0m"
echo -e "\033[33mTargets: nginx(80), backend(8000), postgres(5432), redis(6379)\033[0m"
echo ""
alias scan='nmap -sV -T4 --open'
alias flood='curl -s -o /dev/null -w "%{http_code}"'
alias headers='curl -sI'
