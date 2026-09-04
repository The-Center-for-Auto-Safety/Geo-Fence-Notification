# Geofence Notice Specification (GFN) v0.1

**Emergency restriction of automated vehicle operation within a defined area and time window**

| | |
|---|---|
| Specification ID | `gfn/0.1` |
| Status | Draft for review |
| Date | 2026-09-02 |
| Media type | `application/vnd.gfn+json` |
| Transport bindings | Direct HTTPS API, IPAWS/CAP 1.2, C-V2X/DSRC, satellite/SMS fallback |
| Companion files | `schema/geofence-notice.schema.json`, `examples/` |

---

## 1. Purpose and scope

A **Geofence Notice** is a signed, time-bounded, machine-readable instruction from a public authority telling the operators of automated vehicles (AVs) to restrict operation inside a defined geographic area. Section 1.3 says who an operator is and why the notice goes to them rather than to the vehicles.

It answers five questions in a form that both a fire captain and a routing planner can read:

1. **When** does the restriction start, and when does it end?
2. **Who** is asking, and what authority do they hold?
3. **Why** is the area restricted?
4. **Where** exactly is the boundary?
5. **What** is the vehicle required to do about it?

### 1.1 Why this exists

On July 8, 2026, NHTSA Administrator Jonathan Morrison notified AV developers that vehicles driving into active emergency scenes, blocking ambulances, and failing to recognize flares, cones, and flashing lights constitute a "functional insufficiency," and demanded remediation plans. On July 28, 2026, Rep. Kevin Mullin introduced the AV Emergency Response Coordination Act, which would direct NHTSA to let public officials issue "geofence notices" so that AVs avoid areas during an emergency or ongoing hazard, backed by a 24/7 operator hotline.

Neither the letter nor the bill defines the wire format. GFN is that format. It is designed so a single notice can be issued once and delivered over several channels without re-authoring.

### 1.2 What this specification does not do

GFN is an **advisory and routing constraint**, not a remote control channel. A Geofence Notice never commands a vehicle to brake, stop, disengage, or immobilize. Section 8 is normative on this point. A vehicle receiving a notice remains fully responsible for safe operation, and a notice that would require an unsafe maneuver to honor is honored on a best-effort basis after the vehicle reaches a safe state.

GFN also does not define the credential registry, the operator hotline, or the enforcement regime. It defines the message and the behavior it requires.

### 1.3 Who receives a notice, and why not the vehicle

**A notice is addressed to an operator, never to a vehicle.** The receiver is the covered entity that runs the automated driving system's backend: a fleet operator for a robotaxi, and a manufacturer for a privately owned car, since a manufacturer is a covered entity by virtue of selling one. That backend then pushes the restriction to its own vehicles over its own link, which this specification does not define.

The obvious alternative is to broadcast to every vehicle in the area, and it is worth saying plainly why that is a second channel rather than the primary one. Four reasons, strongest first:

1. **A broadcast cannot be coordinated, and egress must be.** Section 8.3 requires vehicles leaving a zone to spread across the available exits. A vehicle acting alone on a broadcast has no view of what the others are doing, so it can only minimize its own distance, which is precisely the convergence 8.3 forbids. A pure broadcast design puts a whole fleet on the same two perimeter arterials, against a five-minute deadline, on the roads an evacuating public is using. Coordination requires a coordinator.

2. **A broadcast cannot be acknowledged.** An incident commander needs an answer to "how many of your vehicles are in my zone, and when will they be out." A vehicle cannot answer for a fleet, and radio has no return path. The signed acknowledgement in Section 9, the exception report for a vehicle boxed in behind an engine, and the 24/7 hotline all require one identifiable party per operator.

3. **Verification has to live somewhere patchable.** The receiver-side checks in Section 13 include certificate chains, revocation, jurisdictional containment and tier ceilings. Replicating that across a hundred thousand embedded endpoints means a hundred thousand copies of a security-critical verifier on hardware that updates slowly.

4. **No common vehicle-addressable channel exists.** There is no standard way to reach an arbitrary automated vehicle from outside its own manufacturer's systems. Addressing vehicles directly would mean building a national channel first. Every operator backend already reaches every vehicle it runs, today.

**This boundary is about accountability, not reach.** It is not an argument against wide distribution, and this specification encourages it: broadcast delivery (11.5) and publication to consumer navigation so human drivers benefit too (11.7). Neither of those can acknowledge, so neither replaces the receiver path, and both are the better for sitting alongside it.

Section 8.6 is the normative treatment, including what changes when nobody owns a fleet.

### 1.4 Conformance language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, MAY, and OPTIONAL are to be interpreted as described in RFC 2119 and RFC 8174.

---

## 2. At a glance

A minimal notice. Every required field is present except the signature, which is added at transmission time and is what makes the notice acceptable to a receiver (Section 10.1):

```json
{
  "spec_version": "gfn/0.1",
  "notice_id": "urn:gfn:us-ca-sf-fire:2026-0912-0447",
  "sequence": 1,
  "msg_type": "NEW",
  "status": "ACTUAL",
  "issued_at": "2026-09-12T04:47:11Z",
  "effective_start": "2026-09-12T04:47:11Z",
  "effective_end": "2026-09-12T08:47:00Z",
  "requestor": {
    "agency_name": "San Francisco Fire Department",
    "agency_type": "FIRE_EMS",
    "authority_id": "urn:gfn:authority:us-ca-sf-fire",
    "jurisdiction": { "name": "San Francisco, CA", "same_code": "006075" },
    "incident_number": "F26-0912-0447",
    "contact": { "hotline": "+14155550142", "role": "Incident Commander" }
  },
  "reason": {
    "code": "FIRE",
    "severity": "CRITICAL",
    "public_text": "Structure fire with active suppression operations."
  },
  "restriction": {
    "level": "PROHIBITED",
    "applies_to": ["ADS_DRIVERLESS", "ADS_SUPERVISED"],
    "on_entry_behavior": "EXIT_VIA_NEAREST_SAFE_EGRESS",
    "occupant_policy": "COMPLETE_TRIP_OUTSIDE_ZONE"
  },
  "zones": [
    {
      "zone_id": "z1",
      "area_desc": "Valencia St between 18th St and 20th St, plus 19th St to Guerrero.",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-122.4221, 37.7615], [-122.4189, 37.7615],
          [-122.4189, 37.7592], [-122.4221, 37.7592],
          [-122.4221, 37.7615]
        ]]
      }
    }
  ]
}
```

As written above this notice is **not** valid for delivery: a `status: ACTUAL` notice without a `signature` MUST be rejected. `examples/01-structure-fire.json` is the same notice, complete. The rest of this document is about what has to be true of the fields above, and what a vehicle must do when it receives them.

---

## 3. Message envelope

### 3.1 Identity and versioning

| Field | Type | Req. | Description |
|---|---|---|---|
| `spec_version` | string | MUST | Literal `"gfn/0.1"`. Receivers MUST reject unknown major versions. |
| `notice_id` | string (URN) | MUST | Globally unique, stable across all revisions of the same notice. Format: `urn:gfn:<authority-slug>:<local-id>`, where `<authority-slug>` MUST equal the final segment of `requestor.authority_id`. MUST NOT be reused. |
| `sequence` | integer 1..4096 | MUST | Increments by 1 for each revision of `notice_id`. Receivers MUST ignore a message whose `sequence` is lower than or equal to one already processed for that `notice_id` (replay protection). |
| `msg_type` | enum | MUST | `NEW`, `UPDATE`, `CANCEL`, `EXTEND`. |
| `status` | enum | MUST | `ACTUAL`, `EXERCISE`, `TEST`, `DRAFT`. Only `ACTUAL` changes vehicle behavior in production. |
| `references` | array of string | Conditional | REQUIRED when `msg_type` is `UPDATE`, `CANCEL`, or `EXTEND`. Each entry is `"<notice_id>,<sequence>"`, and `<notice_id>` MUST equal this message's own `notice_id` at a strictly lower `sequence`. |
| `issued_at` | RFC 3339 UTC | MUST | Time of signing. Receivers MUST reject notices whose `issued_at` is more than 300 seconds in the future, or older than the receiver's own configured staleness bound. |
| `language` | RFC 5646 tag | SHOULD | Defaults to `"en-US"`. |

**Three binding rules, all of which are rejections rather than warnings.** They are unglamorous and they close the cheapest attacks in the whole design:

1. **A notice belongs to its signer.** The `<authority-slug>` in `notice_id` MUST equal the final segment of `requestor.authority_id`, which MUST in turn equal the signing certificate subject. `notice_id` is the primary key of the public register, of every operator's audit log, and of CAP `alert/identifier`. Without this binding, any issuer holding any valid registry credential can mint notices that read as the fire department's in every human-facing artifact, while the signature honestly says otherwise.
2. **A revision revises its own notice.** `UPDATE`, `CANCEL`, and `EXTEND` MUST carry the same `notice_id` and the same `authority_id` as `sequence` 1, and every `references` entry MUST name that same `notice_id`. Without this, a Tier 4 event organizer with a legitimate credential can `CANCEL` a fire department's live `PROHIBITED` zone and reopen a fire ground.
3. **Lifecycle messages are signed like any other.** `UPDATE`, `CANCEL`, and `EXTEND` MUST carry a valid signature regardless of `status`. Cancellation is the one operation that *removes* a safety restriction, so an unsigned or `TEST`-status `CANCEL` accepted on a lifecycle code path is a total compromise for the cost of one HTTP request.

`sequence` is capped at 4096 for a specific reason. Monotonic-sequence replay protection has a failure mode: a single forged message at an enormous sequence number permanently locks the legitimate issuer out of correcting or cancelling its own notice, because every message it can produce is now lower and MUST be discarded. A low ceiling bounds that, and no genuine notice needs four thousand revisions. A registry-level override for the case where the ceiling is reached is left to v0.2.

`notice_id` + `sequence` is the primary key everywhere in this specification, including acknowledgements, audit logs, and CAP references.

### 3.2 Distribution hints

| Field | Type | Req. | Description |
|---|---|---|---|
| `priority` | integer 0..4 | SHOULD | `0` life safety immediate, `1` urgent, `2` routine operational, `3` planned, `4` informational. Sets the response deadlines in 8.4 and the CAP urgency mapping in 11.3, so it is not free: `0` and `1` are available only to Tier 1, 1W and 2 issuers. |
| `scope` | enum | SHOULD | `PUBLIC`, `RESTRICTED`, `PRIVATE`. Defaults to `RESTRICTED`. See Section 10.4. |
| `addressed_operators` | array of string | Conditional | REQUIRED when `scope` is `PRIVATE`. Registered operator IDs. |
| `channels` | array of enum | MAY | Channels the issuer intends to use: `DIRECT_API`, `IPAWS`, `EAS`, `WEA`, `C_V2X`, `SATELLITE`, `MANUAL`. Informational, for deduplication across channels. |
| `ack_required` | boolean | SHOULD | Default `true` for `priority` 0 and 1, `false` otherwise. See Section 9. |

