#!/bin/bash
export PS1="\[\033[1;34m\][BLUE-TEAM]\[\033[0m\] \[\033[0;36m\]\u@\h\[\033[0m\]:\w\$ "
echo -e "\033[1;34m"
echo "  ╔══════════════════════════════════════╗"
echo "  ║    BLUE TEAM - Defense Terminal      ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║  tcpdump, tshark, iptables, ss       ║"
echo "  ║  netstat, lsof, strace, top          ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "\033[0m"
echo -e "\033[33mMonitoring: tcpdump -i any, ss -tlnp, netstat -an\033[0m"
echo ""
alias watch-traffic='tcpdump -i any -n -c 50'
alias watch-conns='ss -tlnp'
alias watch-ports='netstat -an | grep ESTABLISHED | sort'
alias block-ip='iptables -A INPUT -s'
