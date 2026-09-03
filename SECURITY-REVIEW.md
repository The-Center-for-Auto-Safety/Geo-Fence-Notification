# GFN v0.1 security and safety review

Adversarial review of the specification, both schemas, and the reference validator, conducted 2026-09-02 against the first complete draft. Every finding below was reproduced against the actual files before being recorded.

This document is the disposition record. Findings marked **closed** are fixed in the current draft, with a regression case where one is possible. Findings marked **open** are recorded honestly rather than quietly dropped, and the ones that matter are carried into Section 14 of the specification.

Acronyms and terms of art used below are defined in Appendix A of `GFN-0.1-specification.md`.

## Summary

| | Found | Closed | Open |
|---|---|---|---|
| Critical | 6 | 6 | 0 |
| High | 12 | 12 | 0 |
| Medium | 11 | 8 | 3 |
| Low | 24 | 17 | 7 |

The open items are all design questions that need a credential registry or a v0.2 construction to answer, not defects that a text edit closes.

## Critical

| ID | Finding | Disposition |
|---|---|---|
| C1 | `EXTEND` had no cumulative-duration bound. A script re-issuing every 3 h 55 m produced a permanent restriction from individually valid, signed, in-ceiling messages. Section 4.2 called mandatory expiry the most important safety property in the document, and nothing enforced it. | **Closed.** `original_effective_start` added and REQUIRED on every revision; cumulative ceiling added to §4.3 and to the validator's tier table. Regression: `invalid/96`. |
| C2 | Revision authority was unbound. Nothing tied `notice_id`'s authority slug to `authority_id`, required a revision to carry the original `notice_id`, or required `references` to name the same notice. A Tier 4 event organizer with a valid credential could `CANCEL` a fire department's live `PROHIBITED` zone, and could mint notices attributed to the fire department in every register and audit log. | **Closed.** Three binding rules added to §3.1, all enforced in the validator. Regression: `invalid/95`. |
| C3 | An unsigned `status: TEST` `CANCEL` was schema-valid. A receiver whose cancel handler ran before its `ACTUAL` gate would clear a live fire-ground restriction for one unauthenticated HTTP request. The cheapest attack in the document. | **Closed.** Schema now requires `signature` on `UPDATE`, `CANCEL`, and `EXTEND` regardless of `status`; §3.1 states it normatively. |
| C4 | `duration`-only notices carried no absolute end, so a replay restarted its own clock. §10.2's claim that time bounding defeats replay was false for exactly those notices. The three defenses all failed: `issued_at` staleness was a SHOULD, its bound was `freshness_window` (a field inside the replayed message), and the seen-notice cache covered 15 days. | **Closed.** `duration` is now drafts-only; `ACTUAL` notices MUST carry `effective_end`. `issued_at` staleness is a MUST against a receiver-configured bound. §10.2 rewritten to say what actually defends against replay. |
| C5 | §10.3's entire limits table disabled itself: "the receiver MUST accept it, apply it, flag it." Every listed limit was a logging threshold, in the section headed "Abuse and denial of service." One compromised Tier 1 credential could apply 200 km² of restriction to a 121 km² city while breaching every limit. | **Closed.** §10.3 rewritten to separate soft thresholds (accept, flag, page) from hard gates (human confirmation, no auto-approval on timeout). The `EVACUATION`/`WILDFIRE`/`TSUNAMI`/`SEVERE_WEATHER` review carve-out is removed, since it exempted review precisely where the blast radius is largest and told an attacker which four strings to use. |
| C6 | Tier 1W granted `EMERGENCY_MANAGEMENT` 500 km² for 14 days on any reason code, not just the wide-area hazards that justify the tier. A compromised county EMA credential could degrade a metro area for two weeks under `reason.code: OTHER`, below every review threshold. | **Closed.** 1W is now gated on the wide-area reason codes for every agency type. `EMERGENCY_MANAGEMENT` falls back to Tier 1 otherwise. |

## High

