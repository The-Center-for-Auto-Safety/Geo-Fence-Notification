#!/usr/bin/env python3
"""
GFN v0.1 validator.

Checks every example against the JSON Schema, then applies the semantic rules
the schema cannot express: tier ceilings on duration and area, geometry sanity,
coordinate-order plausibility, and the free-text hygiene rules in Section 6.1.

Usage:
    python3 validate.py [directory]

Exit code 0 if every example behaves as its filename declares, 1 otherwise.
Files under examples/invalid/ are expected to FAIL. Everything else is expected
to PASS.
"""

import json
import math
import pathlib
import re
import sys

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("Install jsonschema first:  pip install jsonschema --break-system-packages")

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else __file__).resolve()
ROOT = ROOT if ROOT.is_dir() else ROOT.parent

NOTICE_SCHEMA = json.loads((ROOT / "schema" / "geofence-notice.schema.json").read_text())
ACK_SCHEMA = json.loads((ROOT / "schema" / "acknowledgement.schema.json").read_text())

# Section 5.3. Hours, square kilometres, permitted restriction levels.
WIDE_AREA_CODES = {
    "WILDFIRE", "FLOODING", "TSUNAMI", "SEVERE_WEATHER", "SNOW_ICE",
    "EARTHQUAKE", "LANDSLIDE", "HAZMAT", "EVACUATION",
}
WIDE_AREA_PROHIBITED_CODES = {"EVACUATION", "TSUNAMI", "WILDFIRE", "FLOODING", "HAZMAT"}

TIERS = {
    "1": {
        "max_hours": 4,
        "max_total_hours": 24,
        "lead_hours": 0,
        "max_km2": 2.0,
        "levels": None,  # all
    },
    "1W": {
        "max_hours": 24,
        "max_total_hours": 14 * 24,
        "lead_hours": 0,
        "max_km2": 500.0,
        "max_km2_prohibited": 50.0,
        "levels": {"AVOID", "NO_STOP", "NO_PUDO", "NO_DRIVERLESS", "SPEED_LIMITED", "PROHIBITED"},
    },
    "2": {
        "max_hours": 24,
        "max_total_hours": 7 * 24,
        "lead_hours": 2,
        "max_km2": 10.0,
        "levels": None,
    },
    "3": {
        "max_hours": 72,
        "max_total_hours": 14 * 24,
        "lead_hours": 12,
        "max_km2": 5.0,
        "levels": {"AVOID", "NO_STOP", "NO_PUDO", "NO_DRIVERLESS", "SPEED_LIMITED"},
    },
    "4": {
        "max_hours": 24,
        "max_total_hours": 72,
        "lead_hours": 7 * 24,
        "max_km2": 2.0,
        "levels": {"AVOID", "NO_STOP", "NO_PUDO"},
    },
}

# 6.3 / 8.2. NO_DRIVERLESS is operationally identical to PROHIBITED for a fleet
# that has no safety operators to put aboard, so it inherits the PROHIBITED
# ceilings rather than the permissive ones.
PROHIBITIVE_LEVELS = {"PROHIBITED", "NO_DRIVERLESS"}


def tier_for(agency_type, reason_code):
    """Section 5.3. Tier is derived, never asserted in the message."""
    if agency_type in ("FIRE_EMS", "LAW_ENFORCEMENT"):
        return "1"
    if agency_type == "EMERGENCY_MANAGEMENT":
        return "1W" if reason_code in WIDE_AREA_CODES else "1"
    if agency_type in ("STATE_GOVERNMENT", "FEDERAL_GOVERNMENT"):
        return "1W" if reason_code in WIDE_AREA_CODES else "2"
    if agency_type in ("MUNICIPAL_GOVERNMENT", "MILITARY", "TRIBAL_GOVERNMENT"):
        return "2"
    if agency_type in ("UTILITY", "PUBLIC_WORKS", "TRANSPORTATION_AGENCY"):
        return "3"
    if agency_type == "EVENT_ORGANIZER":
        return "4"
    return None

