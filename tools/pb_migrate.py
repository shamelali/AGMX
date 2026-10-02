#!/usr/bin/env python3
"""
AGMX — PocketBase migration runner

Creates all collections in pocketbase/collections.json against a running
PocketBase instance, then optionally seeds plans and compliance rules.

Usage:
    python3 tools/pb_migrate.py --url http://127.0.0.1:8090 \
        --email admin@agmx.my --password <pb-password>

    # dry run (validate JSON, print what would happen)
    python3 tools/pb_migrate.py --dry-run

Requires a PocketBase *admin* account (created on first run with
`./pocketbase serve`, which prints a temp password to the console).
"""

import argparse
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
COLLECTIONS_FILE = ROOT / "pocketbase" / "collections.json"
SEED_FILE = ROOT / "pocketbase" / "seed.json"


def request(url: str, token: str | None = None, method: str = "GET", body: dict | None = None) -> tuple[int, dict | str]:
    """Make an HTTP request and return (status, parsed_json_or_text)."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def authenticate(url: str, email: str, password: str) -> str | None:
    """Authenticate as PocketBase admin and return the auth token."""
    status, data = request(
        f"{url}/api/collections/_superusers/auth-with-password",
        method="POST",
        body={"identity": email, "password": password},
    )
    if status != 200 or not isinstance(data, dict) or "token" not in data:
        print(f"✗ Authentication failed ({status}): {data}", file=sys.stderr)
        return None
    return data["token"]


def load_collections() -> list[dict]:
    if not COLLECTIONS_FILE.exists():
        print(f"✗ Not found: {COLLECTIONS_FILE}", file=sys.stderr)
        sys.exit(1)
    collections = json.loads(COLLECTIONS_FILE.read_text())
    print(f"Loaded {len(collections)} collection definitions")
    return collections


def resolve_collection_ids(url: str, token: str, collections: list[dict]) -> dict[str, str]:
    """Two-pass: create all collections first, then patch relation IDs.

    PocketBase needs a target collection id when defining a `relation` field,
    so relations are created with placeholder ids and fixed in a second pass.
    """
    existing = {}
    status, data = request(f"{url}/api/collections?perPage=200", token)
    if status == 200 and isinstance(data, dict):
        for item in data.get("items", []):
            existing[item["name"]] = item["id"]

    ids = dict(existing)

    # Pass 1 — create/update everything with relations stubbed to "".
    created, updated, skipped = [], [], []

    for col in collections:
        name = col["name"]
        if name in existing:
            skipped.append(name)
            continue

        payload = dict(col)
        # Strip placeholders that PocketBase would reject.
        for field in payload.get("schema", []):
            if field.get("type") == "relation":
                target = field.get("collectionId", "")
                field["collectionId"] = ids.get(target, "")

        status, data = request(
            f"{url}/api/collections", token, "POST", payload
        )
        if status in (200, 201) and isinstance(data, dict) and "id" in data:
            ids[name] = data["id"]
            created.append(name)
            print(f"  ✓ created  {name}  ({data['id']})")
        else:
            print(f"  ✗ failed   {name}: {data}", file=sys.stderr)

    print(f"\nCreated: {len(created)} · Already present: {len(skipped)}")

    # Pass 2 — repair relation ids now that every collection exists.
    if created:
        print("\nResolving relation targets...")
        by_name = {c["name"]: c for c in collections}
        for name, cid in ids.items():
            col = by_name.get(name)
            if not col:
                continue
            patch = {
                "schema": [
                    {
                        **field,
                        "collectionId": ids.get(field.get("collectionId", ""), field.get("collectionId", "")),
                    }
                    if field.get("type") == "relation"
                    else field
                    for field in col.get("schema", [])
                ]
            }
            status, data = request(f"{url}/api/collections/{cid}", token, "PATCH", patch)
            if status in (200, 204):
                print(f"  ✓ linked   {name}")

    return ids


def apply_indexes(url: str, token: str, collections: list[dict], ids: dict[str, str]) -> None:
    """Apply SQL indexes. PocketBase exposes these through the collection
    update payload's `indexes` field, so we re-send them with the ids fixed."""
    for col in collections:
        name = col["name"]
        cid = ids.get(name)
        if not cid or not col.get("indexes"):
            continue
        # Skip indexes that reference unresolved collection names.
        index_lines = []
        resolvable = True
        for line in col["indexes"]:
            if "organizationId" not in line and "agmId" not in line:
                index_lines.append(line)
                continue
            index_lines.append(line)
        status, _ = request(
            f"{url}/api/collections/{cid}",
            token,
            "PATCH",
            {"indexes": index_lines},
        )
        if status not in (200, 204):
            print(f"  ! indexes   {name} returned {status}", file=sys.stderr)
        else:
            print(f"  ✓ indexes  {name} ({len(index_lines)})")


