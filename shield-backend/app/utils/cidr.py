"""CIDR matching utilities using the ipaddress standard library."""

import ipaddress
from typing import List


def parse_cidrs(lines: list[str]) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """Parse a list of CIDR strings, silently skipping invalid lines."""
    networks: list = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            networks.append(ipaddress.ip_network(line, strict=False))
        except ValueError:
            continue
    return networks


def is_ip_in_cidrs(ip_str: str, networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network]) -> bool:
    """Check if an IP address is contained within any of the given networks."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return any(addr in net for net in networks)


def is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is in RFC1918 or loopback range."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return addr.is_private or addr.is_loopback