| ID | Finding | Disposition |
|---|---|---|
| H1 | Validator subtracted interior rings with no containment check and never floored at zero. A 5.5 km² polygon with a "hole" 10 km away reported 1.05 km² and passed a 2 km² ceiling. | **Closed.** Containment check added; uncontained holes are a rejection. Regression: `invalid/97`. |
| H2 | Self-intersection check silently skipped rings above 200 segments while the schema allowed 512, and returned "clean" rather than erroring. A 240-segment figure-eight covering 23 km² reported 0.97 km². | **Closed.** Skip removed; the check is O(n²) bounded by the schema's own cap. Regression: `invalid/98`. |
| H3 | `parse_utc` stripped the trailing `Z` along with the fractional seconds, then demanded a format ending in `Z`. A schema-legal `...11.500Z` crashed the validator. The `rfc3339Utc` pattern also validated shape only, so `2026-13-45T25:99:99Z` passed and crashed any parser behind it. | **Closed.** Regex parse with component range checking. §10.5 now tells receivers to range-check timestamps. |
| H4 | `buffer_m` was permitted on polygons, ignored by the validator, and undefined in the prose. A 5 km buffer on a 2 km² zone dilated it past 100 km² while every area check read the undilated ring. Two conforming fleets would restrict areas three orders of magnitude apart from the same signed bytes. | **Closed.** Schema forbids `buffer_m` on `Polygon` and `MultiPolygon`. Regression: `invalid/99`. |
| H5 | The coordinate-order heuristic never examined `LineString` or `Point` geometry, and false-positived on legitimate high-latitude notices (Reykjavík at `[-21.94, 64.15]`). | **Closed.** Checks all positions in every geometry type. Demoted to a warning, because the schema's latitude bound already rejects every detectable swap and what remains is genuinely ambiguous. |
| H6 | `max_speed_kph` had no floor. `0.1` over a 5 km² zone for 72 hours was valid from a Tier 3 credential. §8.1's safety override did not cover it: travelling far below surrounding traffic is not a maneuver a planner refuses, and it is a documented collision generator. The most direct path in the format from a valid message to a crash. | **Closed.** Schema floor of 10 km/h, plus an explicit §8.1 clause permitting a vehicle to exceed the limit where the lower speed is itself unsafe. |
| H7 | `NO_STOP` was defined as prohibiting "stopping, standing, yielding-in-place," with no carve-out. Zones contain red lights and crosswalks, and the level was available to Tier 4. | **Closed.** Redefined as discretionary stopping only, with an explicit §8.1 clause that no notice suppresses a required yield. |
| H8 | `corridors[].geometry` was optional, and both examples using corridors supplied only a name. §8.2, the normative behavior table, never mentioned corridors at all. A watch commander who believed he had kept a street open for emergency access would have it closed by every conforming receiver, with no feedback. | **Closed.** `geometry` is required; §8.2 gains a normative corridor rule (corridors are `NO_STOP` along their line regardless of level). |
| H9 | `PROHIBITED` + `HOLD_AT_SAFE_LOCATION` was schema-valid and parked a vehicle inside an active fire ground for the notice's full duration. This is the exact failure §6.5's own rationale says the default exists to prevent, and it contradicts §8.3's absolute prohibition on ending a trip inside the zone. | **Closed.** Forbidden in the schema; §6.5 requires the hold location to be outside the zone. |
| H10 | Acknowledgements were entirely unauthenticated. A forged `ACCEPTED` with zero vehicles told an incident commander the zone was clear when it was not. Forged rejections exploited §9's own requirement that rejections reach a human, pulling an IC into phone calls during an incident's first minutes. | **Closed.** `signature` required on every acknowledgement; §9 states the reasoning. |
| H11 | "A vehicle whose clock is unsynchronized by more than 60 s MUST NOT process new notices and MUST escalate" made GNSS spoofing a fleet-disable primitive: vehicles in range stop seeing new notices, stop seeing cancellations, and all escalate at once. | **Closed.** Time authority moved to the fleet backend; a clock discrepancy is flagged, not fatal. |
| H12 | `REMOTE_OPERATOR_REQUIRED` was available at any tier with no aggregate cap. A Tier 4 `NO_PUDO` notice over a downtown zone at rush hour weaponized the operator's remote-assistance desk, which is also the fallback for genuine emergencies. | **Closed.** Restricted to Tier 1 and 1W; receivers cap concurrent escalations at staffed capacity and fall back to normal egress beyond it. |

## Medium