---

## 4. Time

### 4.1 Fields

| Field | Type | Req. | Description |
|---|---|---|---|
| `effective_start` | RFC 3339 UTC | MUST | When the restriction begins. MAY be in the past for an immediate notice; receivers treat a past value as "now." |
| `effective_end` | RFC 3339 UTC | MUST for `ACTUAL` | Absolute expiry. Exactly one of `effective_end` or `duration` is present, and a notice with `status: ACTUAL` MUST use `effective_end`. |
| `duration` | ISO 8601 duration | Drafts only | e.g. `"PT4H"`. An authoring convenience for `DRAFT`, `TEST`, and `EXERCISE` only. See the note below. |
| `original_effective_start` | RFC 3339 UTC | Conditional | REQUIRED on `UPDATE`, `CANCEL`, and `EXTEND`. The `effective_start` of `sequence` 1 of this `notice_id`. Bounds cumulative duration across extensions (4.3). |
| `extendable` | boolean | SHOULD | Whether the issuer anticipates an `EXTEND`. Default `true`. A receiver MUST reject an `EXTEND` against a notice whose most recent revision set this `false`. |
| `freshness_window` | ISO 8601 duration | MAY | Issuer's advisory hint for how long a cached copy may go without re-verification. Receivers MUST clamp it to their own policy maximum. |

**Why `duration` cannot go on the wire live.** A `duration` notice carries no absolute end, so a replay restarts its own clock: the same signed bytes that meant "four hours from 04:47 on September 12" mean "four hours from now" a year later. Nothing else in the design fixes this. `issued_at` staleness helps, but a notice that supplies its own `freshness_window` is defining the window in which it is acceptable, which is not a control. Requiring an absolute `effective_end` on every live notice makes a replayed notice inert on arrival, which is what 10.2 needs in order to be true.

### 4.2 Expiry is mandatory and self-enforcing

A Geofence Notice **always expires**. There is no open-ended form. A receiver MUST release the restriction at `effective_end` whether or not it hears anything further from the issuer, and MUST NOT extend a notice on its own initiative.

This is the single most important safety property in the specification. A notice that persists after the incident clears silently degrades transportation access for a neighborhood, and the failure is invisible: nothing alarms, rides just quietly stop being available. Mandatory expiry converts that failure mode from permanent to time-boxed, and puts the burden of continuation on the issuer rather than on the operator.

To keep a restriction alive past `effective_end`, the issuer sends an `EXTEND` with an incremented `sequence` and a new `effective_end`. Each `EXTEND` is a fresh, signed, logged decision.

### 4.3 Maximum durations

Two ceilings apply, both from Section 5.3, and both are receiver-enforced rejections with a `DURATION_EXCEEDS_TIER` code naming the ceiling breached:

- **Per-message.** `effective_end - effective_start` MUST NOT exceed the tier's **max initial duration**.
- **Cumulative.** `effective_end - original_effective_start` MUST NOT exceed the tier's **max total with extensions**.

The cumulative ceiling is what makes 4.2 real. Without it, `EXTEND` is an unbounded renewal loop: a script re-issuing every three hours and fifty-five minutes produces a permanent restriction out of messages that are individually valid, signed, and within every per-message ceiling. Carrying `original_effective_start` in the message means a receiver can enforce the cumulative bound from the message in hand, without reconstructing the notice's full history and without trusting its own retention.

Past the cumulative ceiling the issuer does not get another `EXTEND`. It issues a **new** `notice_id`, which is a fresh decision, freshly signed, freshly logged, and visible in the register as a distinct event rather than as an unremarkable renewal.

### 4.4 Lifecycle

```
                 ┌─────────┐
                 │  DRAFT  │  (status: DRAFT, no behavioral effect)
                 └────┬────┘
                      │ issue
                      ▼
   ┌──────────┐  effective_start   ┌────────┐  effective_end   ┌─────────┐
   │ PENDING  │ ─────────────────► │ ACTIVE │ ───────────────► │ EXPIRED │
   └────┬─────┘                    └───┬────┘                  └─────────┘
        │                              │
        │ CANCEL                       │ CANCEL          UPDATE / EXTEND
        ▼                              ▼                  (sequence + 1,
   ┌───────────┐                 ┌───────────┐             stays ACTIVE)
   │ CANCELLED │                 │ CANCELLED │
   └───────────┘                 └───────────┘
```

`CANCEL` takes effect immediately on receipt. There is no delayed cancellation: to end a restriction at a future time, send an `UPDATE` with an earlier `effective_end`.

---

## 5. Requestor

### 5.1 Fields

| Field | Type | Req. | Description |
|---|---|---|---|
| `requestor.agency_name` | string | MUST | Human-readable, as it would appear on a press release. |
| `requestor.agency_type` | enum | MUST | See 5.2. |
| `requestor.authority_id` | string (URN) | MUST | Registered issuer identity. MUST match the subject of the signing certificate (Section 10.1). |
| `requestor.jurisdiction.name` | string | MUST | Human-readable jurisdiction. |
| `requestor.jurisdiction.same_code` | string | SHOULD | FIPS/SAME county code, for CAP and EAS interoperability. |
| `requestor.jurisdiction.geometry_ref` | string | MAY | Reference to the registered jurisdiction boundary used for the containment check in 5.4. |
| `requestor.incident_number` | string | SHOULD | CAD or dispatch incident number. REQUIRED for Tier 1. This is the thread that ties a notice to an after-action review. |
| `requestor.contact.hotline` | E.164 phone | MUST | Staffed number an AV operator can call back on, 24/7 for Tier 1 and Tier 2. |
| `requestor.contact.role` | string | SHOULD | e.g. "Incident Commander", "Watch Commander", "Dispatch Supervisor". |
| `requestor.contact.email` | string | MAY | For non-urgent follow-up. |
| `requestor.on_scene_callsign` | string | MAY | Radio callsign of the unit on scene. |

Note the asymmetry: the notice carries a callback number for the **issuer**, not for the operator. The operator hotline contemplated by the AV Emergency Response Coordination Act runs the other direction and is out of scope here. Both are needed; only one belongs in the message.

### 5.2 Agency types

| Value | Covers |
|---|---|
| `FIRE_EMS` | Fire suppression, rescue, emergency medical services |
| `LAW_ENFORCEMENT` | Municipal, county, state, and federal police agencies |
| `EMERGENCY_MANAGEMENT` | OES, county EMA, FEMA regions |
| `PUBLIC_WORKS` | Streets, sanitation, municipal infrastructure crews |
| `UTILITY` | Electric, gas, water, telecom, registered private or public |
| `TRANSPORTATION_AGENCY` | DOT, transit authority, port, airport authority |
| `MUNICIPAL_GOVERNMENT` | City hall, mayor's office, city manager |
| `STATE_GOVERNMENT` | Governor's office, state agencies not covered above |
| `FEDERAL_GOVERNMENT` | Federal civilian agencies, including protective details |
| `MILITARY` | DoD and National Guard under state or federal control |
| `TRIBAL_GOVERNMENT` | Federally recognized tribal authorities |
| `EVENT_ORGANIZER` | Permitted private events, acting under a municipal permit |

### 5.3 Authority tiers

Tier is derived from `agency_type` and, for Tier 1W, `reason.code`, plus the issuer's registry entry. It is never asserted in the message. The registry is authoritative. This table is the default policy; a jurisdiction MAY tighten it, and MUST NOT introduce a lead-time requirement for Tier 1 or Tier 1W.

| Tier | Types | Lead time | Max initial duration | Max total with extensions | Max area | Levels permitted |
|---|---|---|---|---|---|---|
| **1. Incident scale, life safety** | `FIRE_EMS`, `LAW_ENFORCEMENT`, and `EMERGENCY_MANAGEMENT` outside 1W | None, immediate | 4 h | 24 h | 2 km² | All, including `PROHIBITED` |
| **1W. Wide-area hazard** | `EMERGENCY_MANAGEMENT`, `STATE_GOVERNMENT`, or `FEDERAL_GOVERNMENT`, **and only when `reason.code` is a wide-area hazard** (below) | None, immediate | 24 h | 14 d | 500 km² for `AVOID`, 50 km² for a prohibitive level | `AVOID`, `NO_STOP`, `NO_PUDO`, `SPEED_LIMITED`; prohibitive levels only for `EVACUATION`, `TSUNAMI`, `WILDFIRE`, `FLOODING`, `HAZMAT` |
| **2. Planned public safety** | `MUNICIPAL_GOVERNMENT`, `MILITARY`, `TRIBAL_GOVERNMENT`, and `STATE_GOVERNMENT` / `FEDERAL_GOVERNMENT` outside 1W | 2 h | 24 h | 7 d | 10 km² | All |
| **3. Infrastructure** | `UTILITY`, `PUBLIC_WORKS`, `TRANSPORTATION_AGENCY` | 12 h | 72 h | 14 d | 5 km² | `AVOID`, `NO_STOP`, `NO_PUDO`, `NO_DRIVERLESS`, `SPEED_LIMITED` |
| **4. Events and other** | `EVENT_ORGANIZER` | 7 d | 24 h | 72 h | 2 km² | `AVOID`, `NO_STOP`, `NO_PUDO` |

**Lead time applies to the initial issuance only.** A revision carries the original `effective_start`, so once a notice is running its start is in the past by construction. `UPDATE`, `CANCEL` and `EXTEND` are bounded by the cumulative ceiling in 4.3, not by lead time.

**Wide-area hazard codes:** `WILDFIRE`, `FLOODING`, `TSUNAMI`, `SEVERE_WEATHER`, `SNOW_ICE`, `EARTHQUAKE`, `LANDSLIDE`, `HAZMAT`, `EVACUATION`.

**Prohibitive levels.** `PROHIBITED` and `NO_DRIVERLESS` are both treated as prohibitive for every ceiling in this table. For a fleet that operates no supervised vehicles, which is the population this specification is written for, `NO_DRIVERLESS` is a total closure by another name. Without this rule a utility could impose over 5 km² for 72 hours what the fire department itself may impose over 2 km² for 4 hours, by picking the milder-sounding word. The same logic applies to `SPEED_LIMITED` at its floor, which is why 6.3 gives that level a floor.

Tier 1W exists because incident-scale ceilings are wrong for hazards that are intrinsically wide and long-lived. A county EOC managing a bayou out of its banks needs a polygon measured in square kilometres and a window measured in days, and forcing it to re-issue every four hours produces exactly the failure mode the ceilings are meant to prevent: a tired duty officer setting an unnecessarily large area to avoid having to touch it again. The trade is that Tier 1W buys size and time at the cost of severity. A 500 km² restriction is `AVOID`, not `PROHIBITED`, unless the hazard is one where entry is plainly lethal.

