"""Docker API 기반 서비스 토폴로지 자동 발견"""
import structlog

logger = structlog.get_logger()

# 서비스 간 알려진 연결 패턴 (환경변수/설정 기반)
KNOWN_CONNECTIONS = {
    "sre-nginx": ["sre-frontend", "sre-backend"],
    "sre-backend": ["sre-postgres", "sre-redis"],
    "sre-prometheus": ["sre-backend"],
    "sre-grafana": ["sre-prometheus"],
    "sre-alertmanager": ["sre-prometheus"],
    "sre-traffic-generator": ["sre-nginx"],
}

SERVICE_ICONS = {
    "nginx": "🌐",
    "backend": "⚙️",
    "frontend": "🖥️",
    "postgres": "🗄️",
    "redis": "💾",
    "prometheus": "📊",
    "grafana": "📈",
    "alertmanager": "🔔",
    "traffic-generator": "💥",
}


def _short_name(container_name: str) -> str:
    """sre-backend → backend"""
    return container_name.replace("sre-", "")


async def get_topology() -> dict:
    """Docker API에서 컨테이너 정보를 읽어 토폴로지 생성"""
    nodes = []
    edges = []
    networks = {}

    try:
        import docker
        client = docker.from_env()
        containers = client.containers.list(all=True)

        for c in containers:
            name = c.name
            if not name.startswith("sre-"):
                continue

            short = _short_name(name)
            # 포트 정보
            ports = []
            port_bindings = c.attrs.get("NetworkSettings", {}).get("Ports") or {}
            for container_port, host_bindings in port_bindings.items():
                port_num = container_port.split("/")[0]
                host_port = ""
                if host_bindings:
                    host_port = host_bindings[0].get("HostPort", "")
                ports.append({
                    "container": int(port_num),
                    "host": int(host_port) if host_port else None,
                    "protocol": container_port.split("/")[1] if "/" in container_port else "tcp",
                })

            # 네트워크 정보
            net_settings = c.attrs.get("NetworkSettings", {}).get("Networks") or {}
            node_networks = []
            for net_name, net_info in net_settings.items():
                ip = net_info.get("IPAddress", "")
                subnet = ""
                # 네트워크 상세 정보
                if net_name not in networks:
                    try:
                        net_obj = client.networks.get(net_info.get("NetworkID", ""))
                        ipam_configs = net_obj.attrs.get("IPAM", {}).get("Config", [])
                        subnet = ipam_configs[0].get("Subnet", "") if ipam_configs else ""
                    except Exception:
                        subnet = ""
                    networks[net_name] = {"name": net_name, "subnet": subnet}
                node_networks.append({"name": net_name, "ip": ip})

            nodes.append({
                "id": name,
                "name": short,
                "icon": SERVICE_ICONS.get(short, "📦"),
                "image": c.image.tags[0] if c.image.tags else str(c.image.id)[:12],
                "status": c.status,  # running, exited, restarting
                "ports": ports,
                "networks": node_networks,
            })

        # 엣지 생성 (알려진 연결 + 컨테이너 존재 확인)
        container_names = {c.name for c in containers if c.name.startswith("sre-")}
        edge_id = 0
        for source, targets in KNOWN_CONNECTIONS.items():
            if source not in container_names:
                continue
            for target in targets:
                if target not in container_names:
                    continue
                edge_id += 1
                edges.append({
                    "id": f"e{edge_id}",
                    "source": source,
                    "target": target,
                })

        client.close()

    except ImportError:
        logger.warning("docker_sdk_not_installed")
        return _fallback_topology()
    except Exception as e:
        logger.error("docker_api_error", error=str(e))
        return _fallback_topology()

    return {
        "nodes": nodes,
        "edges": edges,
        "networks": list(networks.values()),
    }


def _fallback_topology() -> dict:
    """Docker API 사용 불가 시 정적 토폴로지"""
    nodes = [
        {"id": "sre-nginx", "name": "nginx", "icon": "🌐", "image": "nginx:1.25-alpine", "status": "unknown", "ports": [{"container": 80, "host": 8080, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-backend", "name": "backend", "icon": "⚙️", "image": "sre-backend", "status": "unknown", "ports": [{"container": 8000, "host": 8000, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-frontend", "name": "frontend", "icon": "🖥️", "image": "sre-frontend", "status": "unknown", "ports": [{"container": 3000, "host": 3002, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-postgres", "name": "postgres", "icon": "🗄️", "image": "postgres:16-alpine", "status": "unknown", "ports": [{"container": 5432, "host": 5432, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-redis", "name": "redis", "icon": "💾", "image": "redis:7-alpine", "status": "unknown", "ports": [{"container": 6379, "host": 6379, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-prometheus", "name": "prometheus", "icon": "📊", "image": "prom/prometheus", "status": "unknown", "ports": [{"container": 9090, "host": 9090, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-grafana", "name": "grafana", "icon": "📈", "image": "grafana/grafana", "status": "unknown", "ports": [{"container": 3000, "host": 3001, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
        {"id": "sre-traffic-generator", "name": "traffic-generator", "icon": "💥", "image": "sre-traffic-generator", "status": "unknown", "ports": [{"container": 8001, "host": 8001, "protocol": "tcp"}], "networks": [{"name": "app-network", "ip": "172.28.0.x"}]},
    ]
    edges = [
        {"id": "e1", "source": "sre-nginx", "target": "sre-frontend"},
        {"id": "e2", "source": "sre-nginx", "target": "sre-backend"},
        {"id": "e3", "source": "sre-backend", "target": "sre-postgres"},
        {"id": "e4", "source": "sre-backend", "target": "sre-redis"},
        {"id": "e5", "source": "sre-prometheus", "target": "sre-backend"},
        {"id": "e6", "source": "sre-grafana", "target": "sre-prometheus"},
        {"id": "e7", "source": "sre-alertmanager", "target": "sre-prometheus"},
        {"id": "e8", "source": "sre-traffic-generator", "target": "sre-nginx"},
    ]
    networks_list = [{"name": "app-network", "subnet": "172.28.0.0/16"}]
    return {"nodes": nodes, "edges": edges, "networks": networks_list}