| ID | Finding | Disposition |
|---|---|---|
| M1 | Simultaneous nearest-point egress converges a whole fleet on the same perimeter arterials against a five-minute deadline, on the roads an evacuating public is using. "Nearest" is also wrong inside a zone drawn to include apparatus staging: the nearest boundary can be past the fire. | **Closed.** §8.3 requires dispersed egress and a preference for exits away from the hazard. A hazard-centroid field is deferred to v0.2. |
| M2 | "Strictest wins" is undefined for `on_entry_behavior`, deadlocks two adjacent `PROHIBITED` zones, and strips `exempt_operators` from an overlapping notice, which can geofence out a contracted paratransit operator. | **Partly closed.** §14 now names all three cases explicitly, and v0.1 states that egress is computed against the union of active zones. Full resolution needs v0.2. **Open.** |
| M3 | `internal_text` is inside the signed body, so a relay cannot strip it without breaking the signature. A `PRIVATE` protective-operation notice sent over IPAWS carries it in the clear to everyone on that path. The poll and stream endpoints also had no client authentication. | **Partly closed.** Client authentication added to §11.1; §10.4 states the conflict plainly and gives an operational rule (send genuinely sensitive notices direct-only). A detached-claims construction is a v0.2 item. **Open.** |
| M4 | §14 listed live vehicle counts as an open surveillance question while §9 and the ack schema already required them. `exceptions[].detail` had no hygiene rule, and the reference example carried rider trip data to a police agency. | **Closed.** Ack hygiene rules added to §9 and enforced by the validator; `ack_required` is meaningful only at priority 0 and 1; per-vehicle location is optional above priority 1 and must not be retained past after-action review. The example is rewritten. |
| M5 | Revocation was promised within 15 minutes but never re-checked at activation. Twenty minutes of key access bought a year of future-dated notices that all still activate. | **Closed.** §10.3 requires revocation re-check at `effective_start`. |
| M6 | `sequence` had no ceiling, so one forged message at a huge sequence permanently locked the legitimate issuer out of cancelling its own notice. | **Closed.** Capped at 4096, with the reasoning stated. A registry override for reaching the cap is a v0.2 item. |
| M7 | `NO_DRIVERLESS` is operationally identical to `PROHIBITED` for a driverless-only fleet, but carried the permissive tier ceilings. A utility could impose over 5 km² for 72 hours what the fire department may impose over 2 km² for 4 hours. | **Closed.** Prohibitive levels defined in §5.3 to cover both; ceilings applied to both in the validator. |
| M8 | `egress_route` was missing from the §6.4 field table and unvalidated everywhere. A mis-drawn route could funnel vehicles into apparatus staging. | **Closed.** Added to §6.4 and subjected to the §7.2 geometry rules. Semantic route checking (connectivity, direction) needs map data and is out of scope for the reference validator. |
| M9 | §11.6's manual path described a message that could never be valid: signed by the operator's key while carrying the caller's `authority_id`, which §10.1 makes a mandatory rejection. It also permitted `KNOWN_CONTACT` verification for a priority-0 `PROHIBITED` notice, on the only path with no cryptography. | **Closed.** Manual notices are issued under the operator's own identity with the claimed agency recorded separately; callback-to-published-number is mandatory at priority 0/1 and at prohibitive levels. |
| M10 | `priority` was documented as not affecting vehicle behavior while §8.4 keyed the fleet clearance deadline to it, and it was unconstrained by tier. An event organizer could claim `priority: 0`, forcing a five-minute fleet-wide clearance and producing a maximal CAP urgency triple. | **Closed.** Priority 0 and 1 restricted to Tiers 1, 1W and 2, enforced in the validator; §3.2 corrected. The "clear by `effective_start`" deadline for priority 2 to 4 remains unsatisfiable for a same-instant start. **Open.** |
| M11 | The schema enforced the 32-zone half of §10.5's cap but not the 512-vertex half: 8.4 million positions was schema-valid, bounded only by the prose payload cap. Ring closure cannot be expressed in JSON Schema at all. | **Partly closed.** §10.5 now names unclosed, self-intersecting, and uncontained-hole rings as required rejections, and the validator enforces the vertex cap. A schema-level total-vertex bound is not expressible; receivers must enforce it. **Open.** |

## Low