DURATION_RE = re.compile(
    r"^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?"
    r"(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$"
)

# Crude PII tripwires for Section 6.1. Not a substitute for review, but they
# catch the obvious cases before a notice reaches a public register.
PII_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "looks like an SSN"),
    (re.compile(r"\bDOB\b|\bdate of birth\b", re.I), "date of birth"),
    (re.compile(r"\b(?:suspect|victim|patient)\s+[A-Z][a-z]+\s+[A-Z][a-z]+"), "named individual"),
    (re.compile(r"\b(?:apt|apartment|unit|suite|ste)\.?\s*#?\s*\w{1,6}\b", re.I), "unit-level address"),
]

# Applied only to acknowledgement free text (Section 9), which flows from the
# operator to a public agency and is the one place rider data can leak.
ACK_PII_PATTERNS = PII_PATTERNS + [
    (re.compile(r"\b(?:rider|passenger|occupant)s?\b", re.I), "rider or occupancy information"),
    (re.compile(r"\b(?:pick(?:ed)?[ -]?up|drop(?:ped)?[ -]?off|destination|fare|trip)\b", re.I),
     "trip information"),
]


def ack_checks(ack):
    """Section 9 hygiene on the reverse channel."""
    errs = []
    for i, exc in enumerate(ack.get("exceptions", [])):
        text = exc.get("detail")
        if not text:
            continue
        for pat, kind in ACK_PII_PATTERNS:
            if pat.search(text):
                errs.append(f"exceptions[{i}].detail may contain PII: {kind}")
    return errs


def duration_hours(s):
    m = DURATION_RE.match(s)
    if not m:
        return None
    y, mo, w, d, h, mi, sec = (int(g or 0) for g in m.groups())
    return y * 8766 + mo * 730 + w * 168 + d * 24 + h + mi / 60 + sec / 3600


TS_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$"
)


def parse_utc(s):
    """Seconds since epoch for an RFC 3339 UTC timestamp.

    The schema pattern validates shape only, so a receiver must range-check the
    components as well: "2026-13-45T25:99:99Z" matches the pattern. Raises
    ValueError with a usable message rather than a bare strptime traceback.
    """
    import datetime

    m = TS_RE.match(s)
    if not m:
        raise ValueError(f"not an RFC 3339 UTC timestamp: {s!r}")
    y, mo, d, h, mi, sec = (int(g) for g in m.groups())
    try:
        return datetime.datetime(
            y, mo, d, h, mi, sec, tzinfo=datetime.timezone.utc
        ).timestamp()
    except ValueError as exc:
        raise ValueError(f"timestamp out of range: {s!r} ({exc})") from exc


def ring_area_km2(ring):
    """Spherical excess is overkill at city scale. Equirectangular shoelace."""
    if len(ring) < 4:
        return 0.0
    lat0 = math.radians(sum(p[1] for p in ring) / len(ring))
    kx = 111.320 * math.cos(lat0)
    ky = 110.574
    pts = [(p[0] * kx, p[1] * ky) for p in ring]
    a = 0.0
    for i in range(len(pts) - 1):
        a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(a) / 2.0


def segments_intersect(p, q, r, s):
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    d1, d2 = cross(r, s, p), cross(r, s, q)
    d3, d4 = cross(p, q, r), cross(p, q, s)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def ring_self_intersects(ring):
    """O(n^2), bounded by the schema's 512-position cap on a ring.

    Never skip this. A self-intersecting ring makes ring_area_km2 meaningless
    (the signed shoelace cancels), so a figure-eight covering 20 km2 can report
    under 1 km2 and pass a tier ceiling. It also leaves the actual restricted
    ground dependent on each receiver's fill rule, so two conforming fleets
    restrict different areas from the same signed bytes.
    """
    n = len(ring) - 1
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            if segments_intersect(ring[i], ring[i + 1], ring[j], ring[j + 1]):
                return True
    return False