**Emergency escalation.** A Tier 3 or Tier 4 issuer facing a genuine life-safety condition does not get a bigger tier. It calls the Tier 1 agency, which issues. A gas utility crew standing over a ruptured main calls the fire department, and the fire department issues the `PROHIBITED` notice. This keeps the authority to close streets where the law already puts it, and keeps the audit trail intact.

### 5.4 Jurisdictional containment

A receiver MUST verify that every zone geometry lies wholly within the issuer's registered jurisdiction boundary, with the following exceptions:

- A state agency may issue anywhere within the state.
- A federal agency may issue anywhere within the United States and territories.
- A mutual-aid flag in the registry may extend an agency's boundary to named neighboring jurisdictions.

A notice failing containment MUST be rejected with `OUTSIDE_JURISDICTION` and MUST be logged and reported to the registry operator. This is a primary defense against a compromised small-agency credential being used to shut down a metropolitan area.

---

## 6. Reason and restriction

### 6.1 Reason

| Field | Type | Req. | Description |
|---|---|---|---|
| `reason.code` | enum | MUST | See 6.2. |
| `reason.severity` | enum | SHOULD | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. Maps to CAP `severity`. |
| `reason.public_text` | string, <= 200 chars | SHOULD | Disclosable description. Assume it will be read aloud on a scanner feed and printed in a newspaper. |
| `reason.internal_text` | string, <= 1000 chars | MAY | Operational detail for AV operator staff. Delivered only when `scope` is `RESTRICTED` or `PRIVATE`. |
| `reason.hazard_notes` | string | MAY | Physical hazards a vehicle near the boundary should expect: smoke, standing water, downed conductors, debris. |

`reason.public_text` and `reason.internal_text` MUST NOT contain personal identifying information, names of suspects or victims, patient information, or protected health information. A geofence notice is not a police bulletin. It travels to commercial fleets, gets logged in half a dozen systems, and in many jurisdictions becomes a public record.

### 6.2 Reason codes

| Group | Codes |
|---|---|
| Fire and hazmat | `FIRE`, `WILDFIRE`, `HAZMAT`, `GAS_LEAK`, `EXPLOSION`, `STRUCTURE_COLLAPSE` |
| Law enforcement | `CRIME_SCENE`, `ACTIVE_THREAT`, `POLICE_ACTIVITY`, `CIVIL_UNREST`, `BOMB_THREAT` |
| Medical and rescue | `MASS_CASUALTY`, `SEARCH_RESCUE`, `MEDICAL_OPERATION` |
| Weather and natural | `FLOODING`, `SEVERE_WEATHER`, `SNOW_ICE`, `EARTHQUAKE`, `LANDSLIDE`, `TSUNAMI` |
| Infrastructure | `UTILITY_OUTAGE`, `DOWNED_POWERLINE`, `WATER_MAIN`, `ROAD_DAMAGE`, `BRIDGE_CLOSURE`, `SIGNAL_OUTAGE`, `CONSTRUCTION` |
| Traffic | `COLLISION`, `VEHICLE_FIRE`, `ROADWAY_OBSTRUCTION` |
| Protective and planned | `VIP_MOVEMENT`, `DIGNITARY_PROTECTION`, `PARADE`, `PUBLIC_EVENT`, `FILMING`, `SPECIAL_OPERATION` |
| Other | `EVACUATION`, `PUBLIC_HEALTH`, `DRILL`, `OTHER` |

`OTHER` REQUIRES a non-empty `reason.public_text`.

### 6.3 Restriction levels

The restriction is graduated. A blanket "no vehicles" is right for a burning building and wrong for a parade route, and issuing the wrong one has real costs: routing a whole fleet around a large `PROHIBITED` polygon can push traffic onto residential streets and strand riders who depend on the service.

| Level | Meaning | Typical use |
|---|---|---|
| `PROHIBITED` | Do not enter under automated operation. Do not route through. Do not route around by a path that re-enters. | Active fire ground, active threat, collapse, flood water |
| `AVOID` | Treat as high cost in routing. Enter only when no reasonable alternative exists, and then transit without stopping. | Congested incident perimeter, utility work, weather |
| `NO_STOP` | Transit permitted at normal speed. No **discretionary** stopping: no standing, waiting, curb use, or pulling over. Stops required by traffic control, right of way, or a pedestrian are unaffected and are never suppressed by a notice. | Parade staging, VIP route, narrow work zone |
| `NO_PUDO` | Transit and stopping permitted. No passenger pickup or drop-off, no curb use. | Event egress crush, temporary loading conflict |
| `NO_DRIVERLESS` | No operation without a human safety operator physically aboard. | Novel road configuration, unmapped detour, sensor-hostile conditions |
| `SPEED_LIMITED` | Operate at or below `restriction.max_speed_kph`, subject to the floor in 8.1. Minimum permitted value is 10 km/h. | Debris field, degraded pavement, flooded but passable |

### 6.4 Restriction fields

| Field | Type | Req. | Description |
|---|---|---|---|
| `restriction.level` | enum | MUST | From 6.3. |
| `restriction.applies_to` | array of enum | MUST | `ADS_DRIVERLESS`, `ADS_SUPERVISED`, `ADS_TRUCK`, `ADS_TRANSIT`, `SIDEWALK_ROBOT`, `UAS`, `ALL_AUTOMATED`. |
| `restriction.max_speed_kph` | number 10..130 | Conditional | REQUIRED when `level` is `SPEED_LIMITED`. The floor of 10 km/h is a safety constraint, not a rounding: a near-zero limit across an arterial turns a zone into a rolling roadblock, which is a well-documented generator of rear-end and secondary collisions. |
| `restriction.on_entry_behavior` | enum | MUST | See 6.5. |
| `restriction.occupant_policy` | enum | MUST | See 8.3. |
| `restriction.exempt_operators` | array of string | MAY | Registered operator IDs exempt from this notice, e.g. an AV shuttle under contract to the responding agency. |
| `restriction.exempt_reason` | string | Conditional | REQUIRED when `exempt_operators` is non-empty. |
| `restriction.egress_route` | GeoJSON `LineString` | Conditional | REQUIRED when `on_entry_behavior` is `EXIT_VIA_SPECIFIED_ROUTE`. Subject to every geometry rule in 7.2. |
| `restriction.corridors` | array of object | MAY | Streets that remain open through the zone. Each has `name`, a REQUIRED `geometry` (`LineString`), and `direction` of `BOTH`, `INBOUND`, or `OUTBOUND`. Keeps an evacuation route or an emergency access lane usable inside a large restricted polygon. |

`corridors[].geometry` is required rather than optional because a corridor without geometry is not actionable. A router cannot honor "N Clark St, kept open northbound." An issuer who writes only the name believes they have preserved emergency access, every conforming receiver closes it anyway, and nothing in the acknowledgement tells the issuer their intent was dropped. That divergence between what the incident commander thinks they issued and what the fleet does is the failure this specification exists to prevent, so a corridor either carries a line a router can follow or it is not a corridor.

### 6.5 On-entry behavior

Applies to a vehicle already inside the zone when the notice takes effect, or one that enters before its routing catches up.

| Value | Required behavior |
|---|---|
| `EXIT_VIA_NEAREST_SAFE_EGRESS` | **Default.** Continue driving, by the shortest lawful path, to the nearest point outside the zone boundary. Do not stop inside. Do not reverse. Do not make an illegal turn. |
| `EXIT_VIA_SPECIFIED_ROUTE` | As above, but following `restriction.egress_route` geometry where safe to do so. |
| `HOLD_AT_SAFE_LOCATION` | Proceed to the nearest legal parking or loading space that is outside the travel lane **and outside the zone**, and hold. Use only where movement itself is the hazard. MUST NOT be used with `PROHIBITED`: holding inside a prohibited zone parks a vehicle in the hazard, which is precisely the failure the default exists to prevent. |
| `REMOTE_OPERATOR_REQUIRED` | Escalate to a human remote operator within 30 seconds. The vehicle continues to operate safely and lawfully in the meantime. Restricted to Tier 1 and 1W issuers, and see the capacity note below. |

**`REMOTE_OPERATOR_REQUIRED` is an amplifier, and is bounded accordingly.** It converts one message into a per-vehicle demand on a scarce human resource. A permissive-looking notice over a busy downtown at rush hour, low tier, low severity, small area, mild level, can saturate an operator's remote assistance desk, and that desk is also the fallback path for genuine emergencies under 8.5. So: only Tier 1 and 1W may request it, a receiver MUST cap concurrent geofence-driven escalations at its own staffed capacity, and vehicles beyond the cap fall back to `EXIT_VIA_NEAREST_SAFE_EGRESS` with the shortfall reported as an acknowledgement exception.

`EXIT_VIA_NEAREST_SAFE_EGRESS` is the default because the alternative failure is worse. A vehicle that stops where it is when a geofence turns on is a vehicle abandoned in a fire lane, which is the exact behavior NHTSA cited in July 2026. The notice's job is to get vehicles **out**, not to freeze them in place.

---

## 7. Geometry

### 7.1 Zone object

| Field | Type | Req. | Description |
|---|---|---|---|
| `zones[].zone_id` | string | MUST | Unique within the notice. |
| `zones[].area_desc` | string | MUST | Plain-language boundary description. A dispatcher reading this over the radio should be able to picture it. Example: "Valencia St between 18th and 20th, plus 19th St west to Guerrero." |
| `zones[].geometry` | GeoJSON object | MUST | `Polygon`, `MultiPolygon`, `LineString`, or `Point`. WGS 84 (EPSG:4326), coordinates as `[longitude, latitude]`. |
| `zones[].buffer_m` | number | Conditional | REQUIRED for `LineString` and `Point`. Buffer radius in meters, producing a corridor or circle. Max 5000. |
| `zones[].altitude_min_ft` | number | MAY | Lower altitude bound in feet. Present only when `applies_to` includes `UAS`. |
| `zones[].altitude_max_ft` | number | MAY | Upper altitude bound in feet. |
| `zones[].altitude_agl` | boolean | Conditional | REQUIRED whenever either altitude bound is present. `true` for above ground level, `false` for above mean sea level. There is no default: UAS practice is AGL, CAP `altitude`/`ceiling` are AMSL, and an unstated datum on that boundary is a flight-safety defect, not a formatting nit. |
| `zones[].road_refs` | array of object | MAY | Optional linear references for precise lane-level application: `{ "system": "OSM"|"TMC"|"OpenLR"|"LOCAL", "id": "..." }`. |

### 7.2 Geometry rules