def seed(url: str, token: str) -> None:
    """Insert plans + compliance rules if the collections are empty."""
    if not SEED_FILE.exists():
        print("\nNo seed.json — skipping seed data")
        return

    seed_data = json.loads(SEED_FILE.read_text())
    print("\nSeeding...")

    for collection_name, records in seed_data.items():
        status, existing = request(
            f"{url}/api/collections/{collection_name}/records?perPage=1", token
        )
        if status != 200 or not isinstance(existing, dict):
            continue
        if existing.get("totalItems", 0) > 0:
            print(f"  · {collection_name}: already has {existing['totalItems']} record(s), skipping")
            continue

        for record in records:
            status, data = request(
                f"{url}/api/collections/{collection_name}/records", token, "POST", record
            )
            if status in (200, 201):
                print(f"  ✓ {collection_name}: {record.get('code') or record.get('name')}")
            else:
                print(f"  ✗ {collection_name}: {data}", file=sys.stderr)


def create_admin(url: str, email: str, password: str) -> None:
    """Create the initial superuser if none exists."""
    status, _ = request(
        f"{url}/api/collections/_superusers/auth-with-password",
        method="POST",
        body={"identity": email, "password": password},
    )
    if status == 400:
        # Already exists — that's the normal case on re-runs.
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="AGMX PocketBase migration")
    parser.add_argument("--url", default="http://127.0.0.1:8090", help="PocketBase URL")
    parser.add_argument("--email", default="admin@agmx.my", help="Admin identity")
    parser.add_argument("--password", required=False, help="Admin password")
    parser.add_argument("--dry-run", action="store_true", help="Validate and exit")
    parser.add_argument("--skip-seed", action="store_true", help="Don't seed plans/rules")
    parser.add_argument("--skip-indexes", action="store_true")
    args = parser.parse_args()

    collections = load_collections()

    if args.dry_run:
        names = [c["name"] for c in collections]
        print(f"\nWould create {len(names)} collections:")
        for n in names:
            print(f"  - {n}")
        # Basic sanity checks.
        known = set(names)
        problems = []
        for col in collections:
            for field in col.get("schema", []):
                if field.get("type") == "relation":
                    target = field.get("collectionId", "")
                    if target and not target.startswith("_pb_") and target not in known:
                        problems.append(f"{col['name']}.{field['name']} → unknown collection {target}")
        if problems:
            print("\n⚠ Dangling relations:")
            for p in problems:
                print(f"  ! {p}")
        else:
            print("\n✓ No dangling relations")
        return

    if not args.password:
        print("✗ --password is required (see header of this script)", file=sys.stderr)
        sys.exit(1)

    print(f"\nAuthenticating against {args.url}...")
    token = authenticate(args.url, args.email, args.password)
    if not token:
        sys.exit(1)
    print("✓ Authenticated\n")

    print("Applying collections...")
    ids = resolve_collection_ids(args.url, token, collections)

    if not args.skip_indexes:
        print("\nApplying indexes...")
        apply_indexes(args.url, token, collections, ids)

    if not args.skip_seed:
        seed(args.url, token)

    print("\n✓ Migration complete")
    print("\nNext steps:")
    print("  1. Configure Google OAuth2 — see GOOGLE_AUTH_SETUP.md")
    print("  2. Bind organizationId + role on each auth record")
    print("  3. Set window.AGMX_CONFIG in config.js")
    print(f"  4. Run the admin UI at {args.url}/_/")


if __name__ == "__main__":
    main()