def point_in_ring(pt, ring):
    """Ray casting. Ring is closed; the final duplicate position is ignored."""
    x, y = pt[0], pt[1]
    inside = False
    n = len(ring) - 1
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xin:
                inside = not inside
    return inside


def ring_inside(inner, outer):
    """Every vertex of inner lies within outer. Sufficient for non-crossing rings."""
    return all(point_in_ring(p, outer) for p in inner[:-1])


def zone_area_km2(zone, errs=None, zone_id=""):
    g = zone["geometry"]
    t = g["type"]
    if t == "Polygon":
        rings = [g["coordinates"]]
    elif t == "MultiPolygon":
        rings = g["coordinates"]
    elif t == "Point":
        return math.pi * (zone["buffer_m"] / 1000.0) ** 2
    elif t == "LineString":
        coords, b = g["coordinates"], zone["buffer_m"] / 1000.0
        lat0 = math.radians(sum(p[1] for p in coords) / len(coords))
        kx, ky = 111.320 * math.cos(lat0), 110.574
        length = sum(
            math.hypot((coords[i + 1][0] - coords[i][0]) * kx,
                       (coords[i + 1][1] - coords[i][1]) * ky)
            for i in range(len(coords) - 1)
        )
        return 2 * b * length + math.pi * b * b
    else:
        return 0.0
    total = 0.0
    for poly in rings:
        outer = poly[0]
        sub = 0.0
        for hole in poly[1:]:
            if not ring_inside(hole, outer):
                # A hole outside its exterior ring is invalid GeoJSON. Subtracting
                # it would cancel real area off the tier ceiling, and receivers
                # that ignore it (per RFC 7946) apply the undiminished polygon.
                if errs is not None:
                    errs.append(
                        f"zone {zone_id}: interior ring is not contained by its "
                        "exterior ring"
                    )
                continue
            sub += ring_area_km2(hole)
        total += max(ring_area_km2(outer) - sub, 0.0)
    return total


def all_positions(zone):
    """Every position in a zone, whatever the geometry type."""
    g = zone["geometry"]
    t = g["type"]
    if t == "Point":
        yield g["coordinates"]
    elif t == "LineString":
        yield from g["coordinates"]
    elif t == "Polygon":
        for ring in g["coordinates"]:
            yield from ring
    elif t == "MultiPolygon":
        for poly in g["coordinates"]:
            for ring in poly:
                yield from ring


def all_rings(zone):
    g = zone["geometry"]
    if g["type"] == "Polygon":
        yield from g["coordinates"]
    elif g["type"] == "MultiPolygon":
        for poly in g["coordinates"]:
            yield from poly