- Coordinate order is `[longitude, latitude]`, per RFC 7946. **This is the reverse of CAP 1.2**, which uses `latitude,longitude`. Section 11.3 covers the conversion. Getting this backwards places a San Francisco geofence in Antarctica, and it is the most common integration defect in geospatial alerting.
- Polygon rings MUST be closed: first and last position identical, minimum four positions.
- Exterior rings SHOULD follow the right-hand rule (counterclockwise).
- A polygon MUST NOT be self-intersecting.
- Total vertex count across all zones MUST NOT exceed 512. Issuers SHOULD stay under 64 so that the notice survives constrained transports.
- Coordinates SHOULD carry no more than six decimal places (about 0.11 m). More is false precision and wastes bytes on narrow channels.
- Total area across all zones MUST NOT exceed the tier ceiling in 5.3.
- Zones within one notice MAY overlap. The union is the restricted area.

### 7.3 Choosing a shape

| Situation | Shape |
|---|---|
| Building fire, crime scene, collapse | `Polygon` around the block face plus apparatus staging |
| Parade, motorcade, evacuation corridor | `LineString` with `buffer_m` of 30 to 100 |
| Chemical plume, flood extent | `MultiPolygon`, updated as the extent changes |
| Single intersection, downed pole | `Point` with `buffer_m` of 50 to 150 |

Draw the zone to include **apparatus staging and hose lay**, not just the incident itself. The vehicle that blocks the ambulance is rarely the one at the address; it is the one that routed onto the street where the engines are parked.

### 7.4 Locations that are not shapes

`zones[].geometry` is a MUST on the direct path (11.1) and that does not change. Some jurisdictions nonetheless oblige a receiver to act on a message that identifies a place by street address or intersection rather than by geometry, with a statutory clock attached. Where a binding profile permits that, the geometry is synthesized once at the gateway, never on a vehicle, and is bounded, contained, ceiling-checked and audited as a **resolved zone**. The normative rule is in `LOCATION-RESOLUTION.md`, is carried by the schema and the reference validator, and is proposed to become this section in v0.2. A resolved zone is `Point` or `LineString` geometry with `buffer_m` capped at 250 m, about 0.196 km2, an order of magnitude below the Tier 1 area ceiling, and it carries a `location_resolution` audit block naming the verbatim source string and the resolver that ran. A notice reaching a receiver without geometry and without a profile permitting resolution remains a `MALFORMED_GEOMETRY` rejection. See 14.12 and SECURITY-REVIEW L5.

---

## 8. Vehicle behavior

This section is normative for AV operators claiming GFN conformance.

### 8.1 Precedence

Safe operation always outranks the notice. In order:

1. Immediate collision avoidance and lawful operation.
2. Direct instruction from an on-scene public safety official (hand signal, verbal, in-person).
3. Emergency vehicle right-of-way.
4. The Geofence Notice.
5. Normal routing and business logic.

A vehicle MUST NOT execute a maneuver to honor a notice that it would not execute in ordinary safe driving. If honoring the notice requires stopping in a travel lane, reversing, an illegal turn, or a lane change it cannot complete safely, the vehicle continues safely and exits at the next lawful opportunity.

Two specific cases, because a planner will not otherwise classify either as unsafe:

- **Speed.** A vehicle MAY exceed `restriction.max_speed_kph` where travelling at that speed is itself unsafe for the road, most obviously where it would put the vehicle far below the speed of surrounding traffic. Moving slowly is not a maneuver a planner refuses, and it is a documented generator of rear-end and secondary collisions. The 10 km/h floor in 6.4 reduces how often this arises; this clause covers the rest.
- **Yielding.** No notice, at any level, suppresses a stop required by traffic control, right of way, or a pedestrian. `NO_STOP` restricts discretionary stopping only.

### 8.2 Required responses by level

| Level | Routing | In-progress trips | Idle and repositioning vehicles |
|---|---|---|---|
| `PROHIBITED` | Exclude zone from all path planning | Re-route to a drop-off outside the zone per `occupant_policy` | Depart the zone immediately per `on_entry_behavior` |
| `AVOID` | Assign high traversal cost | Continue if already en route and no reasonable alternative; do not stop | Depart the zone |
| `NO_STOP` | Permit traversal | Continue, no stopping inside | Depart the zone |
| `NO_PUDO` | Permit traversal | Continue, relocate the curb event outside the zone | May remain, may not serve curb events |
| `NO_DRIVERLESS` | Permit only supervised vehicles | Driverless vehicles exit; supervised continue | Driverless vehicles depart |
| `SPEED_LIMITED` | Permit traversal at reduced cost | Continue at or below `max_speed_kph` | May remain at reduced speed |

**Corridors override the level along their geometry.** Where `restriction.corridors` is present, the named line in the given direction is treated as `NO_STOP` regardless of the notice's `level`, including `PROHIBITED`. A vehicle may traverse a corridor to reach a destination or an egress point outside the zone, and may not stop, wait, or serve a curb event on it. Corridors are how an issuer keeps an evacuation route or an emergency access lane usable inside a large restricted polygon, and a receiver that ignores them silently defeats that intent.

### 8.3 Occupant policy

A restriction must not strand a person. This is where a well-intentioned geofence does its most predictable harm.

| Value | Behavior |
|---|---|
| `COMPLETE_TRIP_OUTSIDE_ZONE` | **Default.** Divert to the nearest safe, lawful drop-off point outside the zone. Notify the rider, in-app and audibly, of the new location and the reason. |
| `COMPLETE_TRIP_TO_DESTINATION` | The zone does not restrict passenger service; finish the trip. Valid only with `NO_PUDO` or `SPEED_LIMITED`. |
| `RELOCATE_AND_REBOOK` | Divert outside the zone and arrange onward transport at no charge to the rider. |

Regardless of value, an operator MUST NOT:

- End a trip inside the zone.
- End a trip at a location the rider cannot safely reach on foot from where they intended to go, without offering onward transport.
- Drop a rider using a wheelchair, walker, or other mobility device at a location without an accessible path, or more than 400 m from the original destination, without offering an accessible onward trip at no charge.
- Charge a rider any fare increase caused by a geofence diversion.

**Egress is dispersed, not nearest-point.** "Nearest boundary" is the wrong objective when many vehicles run it at once. A large `PROHIBITED` zone turns a fleet into hundreds of vehicles converging on the same few perimeter arterials against a five-minute deadline, on the same roads an evacuating public is using, dropping riders in the same handful of perimeter blocks. Receivers MUST therefore spread egress across available exits and drop-off points rather than each vehicle independently minimizing its own distance, and MUST prefer an exit that moves away from the hazard even where a nearer one exists. Section 7.3 tells issuers to draw zones that include apparatus staging, which means the nearest boundary is often past the fire.

Operators SHOULD track diverted-trip counts by zone and report them in the audit record (Section 12). A geofence that repeatedly strands riders in the same neighborhood is a policy problem that only shows up if someone counts.

### 8.4 Latency

| Priority | Acknowledge within | Routing updated within | Vehicles clear of zone within |
|---|---|---|---|
| 0 | 15 s | 30 s | 5 min |
| 1 | 60 s | 2 min | 10 min |
| 2 to 4 | 15 min | 15 min | By `effective_start` |

"Clear of zone" means no vehicle of a type in `applies_to` is operating inside the zone in violation of `level`, except a vehicle physically unable to exit (blocked in, disabled, or held by an on-scene official), which MUST be reported by exception on the hotline.

### 8.5 Degraded connectivity

- A vehicle or fleet that loses the notice feed MUST continue to honor every cached notice until its `effective_end`.
- A cached notice past `freshness_window` without re-verification remains in force. Fail closed on the restriction, not open. The bounded downside is a slightly over-long restriction; the alternative downside is a vehicle driving into a fire.
- Time authority is held by the fleet backend, not the individual vehicle. A vehicle whose local clock disagrees with the backend by more than 60 s MUST use the backend's time and flag the discrepancy, rather than refusing to process notices. GNSS time spoofing is practical and localized, and a rule that lets a spoofed clock stop a vehicle from accepting new notices hands an attacker three things at once: the fleet in range stops seeing new restrictions, it stops seeing `CANCEL` messages, and every affected vehicle escalates to a human at the same moment. A vehicle that can reach neither a trusted time source nor its backend continues to honor cached notices, continues to operate safely, and escalates at a rate its operator can actually staff.
- Cancellations are the one thing that fails open: if a fleet cannot verify a `CANCEL`, it SHOULD contact the issuer's hotline rather than extending the restriction indefinitely, and in all cases the notice expires on schedule.

### 8.6 The operator boundary

This specification defines delivery to a **receiver**, meaning the covered entity that runs the automated driving system's backend. It says nothing about how that backend reaches an individual vehicle, which in practice is the operator's own cellular link. A vehicle that loses that link keeps honoring every cached notice until `effective_end` (8.5), because the driving stack is local and the notice is a constraint it has already been given.

The boundary is deliberate. Section 1.3 gives the argument; the four load-bearing reasons restated for reference:

- **No common vehicle-addressable channel exists.** A backend already reaches every vehicle it runs. Addressing vehicles directly from outside would mean building a national channel first.
- **Verification must live somewhere patchable.** The receiver-side checks in Section 13 include certificate chains, revocation, containment and tier ceilings. One maintained verifier is a smaller attack surface than one per vehicle on slow-updating hardware.
- **Dispersed egress (8.3) is impossible below the fleet.** A vehicle acting alone on a broadcast has no view of what the others are doing, so it necessarily minimizes its own distance, which is exactly the convergence 8.3 forbids. Coordination requires a coordinator.
- **Accountability needs a party.** The acknowledgement, the exception report and the hotline all require one identifiable entity per operator. A vehicle cannot answer for a fleet.

**"Operator" includes a manufacturer.** For a privately owned automated vehicle there is no fleet, and the receiver is the manufacturer's connected-vehicle backend. Read every requirement on an operator in this document as falling on whichever covered entity runs the backend for that vehicle. Four consequences are unresolved and carried into Section 14: an owner may disable connectivity; `occupant_policy` (8.3) is written for dispatched trips and has no private-ownership equivalent; a supervised private vehicle has a licensed human aboard who should arguably be told rather than silently rerouted, which 8.2 does not currently distinguish; and enforcement against individual owners does not scale, which is an argument for keeping the duty and the records with the manufacturer.

This boundary is about **accountability, not reach.** Broadcast delivery (11.5) and consumer navigation (11.7) add reach and are encouraged. Neither can acknowledge, so neither replaces the receiver path.

---

## 9. Acknowledgement

When `ack_required` is `true`, each receiving operator returns a **signed** acknowledgement to the issuer's endpoint. Acknowledgements are signed the same way notices are (10.1), with the operator's registered key, and an issuer MUST reject an unsigned or badly signed acknowledgement.

