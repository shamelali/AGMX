#!/usr/bin/env python3
"""
AGMX — PocketBase migration runner

Creates all collections in pocketbase/collections.json against a running
PocketBase instance, then optionally seeds plans and compliance rules.

Usage:
    python3 tools/pb_migrate.py --url http://127.0.0.1:8090 \
        --email admin@agmx.my --password <pb-password>

    # validate without touching the server
    python3 tools/pb_migrate.py --dry-run

    # drop and recreate everything (destructive)
    python3 tools/pb_migrate.py --password <pw> --recreate

Requires a PocketBase admin account. Create the first one with:
    ./bin/pocketbase superuser upsert EMAIL PASSWORD

Why dependency order matters
----------------------------
A collection's listRule/viewRule reference its own fields (e.g.
`organizationId = @request.auth.organizationId`), and its relation fields
reference other collections by id. PocketBase validates both at CREATE
time, so collections must be built in topological order — a collection's
targets must already exist. Self-references (members.proxyOf -> members)
are fine because the collection exists by the time its schema is applied.
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
COLLECTIONS_FILE = ROOT / "pocketbase" / "collections.json"
SEED_FILE = ROOT / "pocketbase" / "seed.json"

BUILTIN_PREFIX = "_pb_"
RULE_KEYS = ("listRule", "viewRule", "createRule", "updateRule", "deleteRule")


def request(url, token=None, method="GET", body=None):
    """Make an HTTP request. Returns (status, parsed_json_or_text)."""
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
    except urllib.error.URLError as e:
        return 0, f"cannot reach server: {e.reason}"


def authenticate(url, email, password):
    status, data = request(
        f"{url}/api/collections/_superusers/auth-with-password",
        method="POST",
        body={"identity": email, "password": password},
    )
    if status != 200 or not isinstance(data, dict) or "token" not in data:
        print(f"✗ Authentication failed ({status}): {data}", file=sys.stderr)
        return None
    return data["token"]


def load_collections():
    if not COLLECTIONS_FILE.exists():
        print(f"✗ Not found: {COLLECTIONS_FILE}", file=sys.stderr)
        sys.exit(1)
    collections = json.loads(COLLECTIONS_FILE.read_text())
    print(f"Loaded {len(collections)} collection definitions")
    return collections


def dependencies(collections):
    """Map collection name -> set of collection names it depends on."""
    names = {c["name"] for c in collections}
    deps = {}
    for c in collections:
        d = set()
        for f in c.get("schema", []):
            if f.get("type") != "relation":
                continue
            target = f.get("collectionId", "")
            if not target or target.startswith(BUILTIN_PREFIX):
                continue
            if target == c["name"]:
                continue  # self-reference is fine
            if target in names:
                d.add(target)
        deps[c["name"]] = d
    return deps


def topo_order(deps):
    """Depth-first topological sort. Returns names in a valid creation order."""
    order, seen, in_progress = [], set(), set()

    def visit(node, stack):
        if node in seen:
            return
        if node in in_progress:
            cycle = " → ".join(stack + [node])
            raise SystemExit(f"✗ Circular relation dependency: {cycle}")
        in_progress.add(node)
        for dep in sorted(deps.get(node, ())):
            visit(dep, stack + [node])
        in_progress.discard(node)
        seen.add(node)
        order.append(node)

    for name in sorted(deps):
        visit(name, [])
    return order


def existing_collections(url, token):
    status, data = request(f"{url}/api/collections?perPage=500", token)
    found = {}
    if status == 200 and isinstance(data, dict):
        for item in data.get("items", []):
            found[item["name"]] = item["id"]
    return found


def rewrite_relations(collection, ids):
    """Return a copy of `collection` with relation ids resolved.

    Self-references (e.g. members.proxyOf -> members) are skipped here and
    added after the collection exists, since the id is unknown at create time.
    """
    out = json.loads(json.dumps(collection))
    # PocketBase 0.40 renamed `schema` to `fields` in the API.
    out["fields"] = out.pop("schema", [])
    deferred = []
    kept = []
    for field in out.get("fields", []):
        if field.get("type") != "relation":
            kept.append(field)
            continue
        target = field.get("collectionId", "")
        if not target or target.startswith(BUILTIN_PREFIX):
            kept.append(field)
            continue
        if target == out["name"]:
            # Self-reference: resolve after the collection is created.
            deferred.append(field)
            continue
        if target not in ids:
            raise SystemExit(
                f"✗ {out['name']}.{field['name']} → unknown collection '{target}'"
            )
        field["collectionId"] = ids[target]
        kept.append(field)
    out["fields"] = kept
    out["_deferred_relations"] = deferred
    return out


def create_collections(url, token, collections, existing, force=False):
    """Create collections in dependency order. Returns {name: id}."""
    deps = dependencies(collections)
    order = topo_order(deps)
    ids = dict(existing)
    created, skipped, failed = [], [], []

    if force and existing:
        print("\n  --recreate: deleting existing AGMX collections")
        to_delete = [c["name"] for c in collections if c["name"] in existing]
        drop_failed = []
        # Reverse topological order so dependents go before dependencies.
        for name in reversed(order):
            if name in to_delete:
                status, _ = request(
                    f"{url}/api/collections/{existing[name]}", token, "DELETE"
                )
                if status in (204, 200):
                    print(f"  ✓ dropped   {name}")
                    ids.pop(name, None)
                    existing.pop(name, None)
                else:
                    print(f"  ✗ could not drop {name} ({status}) — aborting", file=sys.stderr)
                    drop_failed.append(name)
        if drop_failed:
            raise SystemExit(f"✗ --recreate aborted: {len(drop_failed)} collection(s) could not be dropped")

    for name in order:
        col = next(c for c in collections if c["name"] == name)
        if name in existing:
            skipped.append(name)
            continue

        payload = rewrite_relations(col, ids)
        # Strip indexes from the create payload — PocketBase applies them
        # before schema columns exist, causing "no such column" errors.
        # The separate apply_indexes() step handles them after creation.
        payload.pop("indexes", None)
        deferred = payload.pop("_deferred_relations", [])
        status, data = request(f"{url}/api/collections", token, "POST", payload)

        if status in (200, 201) and isinstance(data, dict) and "id" in data:
            ids[name] = data["id"]
            created.append(name)
            print(f"  ✓ created   {name:26s} {data['id']}")
            # Now add any self-referencing relation fields in one PATCH.
            # Fetch live fields first so server-assigned field ids are kept.
            if deferred:
                for field in deferred:
                    field["collectionId"] = data["id"]
                g_status, current = request(
                    f"{url}/api/collections/{data['id']}", token, "GET"
                )
                live_fields = []
                if g_status == 200 and isinstance(current, dict):
                    live_fields = current.get("fields", payload["fields"])
                s2, d2 = request(
                    f"{url}/api/collections/{data['id']}", token, "PATCH",
                    {"fields": live_fields + deferred},
                )
                if s2 in (200, 204):
                    for field in deferred:
                        print(f"  ✓ self-ref  {name}.{field['name']} → {data['id']}")
                else:
                    print(f"  ✗ self-ref  {name}: {d2}", file=sys.stderr)
        else:
            failed.append(name)
            msg = ""
            if isinstance(data, dict):
                msg = data.get("message", "")
                details = data.get("data", {})
                if isinstance(details, dict):
                    for field, err in details.items():
                        if isinstance(err, dict):
                            msg += f"\n      {field}: {err.get('message', err)}"
            print(f"  ✗ FAILED    {name}: {msg or data}", file=sys.stderr)

    return ids, created, skipped, failed


def apply_indexes(url, token, collections, ids):
    """PocketBase accepts `indexes` as SQL fragments on the collection."""
    applied = 0
    for col in collections:
        name = col["name"]
        cid = ids.get(name)
        if not cid or not col.get("indexes"):
            continue
        status, data = request(
            f"{url}/api/collections/{cid}", token, "PATCH",
            {"indexes": col["indexes"]},
        )
        if status in (200, 204):
            print(f"  ✓ indexes   {name:26s} ({len(col['indexes'])})")
            applied += 1
        else:
            print(f"  ! indexes   {name} → {status}", file=sys.stderr)
    return applied


def update_existing_rules(url, token, collections, existing):
    """PATCH access rules on collections that already exist.

    Create-only migration left hardened rules unapplied on live servers.
    Rules are safe to overwrite (no data loss); schema/fields are left
    untouched here to avoid column drops.
    """
    updated, failed = [], []
    for col in collections:
        name = col["name"]
        cid = existing.get(name)
        if not cid:
            continue
        patch = {k: col.get(k, "") for k in RULE_KEYS}
        status, data = request(
            f"{url}/api/collections/{cid}", token, "PATCH", patch
        )
        if status in (200, 204):
            print(f"  ✓ rules     {name:26s}")
            updated.append(name)
        else:
            print(f"  ✗ rules     {name} → {status}: {data}", file=sys.stderr)
            failed.append(name)
    return updated, failed


def seed(url, token):
    if not SEED_FILE.exists():
        print("\nNo seed.json — skipping seed data")
        return 0, 0
    seed_data = json.loads(SEED_FILE.read_text())
    print("\nSeeding...")
    ok = skipped = 0

    for collection_name, records in seed_data.items():
        status, existing = request(
            f"{url}/api/collections/{collection_name}/records?perPage=1", token
        )
        if status != 200 or not isinstance(existing, dict):
            print(f"  ! {collection_name}: collection missing, skipped")
            continue
        if existing.get("totalItems", 0) > 0:
            print(f"  · {collection_name}: {existing['totalItems']} existing record(s), skipped")
            skipped += 1
            continue
        for record in records:
            status, data = request(
                f"{url}/api/collections/{collection_name}/records", token, "POST", record
            )
            if status in (200, 201):
                print(f"  ✓ {collection_name:20s} {record.get('code') or record.get('name')}")
                ok += 1
            else:
                msg = data.get("message") if isinstance(data, dict) else data
                print(f"  ✗ {collection_name}: {record.get('code')} — {msg}", file=sys.stderr)
    return ok, skipped


def validate(collections):
    """Structural checks that catch schema mistakes before hitting the server."""
    names = {c["name"] for c in collections}
    problems = []

    def bare_operands(rule):
        """Field references that are NOT @request.auth.* or a.b traversals."""
        no_auth = re.sub(r"@request\.auth(?:\.[^\s()&=!<>']+)?", "", rule)
        no_trav = re.sub(r"\b\w+\.[\w]+", "", no_auth)
        return set(re.findall(r"\b(organizationId|ownerOrgId|memberId)\b", no_trav))

    for c in collections:
        schema = c.get("schema", [])
        field_names = {f["name"] for f in schema}

        # Relations must resolve.
        for f in schema:
            if f.get("type") == "relation":
                t = f.get("collectionId", "")
                if t and not t.startswith(BUILTIN_PREFIX) and t not in names:
                    problems.append(f"{c['name']}.{f['name']} → unknown collection '{t}'")

        for rule_key in RULE_KEYS:
            rule = c.get(rule_key)
            if not rule:
                continue
            # `@request.auth != ''` / `== ''` is invalid — auth is an object.
            if re.search(r"@request\.auth\s*(==|!=)", rule):
                problems.append(f"{c['name']}.{rule_key}: '@request.auth' compared with '=='/'!=' (use @request.auth.id)")
            # `@request.data.fieldName` is not supported in PocketBase 0.40.
            if "@request.data." in rule:
                problems.append(
                    f"{c['name']}.{rule_key}: uses '@request.data.fieldName' — "
                    "not supported in PocketBase 0.40"
                )
            # Bare field operands must exist on this collection.
            for operand in bare_operands(rule):
                if operand not in field_names:
                    problems.append(
                        f"{c['name']}.{rule_key} references '{operand}' but no such field exists"
                    )
            # createRule must not traverse relations (server rejects it).
            if rule_key == "createRule":
                for m in re.finditer(r"\b(\w+)\.\w+", rule):
                    prefix = m.group(1)
                    if prefix in field_names and prefix != "request":
                        problems.append(
                            f"{c['name']}.createRule traverses '{prefix}.X' — "
                            "relations cannot be resolved in create rules"
                        )
            # Every write rule on a tenant table must AND the tenant predicate.
            # agm_assessments is the public lead funnel: anonymous submits go
            # into the unbound pool (organizationId = '') and only admins
            # triage/delete; that scoping is by design, not a hole.
            if rule_key in ("createRule", "updateRule", "deleteRule") and c["name"] not in (
                "organizations", "plans", "compliance_rules", "agm_assessments",
            ):
                if "@request.auth.organizationId" not in rule and \
                   "@request.auth.memberId" not in rule and \
                   "ownerOrgId" not in rule:
                    problems.append(
                        f"{c['name']}.{rule_key} has no tenant scope — cross-org write is possible"
                    )

        # Append-only tables must forbid update and delete.
        if c["name"] in ("votes", "audit_events"):
            if c.get("updateRule") != "" or c.get("deleteRule") != "":
                problems.append(f"{c['name']} must be append-only (empty update/delete rules)")

        # Empty createRule means PUBLIC write in PocketBase. Tenant tables
        # must not accept anonymous writes (agm_assessments is the sole
        # exception — it is the public assessment funnel).
        if c["name"] not in ("plans", "compliance_rules", "agm_assessments"):
            if c.get("createRule") == "":
                problems.append(
                    f"{c['name']}.createRule is empty — anyone can write; "
                    "this is a cross-tenant write hole"
                )

    # Tenant scoping.
    ORG_FIELDS = {"organizationId", "ownerOrgId"}
    UNSCOPED = {"organizations", "plans", "compliance_rules"}
    for c in collections:
        if c["name"] in UNSCOPED:
            continue
        if not any(f["name"] in ORG_FIELDS for f in c.get("schema", [])):
            problems.append(f"{c['name']} has no org tenancy field")

    return problems


def main():
    parser = argparse.ArgumentParser(
        description="AGMX PocketBase migration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--url", default="http://127.0.0.1:8090")
    parser.add_argument("--email", default="admin@agmx.local")
    parser.add_argument("--password")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-seed", action="store_true")
    parser.add_argument("--recreate", action="store_true",
                        help="drop existing AGMX collections first (destructive)")
    args = parser.parse_args()

    collections = load_collections()

    print("\nValidating schema...")
    problems = validate(collections)
    order = topo_order(dependencies(collections))
    if problems:
        print(f"\n\033[31m{len(problems)} problem(s):\033[0m")
        for p in problems:
            print(f"  ✗ {p}")
    else:
        print(f"  ✓ {len(collections)} collections valid, dependency order resolved")

    if args.dry_run:
        print("\nCreation order:")
        for i, name in enumerate(order, 1):
            deps = sorted(dependencies(collections)[name])
            suffix = f"  (after: {', '.join(deps)})" if deps else ""
            print(f"  {i:2d}. {name}{suffix}")
        return 0 if not problems else 1

    if problems:
        print("\n✗ Refusing to migrate with schema problems.", file=sys.stderr)
        return 1
    if not args.password:
        print("✗ --password is required", file=sys.stderr)
        return 1

    print(f"\nAuthenticating against {args.url}...")
    token = authenticate(args.url, args.email, args.password)
    if not token:
        return 1
    print("✓ Authenticated")

    existing = existing_collections(args.url, token)
    if existing:
        print(f"  {len(existing)} collection(s) already present")

    print("\nCreating collections (dependency order)...")
    ids, created, skipped, failed = create_collections(
        args.url, token, collections, existing, force=args.recreate
    )
    print(f"\nCreated {len(created)} · already present {len(skipped)} · failed {len(failed)}")

    if failed:
        print(f"\n\033[31m✗ {len(failed)} collection(s) failed — fix and re-run\033[0m",
              file=sys.stderr)
        return 1

    if skipped:
        print("\nSyncing rules on existing collections (no data loss)...")
        _, rule_failed = update_existing_rules(args.url, token, collections, existing)
        if rule_failed:
            print(f"\n\033[31m✗ {len(rule_failed)} rule sync(s) failed\033[0m",
                  file=sys.stderr)
            return 1

    print("\nApplying indexes...")
    apply_indexes(args.url, token, collections, ids)

    if not args.skip_seed:
        seed(args.url, token)

    print("\n\033[32m✓ Migration complete\033[0m")
    print("\nNext:")
    print("  1. Bind organizationId + role on each auth record")
    print("  2. Configure Google OAuth2 — see GOOGLE_AUTH_SETUP.md")
    print("  3. Set window.AGMX_CONFIG in config.js")
    print(f"  4. Admin UI: {args.url}/_/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