def semantic_checks(notice):
    """Rules from the spec that JSON Schema cannot express.

    Returns (errors, warnings, tier, area_km2, hours).
    """
    errs, warns = [], []
    r = notice["requestor"]
    level = notice["restriction"]["level"]
    code = notice["reason"]["code"]
    tier = tier_for(r["agency_type"], code)
    if tier is None:
        errs.append(f"no tier for agency_type {r['agency_type']}")
        return errs, warns, None, 0.0, 0.0
    cfg = TIERS[tier]

    try:
        start = parse_utc(notice["effective_start"])
        issued = parse_utc(notice["issued_at"])
    except ValueError as exc:
        errs.append(str(exc))
        return errs, warns, tier, 0.0, 0.0

    # 3.1 / 5.4. The authority slug inside notice_id is the string that lands in
    # the public register, in every audit log, and in CAP alert/identifier. If it
    # is not bound to the signing identity, a credentialed Tier 4 issuer can mint
    # notices attributed to the fire department.
    auth_slug = r["authority_id"].rsplit(":", 1)[-1]
    id_slug = notice["notice_id"].split(":")[2]
    if id_slug != auth_slug:
        errs.append(
            f"notice_id authority slug '{id_slug}' does not match "
            f"authority_id '{auth_slug}'"
        )

    # 3.1. A revision must revise its own notice. Without this, any credentialed
    # issuer can CANCEL another agency's live restriction.
    for ref in notice.get("references", []):
        ref_id, ref_seq = ref.rsplit(",", 1)
        if ref_id != notice["notice_id"]:
            errs.append(
                f"references entry '{ref}' names a different notice_id; a "
                "revision may only revise its own notice"
            )
        if int(ref_seq) >= notice["sequence"]:
            errs.append(f"references entry '{ref}' is not an earlier sequence")

    # 4.3 duration ceiling for this message
    if "duration" in notice:
        hours = duration_hours(notice["duration"])
        if hours is None:
            errs.append(f"unparseable duration {notice['duration']}")
            hours = 0.0
        end = start + hours * 3600
    else:
        try:
            end = parse_utc(notice["effective_end"])
        except ValueError as exc:
            errs.append(str(exc))
            return errs, warns, tier, 0.0, 0.0
        hours = (end - start) / 3600
        if hours < 0:
            errs.append("effective_end precedes effective_start")
    if hours > cfg["max_hours"] + 1e-9:
        errs.append(
            f"duration {hours:.2f} h exceeds tier {tier} ceiling of {cfg['max_hours']} h"
        )

    # 4.3 cumulative ceiling across extensions. Without this, an EXTEND loop
    # renews a restriction forever and mandatory expiry means nothing.
    if "original_effective_start" in notice:
        try:
            orig = parse_utc(notice["original_effective_start"])
        except ValueError as exc:
            errs.append(str(exc))
            orig = start
        if orig > start:
            errs.append("original_effective_start is later than effective_start")
        total = (end - orig) / 3600
        if total > cfg["max_total_hours"] + 1e-9:
            errs.append(
                f"cumulative duration {total:.2f} h from original_effective_start "
                f"exceeds tier {tier} ceiling of {cfg['max_total_hours']} h"
            )
    elif notice["msg_type"] in ("UPDATE", "CANCEL", "EXTEND"):
        errs.append(f"{notice['msg_type']} must carry original_effective_start")

    # 5.3 lead time, on the initial issuance only. A revision keeps the
    # original effective_start, so once a notice is running its start is
    # necessarily in the past and a lead-time test would always fail.
    if notice["msg_type"] == "NEW":
        lead = (start - issued) / 3600
        if lead + 1e-9 < cfg["lead_hours"]:
            errs.append(
                f"lead time {lead:.2f} h is under the tier {tier} minimum of "
                f"{cfg['lead_hours']} h"
            )

    # 5.3 level permitted for tier
    if cfg["levels"] is not None and level not in cfg["levels"]:
        errs.append(f"level {level} not permitted for tier {tier}")
    if tier == "1W" and level in PROHIBITIVE_LEVELS and code not in WIDE_AREA_PROHIBITED_CODES:
        errs.append(f"tier 1W {level} not permitted for reason code {code}")

    # 5.3 area ceiling and 7.2 geometry rules
    total_km2 = 0.0
    vertices = 0
    for z in notice["zones"]:
        total_km2 += zone_area_km2(z, errs, z["zone_id"])
        for ring in all_rings(z):
            vertices += len(ring)
            if [c[:2] for c in ring[:1]] != [c[:2] for c in ring[-1:]]:
                errs.append(f"zone {z['zone_id']}: ring is not closed")
            if len({tuple(c[:2]) for c in ring}) < 3:
                errs.append(f"zone {z['zone_id']}: degenerate ring, fewer than 3 distinct points")
            if ring_self_intersects(ring):
                errs.append(f"zone {z['zone_id']}: ring self-intersects")
        if z["geometry"]["type"] == "LineString":
            vertices += len(z["geometry"]["coordinates"])
        if z["geometry"]["type"] == "Point":
            vertices += 1
        # 7.2 coordinate-order plausibility. The schema's latitude bound already
        # rejects every swap where the mis-placed longitude exceeds 90 degrees.
        # What remains is genuinely ambiguous, so this warns rather than rejects:
        # a real Reykjavik notice at [-21.94, 64.15] looks exactly like a swap.
        for pos in all_positions(z):
            lon, lat = pos[0], pos[1]
            if abs(lat) > 60 and abs(lon) <= 90 and abs(lon) < abs(lat):
                warns.append(
                    f"zone {z['zone_id']}: [{lon}, {lat}] is plausible either way; "
                    "confirm the order is [longitude, latitude]"
                )
                break
        alo, ahi = z.get("altitude_min_ft"), z.get("altitude_max_ft")
        if alo is not None and ahi is not None and alo > ahi:
            errs.append(f"zone {z['zone_id']}: altitude_min_ft exceeds altitude_max_ft")

    area_cap = cfg["max_km2"]
    if level in PROHIBITIVE_LEVELS and "max_km2_prohibited" in cfg:
        area_cap = cfg["max_km2_prohibited"]
    if total_km2 > area_cap + 1e-9:
        errs.append(
            f"total area {total_km2:.3f} km2 exceeds tier {tier} "
            f"{level} ceiling of {area_cap} km2"
        )
    if vertices > 512:
        errs.append(f"{vertices} vertices exceeds the 512 cap")

    # 6.1 free-text hygiene, across every field that reaches a console or the
    # public register, not only the reason block.
    texts = [("reason." + f, notice["reason"].get(f))
             for f in ("public_text", "internal_text", "hazard_notes")]
    texts += [(f"zones[{z['zone_id']}].area_desc", z["area_desc"]) for z in notice["zones"]]
    texts.append(("restriction.exempt_reason", notice["restriction"].get("exempt_reason")))
    texts += [("restriction.corridors[].name", c["name"])
              for c in notice["restriction"].get("corridors", [])]
    texts.append(("manual_entry.notes", notice.get("manual_entry", {}).get("notes")))
    for label, text in texts:
        if not text:
            continue
        for pat, kind in PII_PATTERNS:
            if pat.search(text):
                errs.append(f"{label} may contain PII: {kind}")

    # 3.1 sequence and references coherence
    if notice["msg_type"] in ("UPDATE", "CANCEL", "EXTEND") and notice["sequence"] < 2:
        errs.append(f"{notice['msg_type']} must have sequence >= 2")

    # 8.4 / 3.2. priority drives a fleet-wide clearance deadline, so it is not
    # free for a low-tier issuer to claim.
    prio = notice.get("priority")
    if prio is not None and prio <= 1 and tier in ("3", "4"):
        errs.append(f"priority {prio} is not available to tier {tier}")

    return errs, warns, tier, total_km2, hours