The reverse channel needs authentication as much as the forward one. A forged `ACCEPTED` with `vehicles_in_zone_at_receipt: 0` tells an incident commander the fire ground is clear of automated vehicles when it is not, which is a safety claim made to someone who will act on it. A forged `REJECTED` exploits this section's own requirement that rejections be surfaced to a human, and pulls an incident commander into phone calls during the first minutes of an incident.

```json
{
  "spec_version": "gfn/0.1",
  "type": "ACK",
  "notice_id": "urn:gfn:us-ca-sf-fire:2026-0912-0447",
  "sequence": 1,
  "operator_id": "urn:gfn:operator:example-av",
  "received_at": "2026-09-12T04:47:19Z",
  "disposition": "ACCEPTED",
  "vehicles_in_zone_at_receipt": 3,
  "estimated_clear_at": "2026-09-12T04:51:00Z",
  "exceptions": [],
  "contact": { "hotline": "+1-800-555-0177" }
}
```

| Field | Description |
|---|---|
| `disposition` | `ACCEPTED`, `ACCEPTED_WITH_EXCEPTIONS`, `REJECTED` |
| `rejection_code` | One of `BAD_SIGNATURE`, `UNKNOWN_AUTHORITY`, `OUTSIDE_JURISDICTION`, `DURATION_EXCEEDS_TIER`, `AREA_EXCEEDS_TIER`, `LEVEL_NOT_PERMITTED_FOR_TIER`, `MALFORMED_MESSAGE`, `MALFORMED_GEOMETRY`, `STALE_SEQUENCE`, `EXPIRED`, `UNSUPPORTED_VERSION`. `MALFORMED_MESSAGE` covers a body that will not parse or fails the schema outside the geometry; `MALFORMED_GEOMETRY` is reserved for the geometry rules in 7.2, so an issuer can tell a broken zone from a broken message. |
| `exceptions[]` | Vehicles that cannot comply, with `vehicle_id`, `reason`, `location` |

`disposition: ACCEPTED` means no exceptions. An acceptance carrying exceptions is a rejection of the schema, so that non-compliant vehicles cannot be reported in a field an issuer's dashboard treats as clean.

**Acknowledgement free text is subject to the same hygiene rules as 6.1, plus one more.** `exceptions[].detail` flows from a commercial operator to a public agency and into a three-year retained record on both sides. It MUST NOT carry rider, passenger, trip, or occupancy information: not the fact that a vehicle was occupied, not a destination, not a fare. "Boxed in by parked apparatus, vehicle empty, awaiting a tow" is the right level of detail. Anything about who was in the vehicle is not the agency's business and not the acknowledgement's job.

**Acknowledgements are also a surveillance channel, and are bounded accordingly.** `vehicles_in_zone_at_receipt` and per-vehicle `location` are operationally useful to an incident commander and, repeated hourly under a series of benign notices, amount to a persistent fleet-tracking feed obtained through a conformance-mandatory path. So: `ack_required` is meaningful only for `priority` 0 and 1; an operator MAY omit `vehicles_in_zone_at_receipt` and `exceptions[].location` for any notice above `priority` 1; and issuers MUST NOT retain per-vehicle location from acknowledgements beyond the incident's after-action review. Section 14 keeps the broader question of live status reporting open, but v0.1 ships the narrow version, so v0.1 states the limits.

A rejection is not a refusal to cooperate. It is a machine-readable "this message is wrong, here is why," and it MUST be surfaced to a human at both ends within the latency budget in 8.4. An issuer whose notice is rejected calls the operator hotline; the restriction does not silently fail.

---

## 10. Security

The threat that matters most is not a hacker stopping one car. It is a forged notice that shuts down automated transportation across a city during an emergency, or a real notice that never arrives.

### 10.1 Signing

- Every notice with `status: ACTUAL` MUST carry a detached JWS (RFC 7515) over the RFC 8785 JSON Canonicalization Scheme serialization of the notice body.
- Algorithm MUST be `ES256` (ECDSA P-256, SHA-256). `none` and all HMAC algorithms MUST be rejected.
- The JOSE header MUST include `x5c` with a certificate chain to a registry root, or `kid` resolvable through the registry.
- The certificate subject MUST equal `requestor.authority_id`. A mismatch is a rejection, not a warning.
- Certificates SHOULD have lifetimes of one year or less, and the registry MUST publish revocation (OCSP or a signed CRL refreshed at least hourly). **Known conflict:** an hourly CRL cannot satisfy 10.3's requirement that credentials be revocable within 15 minutes, and the two numbers have been inconsistent since the first draft. v0.2 must choose: OCSP against the issuing root with the responder URL carried in the trust list, a push mechanism, or an honest restatement of 10.3's window. SECURITY-REVIEW L7.
- On constrained transports, COSE_Sign1 (RFC 9052) over a CBOR encoding MAY substitute for JWS. The signed content is semantically identical.

### 10.2 Replay and freshness

- **An `ACTUAL` notice carries an absolute `effective_end`** (4.1). This is the load-bearing control: a replayed notice is already expired when it arrives, and a receiver discards it on the expiry check alone, with no cache, no clock comparison, and no state. It works for a receiver onboarded yesterday.
- `sequence` is monotonic per `notice_id`, and bounded (3.1). Lower or equal sequence for a known `notice_id` MUST be discarded.
- `issued_at` more than 300 s in the future MUST be rejected (clock skew or forgery). `issued_at` older than the receiver's configured staleness bound MUST also be rejected. That bound is receiver policy. `freshness_window` is a hint from inside the message, and a message cannot be trusted to define the window in which it is acceptable.
- Receivers MUST maintain a seen-notice cache covering at least the maximum notice lifetime plus 24 h. The cache is a defense in depth, not the primary one, because a long-horizon replay will not be in it.

Signed notices circulate widely by design: PUBLIC-scope notices go to consumer navigation, the register publishes them, and the IPAWS binding base64-encodes the whole signed body into a CAP parameter. Assume every signed notice you ever issue is in an attacker's hands forever, and design the expiry checks accordingly.

### 10.3 Abuse and denial of service

There are two kinds of control here and they behave differently. Conflating them is how a limits table ends up limiting nothing.

**Soft thresholds.** Breaching one does not drop the notice. The receiver accepts it, applies it, flags it, and pages a human at the operator and at the registry. Rate limiting a real emergency is worse than the abuse it prevents.

| Soft threshold | Default |
|---|---|
| New notices per issuer per hour | 20 (Tiers 1 and 1W), 5 (Tiers 2 to 4) |
| Concurrent active notices per issuer | 10 |
| Cumulative active restricted area per issuer | 10 km², or 100 km² at Tier 1W |

**Hard gates.** Breaching one means the notice does not take effect until a named human at the receiver confirms it, with a confirmation deadline of 10 minutes for `priority` 0 and 1 and no automatic approval on timeout. These exist because the compromised-credential case is this section's whole subject, and because the failure they prevent is a metropolitan area losing automated transportation during an emergency.

| Hard gate | Default |
|---|---|
| Cumulative active prohibitive area per jurisdiction | 25 km², or 5% of jurisdiction area, whichever is smaller |
| Single notice covering more than 25% of the issuer's jurisdiction | Confirmation required |
| Any notice from an issuer that has breached a soft threshold in the past hour | Confirmation required |

Note what the hard gates do **not** carve out. An earlier draft of this section exempted `EVACUATION`, `WILDFIRE`, `TSUNAMI`, and `SEVERE_WEATHER` from review, on the reasonable-sounding ground that those hazards are genuinely wide. But those are exactly the codes that unlock the Tier 1W ceilings, so exempting them removed human review precisely where the blast radius is largest, and told an attacker which four strings to put in the `reason` field. A wide-area evacuation is worth ten minutes of a duty officer's attention. The gate is a phone call, not a refusal.

Additional structural controls:

- Jurisdictional containment (5.4) bounds the blast radius of any single compromised credential. It bounds a compromised **federal** credential hardly at all, which is why federal issuance at Tier 1W deserves registry-side monitoring that this document does not yet specify.
- Tier ceilings (5.3) bound duration, area, and severity per credential class, with prohibitive levels treated together so the ceilings cannot be dodged by choosing a milder-sounding word.
- Registry credentials MUST be issuable and revocable within 15 minutes. Revocation only works if it is checked when it matters: a receiver MUST re-check revocation at each notice's `effective_start`, not only on receipt. Otherwise an attacker with twenty minutes of key access signs a year of future-dated notices, and every one of them activates on schedule long after the certificate is dead.

### 10.4 Confidentiality

Geofence notices leak operational intelligence. A `DIGNITARY_PROTECTION` notice published in real time is a route map for a protective detail. An `ACTIVE_THREAT` polygon is a live map of a police perimeter.

- `scope: RESTRICTED` (the default) means: deliver to registered AV operators, do not publish in real time. `reason.internal_text` is delivered.
- `scope: PRIVATE` means: deliver only to `addressed_operators`. Use for protective operations.
- `scope: PUBLIC` means: safe to publish and to feed to consumer navigation. Use for flooding, road damage, planned events. `ACTIVE_THREAT`, `DIGNITARY_PROTECTION`, `SPECIAL_OPERATION`, and `BOMB_THREAT` MUST NOT be `PUBLIC`: publishing a live police perimeter to every navigation app is a map of where the police are.
- Issuers SHOULD use `PUBLIC` where possible. Most restrictions benefit from every driver knowing, not just automated ones.
- `reason.internal_text` MUST NOT appear on a `PUBLIC` notice at all, and operators MUST NOT surface it to riders or in public APIs.
- **`internal_text` is inside the signed body, which forces a choice.** A relay cannot strip it to widen distribution without invalidating the signature, so any notice that reaches a broadcast path carries `internal_text` and full geometry to everyone on it. Until v0.2 defines a per-field encryption or detached-claims construction, the rule is operational rather than cryptographic: **do not put anything in `internal_text` that would harm the operation if the whole path saw it**, and send genuinely sensitive protective-operation notices over the direct channel only, with `channels: ["DIRECT_API"]`. This is reinforced by 11.2: the IPAWS subscriber feed carries `PUBLIC` scope only, so a `RESTRICTED` or `PRIVATE` notice has no route to operators through IPAWS in the first place.
- Transport MUST be TLS 1.3 or better for `RESTRICTED` and `PRIVATE` notices. Signing is for authenticity; TLS is for confidentiality. Both are required.
- Post-incident publication (Section 12) MAY be delayed up to 72 h for `ACTIVE_THREAT`, `DIGNITARY_PROTECTION`, and `SPECIAL_OPERATION`, and MUST be published thereafter.

### 10.5 Input handling

Receivers MUST treat every notice as untrusted input until the signature verifies, and MUST:

