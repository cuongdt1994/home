#!/usr/bin/env python3
"""Export security reports to CSV or SQLite copy.

Usage:
    python scripts/export_reports.py --output /exports/security_reports.csv
    python scripts/export_reports.py --output /exports/backup.db --format sqlite
    python scripts/export_reports.py --output /exports/report.csv --type blocked-ips --since 2026-07-01
"""

import argparse
import csv
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

DATABASE_PATH = os.environ.get("DATABASE_PATH", "data/shield.db")


def export_csv(output_path: str, export_type: str, since: str | None, until: str | None):
    """Export a database table to CSV."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    table_map = {
        "blocked-ips": "blocked_ips",
        "ai-reports": "ai_threat_reports",
        "audit-logs": "audit_logs",
        "alerts": "suricata_alerts",
    }

    tables = list(table_map.values()) if export_type == "all" else [table_map.get(export_type)]
    if not tables or None in tables:
        print(f"Unknown type: {export_type}. Use: blocked-ips, ai-reports, audit-logs, alerts, all")
        sys.exit(1)

    with open(output_path, "w", newline="") as f:
        writer = None
        for table in tables:
            query = f"SELECT * FROM {table} WHERE 1=1"
            params = []
            if since:
                query += f" AND created_at >= ?" if table != "blocked_ips" else " AND blocked_at >= ?"
                params.append(since)
            if until:
                query += f" AND created_at <= ?" if table != "blocked_ips" else " AND blocked_at <= ?"
                params.append(until)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            if rows:
                if writer is None:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                writer.writerows(dict(row) for row in rows)
                print(f"Exported {len(rows)} rows from {table}")

    conn.close()
    print(f"CSV export written to: {output_path}")


def export_sqlite(output_path: str):
    """Copy the entire SQLite database."""
    shutil.copy2(DATABASE_PATH, output_path)
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"SQLite database copied to: {output_path} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Export AI Shield security reports")
    parser.add_argument("--output", "-o", required=True, help="Output file path")
    parser.add_argument("--format", "-f", choices=["csv", "sqlite"], default="csv",
                        help="Output format (default: csv)")
    parser.add_argument("--type", "-t",
                        choices=["blocked-ips", "ai-reports", "audit-logs", "alerts", "all"],
                        default="all", help="Data to export (default: all)")
    parser.add_argument("--since", help="Start date filter (YYYY-MM-DD)")
    parser.add_argument("--until", help="End date filter (YYYY-MM-DD)")

    args = parser.parse_args()

    # Ensure output directory exists
    output_dir = os.path.dirname(os.path.abspath(args.output))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    if args.format == "sqlite":
        export_sqlite(args.output)
    else:
        export_csv(args.output, args.type, args.since, args.until)


if __name__ == "__main__":
    main()