def main():
    files = sorted((ROOT / "examples").rglob("*.json"))
    if not files:
        sys.exit(f"no examples found under {ROOT / 'examples'}")

    failures = 0
    for path in files:
        rel = path.relative_to(ROOT)
        expect_fail = "invalid" in path.parts
        doc = json.loads(path.read_text())
        is_ack = doc.get("type") == "ACK"
        schema = ACK_SCHEMA if is_ack else NOTICE_SCHEMA

        errs = [
            f"schema: {'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}"
            for e in sorted(Draft202012Validator(schema).iter_errors(doc), key=str)
        ]
        tier = area = hours = None
        warns = []
        if not errs:
            if is_ack:
                errs = ack_checks(doc)
            else:
                errs, warns, tier, area, hours = semantic_checks(doc)

        ok = not errs
        if ok == expect_fail:
            failures += 1
            verdict = "UNEXPECTED PASS" if expect_fail else "FAIL"
        else:
            verdict = "ok (rejected as expected)" if expect_fail else "ok"

        detail = ""
        if tier is not None:
            detail = f"  [tier {tier}, {area:.3f} km2, {hours:.2f} h]"
        print(f"{verdict:26} {rel}{detail}")
        for e in errs:
            print(f"       - {e}")
        for w in warns:
            print(f"       ? {w}")

    print()
    if failures:
        print(f"{failures} file(s) did not behave as expected.")
        return 1
    print(f"All {len(files)} example(s) behaved as expected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