- Validate against the JSON Schema before any semantic processing.
- Reject payloads over 256 KB.
- Reject notices with more than 32 zones or 512 total vertices.
- Reject NaN, Infinity, coordinates outside `[-180, 180]` and `[-90, 90]`, and non-finite `buffer_m`.
- Range-check every timestamp, not just its shape. The `rfc3339Utc` pattern matches `2026-13-45T25:99:99Z`; a receiver that hands that to a date parser without checking gets an exception on a code path an attacker chose.
- Reject unclosed rings, self-intersecting rings, and interior rings not contained by their exterior ring. All three make an area computation meaningless, which means all three are tier-ceiling bypasses. A self-intersecting ring also leaves the actual restricted ground dependent on each receiver's fill rule, so two conforming fleets restrict different areas from the same signed bytes.
- Never render `area_desc`, `public_text`, or any free-text field into an operator console without escaping. These fields reach dispatcher screens and rider apps.
- Never evaluate or interpolate any field into a query, shell command, or template.

---

## 11. Transport bindings

### 11.1 Direct HTTPS (normative, primary)

The primary path. Fastest, most reliable, and the only one with true acknowledgement.

| Operation | Method and path |
|---|---|
| Publish | `POST /gfn/v0.1/notices` |
| Poll active set | `GET /gfn/v0.1/notices?active_at=<rfc3339>&bbox=<w,s,e,n>` |
| Stream | `GET /gfn/v0.1/stream` (Server-Sent Events) |
| Acknowledge | `POST /gfn/v0.1/notices/{notice_id}/ack` |
| Audit register | `GET /gfn/v0.1/register?from=<date>&to=<date>` |

Content type `application/vnd.gfn+json`. Signature in the `X-GFN-Signature` header as detached JWS, or inline as a `signature` member. URN path segments are percent-encoded.

Message signing establishes authenticity; it says nothing about who is allowed to *read* a feed. The poll and stream endpoints MUST therefore authenticate their clients with registered operator credentials (mutual TLS or a registry-issued token) and MUST serve `RESTRICTED` notices only to registered operators and `PRIVATE` notices only to the operators named in `addressed_operators`.

Endpoint discovery and feed redundancy are not yet specified, and that is a real gap: a per-issuer endpoint is a single point of failure, and Section 10 names notice suppression as a top-tier threat. Section 14 carries it.

Operators MUST support both stream and poll. A stream that silently dies is the most common way a fleet stops receiving notices without anyone noticing, so operators MUST alarm on a stream with no message and no keepalive for 120 s, and MUST reconcile against the poll endpoint at least every 5 minutes.

### 11.2 IPAWS and CAP 1.2 (normative, secondary)

For issuers that already have an IPAWS-authorized alert origination tool and a COG ID, GFN rides inside CAP 1.2 with no new credentialing. This matters: a small city may have exactly one path to reach AV operators, and it is the one their emergency manager already knows how to use.

The full notice travels as a base64url-encoded parameter so nothing is lost in translation, and the CAP fields are populated so that a CAP-only consumer still gets a usable alert.

**This path carries `PUBLIC` scope only.** The route by which a non-government organization receives from IPAWS is the All-Hazards Information Feed, which carries public alerts. A `RESTRICTED` notice would need COG-to-COG delivery, which requires the AV operator itself to hold a COG, and a `PRIVATE` notice has no IPAWS route at all. Since 10.4 requires `ACTIVE_THREAT`, `DIGNITARY_PROTECTION`, `SPECIAL_OPERATION` and `BOMB_THREAT` to be `RESTRICTED` or `PRIVATE`, **the direct channel is the only path for exactly those notices**, and an agency whose sole route to operators is IPAWS cannot issue them. That is a real gap for small agencies and it is carried into Section 14.

**Two further profile constraints bind a gateway.** The IPAWS profile ignores `effective` and `onset`, holding that alerts are effective upon issuance, so a notice with a lead time cannot be pre-published over IPAWS: a gateway MUST hold the submission until `effective_start` rather than publish it early. And the profile requires `Update` and `Cancel` to reference *every* related message that has not yet expired, so a gateway MUST expand GFN's single-entry `references` into one triple per unexpired revision of that `notice_id`.

### 11.3 CAP 1.2 mapping

| CAP element | GFN source | Notes |
|---|---|---|
| `alert/identifier` | `notice_id` | |
| `alert/sender` | `requestor.authority_id` | |
| `alert/sent` | `issued_at` | Convert to `YYYY-MM-DDThh:mm:ss±hh:mm`. CAP forbids `Z`; use `-00:00` for UTC. |
| `alert/status` | `status` | `ACTUAL`→`Actual`, `EXERCISE`→`Exercise`, `TEST`→`Test`, `DRAFT`→`Draft` |
| `alert/msgType` | `msg_type` | `NEW`→`Alert`, `UPDATE`/`EXTEND`→`Update`, `CANCEL`→`Cancel` |
| `alert/scope` | `scope` | `PUBLIC`→`Public`, `RESTRICTED`→`Restricted`, `PRIVATE`→`Private` |
| `alert/restriction` | literal | `"Registered automated vehicle operators"` when scope is Restricted |
| `alert/addresses` | `addressed_operators` | Space-delimited, quoted if containing spaces |
| `alert/references` | `references` | Reformat to CAP `sender,identifier,sent` triples. The referenced notice's `sent` value is not carried in a GFN message, so a gateway MUST retain the `sent` timestamp of each notice it has forwarded in order to build this. Without that state the CAP reference dangles. |
| `alert/code` | literal | `GFNv0.1`, plus `IPAWSv1.0` when sent through IPAWS |
| `alert/incidents` | `requestor.incident_number` | |
| `info/category` | `reason.code` | See mapping below. Always include `Transport`. |
| `info/event` | derived | `"Automated Vehicle Geofence Notice: <reason.code>"` |
| `info/responseType` | `restriction.level` | `PROHIBITED`/`AVOID`→`Avoid`, others→`Monitor` |
| `info/urgency` | derived | `priority` 0→`Immediate`, 1→`Expected`, 2 to 4→`Future` |
| `info/severity` | `reason.severity` | `CRITICAL`→`Extreme`, `HIGH`→`Severe`, `MEDIUM`→`Moderate`, `LOW`→`Minor` |
| `info/certainty` | derived | `Observed` for an in-progress incident, `Likely` for a planned notice issued in advance (Tier 3 and 4, and any notice with lead time). Certainty feeds downstream IPAWS alerting decisions, so a hardcoded `Observed` on a scheduled utility job is wrong in a way that propagates. |
| `info/audience` | literal | `"Automated vehicle operators"` |
| `info/eventCode` | `valueName=SAME` | `CEM` for emergencies, `LAE` for local area, `ADR` for planned. Required by the IPAWS profile. |
| `info/effective` | `effective_start` | |
| `info/onset` | `effective_start` | |
| `info/expires` | `effective_end` | Required by the IPAWS profile. |
| `info/senderName` | `requestor.agency_name` | |
| `info/headline` | derived, <= 160 chars | `"AV geofence: <level> in <area_desc> until <local time>"` |
| `info/description` | `reason.public_text` | |
| `info/instruction` | derived | Plain-language statement of required vehicle behavior |
| `info/contact` | `requestor.contact.hotline` | |
| `info/parameter` | see below | |
| `info/area/areaDesc` | `zones[].area_desc` | One `area` block per zone |
| `info/area/polygon` | `zones[].geometry` | **Reverse coordinate order to `lat,lon`.** Space-delimited pairs, closed ring. |
| `info/area/circle` | `Point` + `buffer_m` | `lat,lon radius_km` |
| `info/area/polygon` | `LineString` + `buffer_m` | CAP has no buffered-line form, so the gateway MUST compute the buffer polygon and emit it. A buffered `LineString` is the shape 7.3 recommends for parades, motorcades, and evacuation corridors, so dropping it would leave the most common corridor notice with no geometry at all for a CAP-only consumer. |
| `info/area/geocode` | `jurisdiction.same_code` | `valueName=SAME` |
| `info/area/altitude` | `zones[].altitude_min_ft` | CAP is feet AMSL. Convert when `altitude_agl` is `true`; do not pass an AGL value through unchanged. |
| `info/area/ceiling` | `zones[].altitude_max_ft` | Feet AMSL, same conversion. |

Required `info/parameter` entries:

| valueName | value |
|---|---|
| `GFN-version` | `gfn/0.1` |
| `GFN-restriction-level` | `restriction.level` |
| `GFN-applies-to` | `restriction.applies_to`, comma-delimited |
| `GFN-on-entry` | `restriction.on_entry_behavior` |
| `GFN-payload` | base64url of the complete signed GFN JSON |
| `GFN-payload-alg` | `ES256` |
| `EAS-ORG` | Issuer SAME organization code. Emit only when `channels` includes `EAS`. |

Category mapping: `FIRE`, `WILDFIRE`, `VEHICLE_FIRE` → `Fire`. `CRIME_SCENE`, `ACTIVE_THREAT`, `POLICE_ACTIVITY`, `CIVIL_UNREST`, `BOMB_THREAT`, `DIGNITARY_PROTECTION`, `VIP_MOVEMENT` → `Security`. `SEARCH_RESCUE`, `STRUCTURE_COLLAPSE`, `MASS_CASUALTY` → `Rescue`. `FLOODING`, `SEVERE_WEATHER`, `SNOW_ICE`, `TSUNAMI` → `Met`. `EARTHQUAKE`, `LANDSLIDE` → `Geo`. `HAZMAT`, `GAS_LEAK`, `EXPLOSION` → `CBRNE`. `UTILITY_OUTAGE`, `DOWNED_POWERLINE`, `WATER_MAIN`, `SIGNAL_OUTAGE` → `Infra`. `PUBLIC_HEALTH` → `Health`. Everything else → `Other`. Always append `Transport`.

**Round-trip requirement.** A receiver that gets a CAP message containing `GFN-payload` MUST decode and verify that payload and use it as authoritative, treating the CAP fields as a lossy human-readable rendering. Geometry precision, restriction level nuance, and the signature all live in the payload.

### 11.4 EAS and WEA (limited, non-normative)

**Do not route routine geofence notices to EAS or WEA.** The public alerting channels reach millions of phones and broadcast receivers. A notice telling robotaxis to avoid two blocks does not belong there, and alert fatigue is a real, measured public safety harm.

EAS and WEA are appropriate only for a notice that is already a public emergency in its own right: an evacuation order, a wildfire perimeter, a tsunami zone, a chemical release shelter-in-place. In those cases, the AV geofence is a footnote to an alert the public needs anyway.

When it is warranted:

- WEA `CMAMtext` is limited to 90 English characters. There is no room for GFN detail. Format: `Evacuate <area> now. Roads closed to all vehicles. <agency>`. The AV-specific instruction is carried on the direct and IPAWS channels.
- EAS audio and text are for people. Do not attempt to encode geometry.
- Set `scope: PUBLIC` and use `channels: ["EAS"]` or `["WEA"]` only alongside `DIRECT_API` or `IPAWS`. EAS and WEA MUST NOT be a notice's only channel: neither delivers to fleet systems reliably, and neither supports acknowledgement.

### 11.5 C-V2X and broadcast (non-normative)

For roadside-unit broadcast, a compact CBOR profile carrying `notice_id`, `sequence`, `effective_end`, `restriction.level`, `applies_to`, a single simplified polygon (<= 16 vertices), and a COSE_Sign1 signature fits typical MAP/TIM-adjacent payload budgets. A vehicle receiving the compact form SHOULD fetch the full notice over its normal channel when connectivity allows. The compact form is a fast-path hint, not a replacement.

### 11.6 Manual fallback

Every issuer MUST have a non-technical path: a phone call to the AV operator hotline. This is the path that works at 3 a.m. when the alerting tool is down, and it needs to exist in the data model so that it is auditable rather than invisible.

A manually transcribed notice is issued **under the operator's own identity**, not the caller's. It carries `requestor.authority_id` and `notice_id` in the operator's namespace, so the 3.1 binding rules and the 10.1 certificate-subject rule hold unchanged, and it records the claimed originating agency in `requestor.agency_name` plus a `manual_entry` block naming who took the call, when, and how the caller was verified. An operator-issued notice is never mistaken for an agency-signed one, in the register or anywhere else. That distinction matters because this is the only path with no cryptography, and it is the obvious social-engineering target: phone the hotline at 3 a.m., claim to be the fire department, ask for a city block.

For that reason `manual_entry.verification_method` MUST be `CALLBACK_TO_PUBLISHED_NUMBER` for any manual notice at `priority` 0 or 1 or at a prohibitive level. The operator hangs up and calls the agency back on a number from the registry, not a number the caller supplied. It costs ninety seconds and it is the entire security of this channel.

### 11.7 Consumer navigation (non-normative)

An automated vehicle is not the only thing that should stay out of a fire ground. A `PUBLIC` notice is structurally the same object as a road-closure event that Google Maps, Waze, Apple Maps and TomTom already ingest from agencies today, and it should be published where they can see it.

The USDOT **Work Zone Data Exchange** is the nearest existing shape: an agency publishes a GeoJSON feed of road events, aggregators consume it, drivers see it in the app they already use. A `PUBLIC` GFN notice maps onto a WZDx road event closely: same geometry, same start and end, same reason, same issuing authority. The linear-referencing work already carried in Section 14 would make the mapping tighter still.

Two constraints shape this binding rather than block it:

- **`PUBLIC` scope only.** A live police perimeter published to every navigation app is a map of where the police are. The scope rules in 10.4 already gate this correctly, and a gateway MUST NOT publish a `RESTRICTED` or `PRIVATE` notice to a consumer feed.
- **Advisory, not compliance.** A navigation app can route a human around a closure. It cannot compel, cannot acknowledge, and is not an accountable party. That is a different job from the receiver path, and a worthwhile one: telling ten thousand drivers to avoid a block has value even though none of them will ever send an acknowledgement.

The binding itself is not specified in v0.1. It is the cheapest large win available and is carried into Section 14.

---

## 12. Audit and transparency

Every notice, every acknowledgement, and every rejection is a record.

**Issuers MUST retain**, for at least three years: the signed notice, the issuing user identity, the incident number, all acknowledgements and rejections received, and any manual-entry provenance.

**Operators MUST retain**, for at least three years: every notice received and its verification result, the time routing was updated, the list of vehicles inside the zone at receipt and when each cleared, every diverted or cancelled trip with the rider-facing outcome, and every exception reported.

**Public register.** Fields published in the register are subject to 6.1: `area_desc` in particular is republished verbatim and MUST NOT carry a unit-level address. For recurring protective movements, a fixed 72-hour delay protects a one-off motorcade and does nothing for a weekly route, whose pattern the register makes permanently public. Publish those aggregated by month rather than per-notice.

Issuers SHOULD publish a register of expired notices: `notice_id`, agency, reason code, restriction level, area, start, end, and area description. Publication MAY be delayed up to 72 h for the sensitive reason codes in 10.4, and MUST NOT be withheld indefinitely. Geofencing is a power to close public streets to a class of vehicle. A power exercised without a public record erodes quickly, and the register is cheap insurance against that.

**Metrics operators SHOULD report quarterly**, per jurisdiction: notice count by tier and reason, median and 95th percentile acknowledgement and clear times, total restricted area-hours, trips diverted, riders offered onward transport, and rejected notices by code.

---

## 13. Conformance

An implementation claiming **GFN v0.1 Issuer** conformance MUST:

1. Emit notices validating against `schema/geofence-notice.schema.json`.
2. Sign every notice per 10.1, and every `UPDATE`, `CANCEL`, and `EXTEND` regardless of `status`.
3. Bind `notice_id`, `authority_id`, and the signing certificate subject per 3.1, and revise only its own notices.
4. Set an absolute `effective_end` within both the per-message and cumulative ceilings for its tier, and carry `original_effective_start` on every revision.
5. Provide a staffed callback number in E.164.
6. Keep `reason` and `area_desc` free of the content 6.1 prohibits.
7. Send `CANCEL` when the condition clears, rather than letting notices run to expiry as a matter of course.
8. Retain records per Section 12.

An implementation claiming **GFN v0.1 Receiver** conformance MUST:

1. Validate schema, signature, certificate-subject binding, revision authority, freshness, sequence, geometry, tier, and jurisdiction before applying a notice.
2. Re-check certificate revocation at `effective_start`, not only on receipt (10.3).
3. Apply restrictions within the latency budget in 8.4, and honor `corridors` (8.2).
4. Implement `on_entry_behavior` and `occupant_policy` as specified, including the accessibility floor and dispersed egress in 8.3.
5. Never allow a notice to induce an unsafe maneuver, including a speed far below surrounding traffic or a suppressed yield (8.1).
6. Release restrictions at `effective_end` without further instruction.
7. Honor cached notices through connectivity loss, and take time authority from the fleet backend rather than an unverified local clock (8.5).
8. Return signed acknowledgements and machine-readable rejections (Section 9).
9. Enforce the hard gates in 10.3 with a named human, not an automatic approval on timeout.
10. Retain records per Section 12.

`validate.py` in this repository is a partial reference for items 1 and part of 3: it implements the schema validation, the geometry rules, the tier ceilings, and the free-text hygiene checks, and every case in `examples/invalid/` is a regression test for a specific rejection. It does not implement signature verification, revocation, jurisdictional containment, or any cross-message state, all of which need a registry. A full conformance suite is the recommended next work item.

---

## 14. Open questions for v0.2

1. **Registry governance.** Resolved in direction, open in execution. See `REGISTRY-GOVERNANCE.md`. The word "registry" carries five separate jobs in this document: credential issuance and revocation (10.1, 10.3), tier assignment (5.3), jurisdiction boundaries and mutual aid (5.4), the receiver directory and feed access control (9, 11.1), and the published callback number (11.6). The first four and the fifth divide cleanly by constituency: roughly 47,000 issuing agencies against tens of receivers. They are therefore two registries. The **receiver directory** belongs with the state AV regulator, which already licenses these entities and holds the enforcement lever, with a national floor set by a NHTSA standing general order rather than by rulemaking. The **issuer registry** federates: states credential their own agencies under a common certificate policy, and a member-governed national body publishes the trust list receivers consume, on the model of AAMVA's mDL Digital Trust Service. An agency holding an IPAWS COG is treated as already credentialed, as an interim measure that ships before the federation exists. What remains genuinely open is the certificate policy, the cross-state mutual-aid countersignature (SECURITY-REVIEW L10), the cached-trust-list availability behavior (L8), and the 10.1 / 10.3 revocation conflict (L7).
2. **Lane-level restriction.** Closing one direction of one street is common and today requires an awkwardly thin polygon. A proper linear-referencing binding, borrowing from WZDx 4.2 road event structure, would handle it cleanly and would let GFN and work zone feeds share tooling.
3. **Bidirectional status.** Should an operator publish live vehicle counts inside an active zone back to the incident commander? Operationally valuable, and a meaningful surveillance and competitive-intelligence concern.
4. **Standing zones.** Recurring restrictions (a school pickup loop, a weekly farmers market) are currently many separate notices. A recurrence rule would help, at the cost of weakening the mandatory-expiry property in 4.2.
5. **Cross-operator conflict.** When two valid notices overlap with different levels, the strictest wins. That is correct and badly under-specified. Three cases need work: two adjacent `PROHIBITED` zones can deadlock a vehicle on the boundary, since the nearest egress from each leads into the other; `on_entry_behavior` has no severity ordering, so "strictest" is undefined across it; and an overlapping notice that omits an `exempt_operators` entry strips it, which can geofence out the very paratransit operator an agency contracted to support the operation. v0.1 says only that egress is computed against the union of active zones, never against one in isolation.
6. **A consumer-navigation binding.** `PUBLIC` notices should reach human drivers through the navigation apps they already use, via a WZDx-shaped feed (11.7). The mapping is close to mechanical and unwritten. Note that reported adoption of WZDx by navigation and automotive consumers is still uneven, so the binding is necessary but not by itself sufficient.
7. **Privately owned automated vehicles.** The receiver model holds because the duty follows the manufacturer (8.6), but four things are unresolved: owner-disabled connectivity, an `occupant_policy` written for dispatched trips, the absence of any distinct behavior for a supervised vehicle with a licensed human aboard, and the orphan case of a retrofit system or a manufacturer that has left the business.
8. **A delivery path for small agencies issuing restricted notices.** The IPAWS binding reaches AV operators only at `PUBLIC` scope (11.2), so an agency with no direct integration cannot issue a restricted perimeter at all. Either operators become COGs, or IPAWS gains a route for this class of message, or small agencies need a shared gateway. None of the three is specified.
9. **Notice-delivery topology.** Endpoint discovery, feed redundancy, and a registry-hosted aggregate feed are all unspecified, so a single small agency's endpoint is a single point of failure for every notice it issues. Notice suppression is a top-tier threat in Section 10 and v0.1 does not defend against it.
10. **Detached claims for sensitive text.** `internal_text` is inside the signed body, so confidentiality and authenticity are in direct conflict (10.4). A per-field encryption or detached-claims construction would resolve it.
11. **Non-road automation.** `UAS` and `SIDEWALK_ROBOT` are in `applies_to` and the altitude fields exist, but neither is fully worked through. UAS restrictions already have an established path through FAA UAS Data Exchange, and GFN should map to it rather than compete.
12. **Location resolution, and jurisdictions that do not require geometry.** 7.1 makes `zones[].geometry` a MUST, and every area ceiling in 5.3 and the whole of 5.4's containment test depend on it. California's 13 CCR 227.02(cc) accepts a conforming geofencing message that identifies a location by "a street address, intersection, coordinates, or any other reasonable and customary way," with a mandatory two-minute fleet action attached. A conforming real-world message may therefore carry no shape, and the specification's two most load-bearing controls have nothing to evaluate. `LOCATION-RESOLUTION.md` specifies the rule, ready to merge here as 7.4, and it is enforced: `zones[].location_resolution` is in the schema with the 250 m resolved-buffer cap and the multi-candidate conditional, `validate.py` checks R-4, R-6, R-13 and R-15, and four regression cases cover them. What remains is R-16, which forbids an `EXTEND` from enlarging a resolved zone and needs the cross-message state Section 13 identifies as missing. SECURITY-REVIEW L5.