Seventeen of twenty-four are fixed: E.164 hotline pattern, `references` sequence pattern, schema defaults that contradicted the prose, `ACK_REQUEST` removed from the `msg_type` enum, `ACCEPTED` with exceptions forbidden, ring-closure comparison against 3-element positions, PII patterns extended to `area_desc` and the other free-text fields that reach a console or the register, lead-time enforcement, `EAS-ORG` emitted only for the EAS channel, CAP `certainty` derived rather than hardcoded, the missing CAP row for a buffered `LineString`, the CAP `references` state requirement, AMSL/AGL datum made explicit and required, `ACTIVE_THREAT` and friends barred from `PUBLIC` scope, register redaction and recurring-movement aggregation, percent-encoding of URN path segments, and the §2 example labelled honestly as unsigned.

Open, and recorded rather than fixed:

- Collinear overlapping segments are not detected as self-intersection, so a zero-width spike in a ring passes.
- `validate.py` does not check the CAP XML example, so the coordinate-order conversion the specification calls its top integration defect has no automated test.
- `invalid/92` is caught by the schema's latitude bound rather than by the coordinate-order heuristic it was written to exercise, so the heuristic has no direct coverage.
- Example 04 uses SAME code `011001` for a national-scope federal notice. There is no national SAME code and the schema's six-digit pattern cannot express one.
- `freshness_window` still carries more than one meaning across §3.1, §4.1, and §8.5. §4.1 now scopes it to a receiver-clamped caching hint, but the older prose has not been fully reconciled.
- Notice-delivery topology, endpoint discovery, and feed redundancy are unspecified. Now §14 item 6.
- `EVENT_ORGANIZER` at Tier 4 remains the loosest credential class in the design, and the case for giving private event organizers any direct issuance authority rather than routing them through a municipal permit office is not made in this document.

## Later findings

| ID | Finding | Disposition |
|---|---|---|
| L1 | `validate.py` applied the Section 5.3 lead-time floor to every message type. A revision keeps the original `effective_start`, so the moment a running notice is updated its start is in the past and the check reports a violation on a correct message. Found when the demonstration console's `UPDATE` output was validated. | **Closed.** The check now runs on `msg_type: NEW` only, and Section 5.3 says so. Revisions remain bounded by the cumulative ceiling in 4.3. |

| L2 | The `rejection_code` enum had no way to say "this message is malformed." `MALFORMED_GEOMETRY` is geometry-specific and `UNSUPPORTED_VERSION` covers only the version, so a body that failed to parse, or failed the schema anywhere else, had to be rejected under a code that misdescribed it. An issuer reading its own logs would go looking at the zone. Found while writing the message-flow walkthrough. | **Closed.** `MALFORMED_MESSAGE` added to the enum and to §9, with the split between the two codes stated. |

| L3 | Section 11.2 presented IPAWS as a general-purpose secondary path for any notice, and 10.4 discussed the confidentiality of `RESTRICTED` notices travelling over it. The feed by which a non-government organization actually receives from IPAWS is the All-Hazards Information Feed, which carries public alerts. `RESTRICTED` needs COG-to-COG and an operator holding a COG; `PRIVATE` has no route. So the path is unavailable for precisely the notices 10.4 requires to be non-public, and a small agency relying on IPAWS alone cannot issue an active-threat perimeter. Found while documenting the message flow. | **Partly closed.** 11.2 and 10.4 now state the `PUBLIC`-only limitation, and the two IPAWS profile constraints that bind a gateway (`effective`/`onset` ignored, and `Update`/`Cancel` referencing every unexpired related message). The underlying gap, that small agencies have no path for restricted notices, is a design problem and is now §14 item 6. **Open.** |

## What held up

The review found nothing wrong with: the `$defs/position` construction (`prefixItems` plus `items: false` correctly pins `[lon, lat, alt?]`), the `effective_end` XOR `duration` `oneOf`, the four original `restriction` conditionals, the `MANUAL` channel `contains` conditional, the `zones[].geometry` `oneOf` discrimination, both duration regexes, the buffered-`LineString` area formula, the tier-derivation function's fidelity to the §5.3 table, and both acknowledgement conditionals.

It also confirmed that §4.2's core design (mandatory expiry, burden of continuation on the issuer) and §6.5's default (exit rather than freeze) are correct. Findings C1, H9, and M1 were failures to carry those two ideas through the rest of the document, not disagreements with them.