---

## Appendix A. Glossary

### Terms of art in this specification

| Term | Meaning |
|---|---|
| **Notice** | One signed geofence message. Identified for its whole life by `notice_id` plus `sequence`. |
| **Issuer** | The public authority that composes and signs a notice. |
| **Receiver** | The covered entity that runs the automated driving system's backend and accepts notices on behalf of its vehicles: a fleet operator for a robotaxi, a manufacturer for a privately owned vehicle (8.6). |
| **Zone** | One restricted area within a notice. A notice may carry several. |
| **Level** | What vehicles must do inside the zone, from `PROHIBITED` down to `NO_PUDO` (6.3). |
| **Prohibitive level** | `PROHIBITED` or `NO_DRIVERLESS`. Both are total closures for a driverless-only fleet, so both take the stricter ceilings (5.3). |
| **Tier** | The authority class of the issuer, derived from the registry and the reason code, never asserted in the message (5.3). |
| **Corridor** | A street kept open through a restricted zone, treated as `NO_STOP` regardless of the notice's level (6.4, 8.2). |
| **Dispersed egress** | Spreading exiting vehicles across available exits rather than each minimizing its own distance (8.3). |
| **Detached signature** | A signature transmitted separately from the bytes it covers, so the payload is the HTTP body rather than a copy inside the signature (10.1). |
| **Issuer Registry** | The credential authority for issuing agencies: issues and revokes signing certificates, assigns tier, holds jurisdiction boundaries and mutual-aid flags, and publishes the callback numbers 11.6 relies on. Does not yet exist. Governance direction in `REGISTRY-GOVERNANCE.md`; open items at 14.1. |
| **Receiver Directory** | The register of covered entities that receive notices: their notice-ingestion endpoints, contacts of record, and the operator credentials the 11.1 feed endpoints authenticate. Distinct from the Issuer Registry in population, vetting, and enforcement lever. Does not yet exist (14.1, 14.9). |
| **Resolved zone** | A zone whose geometry was synthesized by a gateway from a non-geometric location identifier rather than drawn by the issuer. Permitted only where a binding profile allows it, and bounded by `LOCATION-RESOLUTION.md` (14.12). |

### Acronyms and standards

| Term | Expansion and meaning |
|---|---|
| **ADS** | Automated Driving System. The driving automation itself. H.R. 10033 defines a covered vehicle as "a vehicle with an Automated Driving System." |
| **AGL / AMSL** | Above Ground Level / Above Mean Sea Level. Altitude datums. Which one is in use must be stated (7.1): UAS practice is AGL, CAP is AMSL. |
| **AOT** | Alert Origination Tool. The commercial software an agency uses to compose and submit CAP into IPAWS. |
| **AV** | Automated vehicle. Used loosely; `ADS` is the precise term. |
| **CAD** | Computer-Aided Dispatch. The agency's incident system. Not computer-aided design. |
| **CAP** | Common Alerting Protocol. An OASIS XML standard for emergency messages, version 1.2 here. |
| **CBOR** | Concise Binary Object Representation (RFC 8949). A compact binary encoding, used in the C-V2X sketch (11.5). |
| **CMAS** | Commercial Mobile Alert Service. The former name for WEA; the IPAWS profile still uses it. |
| **COG** | Collaborative Operating Group. The unit of identity in IPAWS. An agency gets a COG ID and its alerts are attributed to it. |
| **COSE** | CBOR Object Signing and Encryption (RFC 9052). The CBOR-native equivalent of JWS. |
| **CRL** | Certificate Revocation List. A signed list of certificates no longer valid. |
| **C-V2X** | Cellular Vehicle-to-Everything. Short-range radio in the 5.9 GHz band, replacing DSRC. |
| **DSRC** | Dedicated Short-Range Communications. The older 5.9 GHz standard, which the FCC has noted failed to reach scale in the United States. |
| **E.164** | The ITU international telephone number format: a leading plus, then country code and digits, no spaces or punctuation. |
| **EAS** | Emergency Alert System. The broadcast channel (radio, television, cable). |
| **ECDSA** | Elliptic Curve Digital Signature Algorithm. |
| **EOC / EMA / OES** | Emergency Operations Center / Emergency Management Agency / Office of Emergency Services. |
| **EPSG:4326** | The coordinate reference system identifier for WGS 84 latitude and longitude. |
| **ES256** | ECDSA using curve P-256 and SHA-256. The one signature algorithm this specification permits (10.1). |
| **FAA** | Federal Aviation Administration. Relevant to any future UAS binding. |
| **FCC** | Federal Communications Commission. Regulates the 5.9 GHz band C-V2X uses. |
| **FEMA** | Federal Emergency Management Agency. Runs IPAWS. |
| **FIPS** | Federal Information Processing Standards. Here, the six-digit county code that also serves as the SAME location code. |
| **GeoJSON** | RFC 7946. The geospatial JSON format used for all geometry here. Coordinates are `[longitude, latitude]`. |
| **GFN** | Geofence Notice. This specification. |
| **GNSS** | Global Navigation Satellite System. GPS and its equivalents. Its time signal is spoofable, which 8.5 accounts for. |
| **HMAC** | Hash-based Message Authentication Code. A symmetric construction, rejected here because it cannot prove which of two parties signed. |
| **H.R. 10033** | The AV Emergency Response Coordination Act, introduced 3 August 2026. Would authorize geofence notices and require a 24/7 operator hotline. Not passed. |
| **IAFC** | International Association of Fire Chiefs. |
| **IPAWS** | Integrated Public Alert and Warning System. FEMA's national alert aggregator. |
| **IPAWS-OPEN** | IPAWS Open Platform for Emergency Networks. The server side that authenticates and routes alerts. |
| **IS-247 / IS-251** | FEMA independent study courses for IPAWS alert originators and alerting administrators. IS-247 is a prerequisite for full IPAWS-OPEN access. |
| **JCS** | JSON Canonicalization Scheme (RFC 8785). Produces one deterministic byte sequence for a JSON object, so a signature over it is reproducible. |
| **JOSE** | JSON Object Signing and Encryption. The family of standards containing JWS. |
| **JWS** | JSON Web Signature (RFC 7515). The signature format used here, in its detached form. |
| **LTE / 5G** | Cellular generations. The link an operator's backend actually uses to reach its vehicles (8.6). |
| **MAP / TIM** | V2X message types (SAE J2735): intersection geometry, and Traveler Information Message. Cited only for payload-size comparison in 11.5. |
| **MOA** | Memorandum of Agreement. Required with the IPAWS Office to originate or to receive; returns a digital certificate. |
| **NHTSA** | National Highway Traffic Safety Administration. |
| **OASIS** | Organization for the Advancement of Structured Information Standards. Publishes CAP. |
| **OCSP** | Online Certificate Status Protocol. Live revocation checking, the alternative to a CRL. |
| **PII** | Personally identifiable information. Prohibited in every free-text field here (6.1). |
| **RFC** | Request for Comments. An IETF standards document. |
| **SAME** | Specific Area Message Encoding. The EAS scheme supplying the six-digit location codes and three-letter event codes CAP carries. |
| **SSE** | Server-Sent Events. The one-way streaming transport for the notice feed (11.1). |
| **TLS** | Transport Layer Security. Version 1.3 or better required for `RESTRICTED` and `PRIVATE` notices (10.4). |
| **UAS** | Uncrewed Aircraft System. A drone. Present in `applies_to` but not fully worked through (14). |
| **URN** | Uniform Resource Name. The identifier form used for `notice_id`, `authority_id` and operator IDs. |
| **USDOT** | United States Department of Transportation. Publishes WZDx. |
| **UTC** | Coordinated Universal Time. All timestamps here are UTC with a trailing `Z`; CAP writes the same instant as `-00:00`. |
| **WEA** | Wireless Emergency Alerts. The cell-broadcast channel to phones. Its `CMAMtext` field is capped at 90 English characters. |
| **WGS 84** | World Geodetic System 1984. The datum GPS uses and the one all coordinates here are expressed in. |
| **WZDx** | Work Zone Data Exchange. A USDOT standard for agencies to publish road events as a GeoJSON feed that navigation providers consume. The model for the consumer-navigation binding in 11.7. |

---

## Sources

- [Common Alerting Protocol Version 1.2, OASIS Standard](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html)
- [CAP v1.2 USA IPAWS Profile Version 1.0, OASIS](https://docs.oasis-open.org/emergency/cap/v1.2/ipaws-profile/v1.0/cap-v1.2-ipaws-profile-v1.0.html)
- [Feds demand autonomous vehicle companies stop interfering with first responders, TechCrunch, July 8, 2026](https://techcrunch.com/2026/07/08/feds-demand-autonomous-vehicle-companies-stop-interfering-with-first-responders/)
- [Rep. Mullin Introduces Bill to Standardize Autonomous Vehicles Protocol During Emergencies, July 28, 2026](https://kevinmullin.house.gov/2026/07/28/rep-mullin-introduces-bill-to-standardize-autonomous-vehicles-protocol-during-emergencies/)
- [Work Zone Data Exchange (WZDx) Specification, USDOT](https://github.com/usdot-jpo-ode/wzdx)
- [RFC 7946, The GeoJSON Format](https://datatracker.ietf.org/doc/html/rfc7946)
- [RFC 7515, JSON Web Signature](https://datatracker.ietf.org/doc/html/rfc7515)
- [RFC 8785, JSON Canonicalization Scheme](https://datatracker.ietf.org/doc/html/rfc8785)
- [FCC rules for C-V2X in the 5.9 GHz band](https://www.hlc.com/en/publications/us-fcc-adopts-new-its-rules-to-govern-cv2x-deployment-in-the-59-ghz-band)
- [Waymo on the role of cellular connectivity, Light Reading](https://www.lightreading.com/iot/waymo-keeps-5g-way-in-the-background)
- [Work zone data reaching navigation providers, National Operations Center of Excellence](https://transportationops.org/case-studies/better-work-zone-information-drivers)
