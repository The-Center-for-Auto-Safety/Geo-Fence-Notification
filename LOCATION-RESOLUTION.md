# Location resolution

**Status:** Normative draft, proposed as GFN specification section 7.4 for v0.2. Written 2026-09-04.
**Closes:** SECURITY-REVIEW finding L5. Blocks `PROFILE-CALIFORNIA.md`.
**Depends on:** GFN-0.1-specification.md sections 5.3, 5.4, 7.1, 7.2, 8.4, 9, 11.6, 12.

## 1. The problem this exists to solve

GFN 7.1 makes `zones[].geometry` a MUST. Every safety control in the specification is built on that assumption. The area ceilings in 5.3 are expressed in square kilometres. Jurisdictional containment in 5.4 is a geometric test and is described there as the primary defense against a compromised small-agency credential closing a metropolitan area. Neither can run on a message that does not carry a shape.

Some jurisdictions do not require one. California's 13 CCR 227.02(cc) defines a conforming emergency geofencing message as one that identifies a location "using a street address, intersection, coordinates, or any other reasonable and customary way of identifying a location." A dispatcher who says "Valencia and 19th, keep them out" has issued a message that California law obliges a manufacturer to act on within two minutes, and that GFN as written cannot represent, bound, or contain.

The naive fix is for each receiver to geocode the string and draw something. That is the failure this document exists to prevent. If the receiver picks the area, then the receiver is choosing the size of the closure, the tier system no longer bounds anything, containment no longer bounds anything, and two conforming fleets given the same words restrict different cities. Worse, whoever controls the string controls the area, so an unauthenticated message becomes an unbounded one.

The rule below keeps the safety controls attached by making resolution explicit, bounded, auditable, and refusable.

## 2. Definitions

**Location identifier.** A non-geometric description of a place supplied by an issuer: a street address, an intersection, a block range, a named facility, or a bare coordinate pair.

**Resolved zone.** A `zones[]` entry whose `geometry` was synthesized by a gateway or receiver from a location identifier rather than drawn by the issuer.

**Resolver.** The component that performs the synthesis. It is named and versioned in the audit record because two resolvers will disagree and an after-action review has to be able to tell which one ran.

## 3. Rules

### 3.1 Applicability

**R-1.** A notice on the direct GFN path (11.1) MUST carry issuer-drawn geometry. Location resolution is not available there and a notice arriving without geometry is a `MALFORMED_GEOMETRY` rejection, unchanged from v0.1.

**R-2.** Location resolution applies only where a binding profile explicitly permits a location identifier in place of geometry, and only within the bounds that profile sets. `PROFILE-CALIFORNIA.md` is the first such profile. A profile MAY be stricter than this document. A profile MUST NOT be looser.

### 3.2 Where resolution happens

**R-3.** Resolution MUST happen once, at the gateway or the receiver's backend, and the notice that leaves it MUST carry explicit geometry. Vehicles MUST NOT resolve location identifiers.

This follows the same reasoning as 8.6. Resolution is a decision that needs a map, a jurisdiction boundary, a policy, and the ability to refuse. Replicating it across embedded endpoints puts a geocoder in the safety path on a device that cannot be patched quickly and cannot ask a human.

### 3.3 Shape and default radii

**R-4.** A resolved zone MUST use `Point` geometry with `buffer_m`, which 7.1 already defines, except that a block range MAY use `LineString` with `buffer_m` where the resolver has street centerline data for the named block.

**R-5.** Absent a profile override, the default buffer radius by identifier type is:

| Location identifier | Default `buffer_m` | Resulting area |
|---|---|---|
| Coordinate pair | 75 | 0.018 km² |
| Street address, single premises | 75 | 0.018 km² |
| Intersection | 100 | 0.031 km² |
| Named facility or landmark | 150 | 0.071 km² |
| Block range, with centerline data | 30 along the `LineString` | varies with block length |
| Block range, without centerline data | 150 | 0.071 km² |

These are deliberately small. A resolved zone is a guess about what an issuer meant, and the correct response to an under-sized guess is that the issuer sends a real polygon or a second message, not that every guess is generous. Compare the reasoning in 5.3 about a tired duty officer drawing an unnecessarily large area to avoid touching it again: the same incentive applies to a resolver author, and the same answer applies.

### 3.4 The hard ceiling

**R-6.** A resolved zone MUST NOT exceed a 250 m buffer radius, about 0.196 km², regardless of identifier type, profile, or configuration. A profile MAY set a lower maximum. No profile may raise it.

**R-7.** A location identifier that cannot be represented within R-6 MUST be rejected with `LOCATION_NOT_RESOLVABLE`, and the rejection MUST be surfaced to a human at both ends within the 8.4 latency budget. "The east side of downtown" is not a location identifier; it is a request for a polygon.

R-6 is the load-bearing number in this document. It sits an order of magnitude below the 2 km² Tier 1 ceiling, which means a resolved zone can never approach any tier's area limit, which in turn means the worst case for a forged or mistaken location string is one intersection rather than one district. It also means the ceiling is doing its work before the tier table is consulted rather than after.

### 3.5 The controls still apply

**R-8.** A resolved zone counts toward the 5.3 area ceiling exactly as a drawn zone does. Resolution creates no allowance.

**R-9.** Jurisdictional containment under 5.4 MUST be evaluated against the resolved geometry. A resolved zone that is not wholly within the issuer's registered boundary MUST be rejected with `OUTSIDE_JURISDICTION`.

**R-10.** A receiver MUST NOT clip, shrink, or relocate a resolved zone to bring it inside a boundary or under a ceiling. Clipping to fit converts an out-of-jurisdiction request into an in-jurisdiction closure, which is the exact outcome 5.4 exists to prevent, and it does so silently.

### 3.6 Ambiguity is a rejection, not a guess

**R-11.** If a location identifier resolves to zero candidates within the issuer's registered jurisdiction, the receiver MUST reject with `LOCATION_NOT_RESOLVABLE`.

**R-12.** If it resolves to more than one candidate within that jurisdiction, the receiver MUST reject with `AMBIGUOUS_LOCATION` and MUST include every candidate it found in `exceptions[].detail`, so the issuer can pick one rather than guess again.

**R-13.** A receiver MUST NOT select among candidates by rank, confidence score, proximity, or population. Geocoders return ranked guesses and they are usually right, which is precisely the problem: a resolver that is right 98 percent of the time closes the wrong block roughly once every fifty incidents, silently, with statutory force behind it.

**R-14.** A rejection under R-11 or R-12 is not a refusal to cooperate, and Section 9's rule applies unchanged: it MUST reach a human at both ends inside the 8.4 budget. In a jurisdiction with a statutory response clock, a rejection stops the clock only if the issuer receives it, which is why R-14 is a MUST rather than a SHOULD.

### 3.7 Prohibitive levels

**R-15.** A resolved zone MUST NOT carry `PROHIBITED` or `NO_DRIVERLESS` unless the notice also satisfies 11.6's `CALLBACK_TO_PUBLISHED_NUMBER` verification.

An unauthenticated string, an area the receiver chose, and a total closure is the entire attack in one message. The ninety-second callback is cheap and it is the only control that reaches this case. Note that this rule composes with, and does not replace, whatever authentication a profile requires.

### 3.8 Revisions

**R-16.** An `EXTEND` or `UPDATE` against a notice containing a resolved zone MUST either carry the same resolved geometry or supply issuer-drawn geometry. It MUST NOT re-resolve to a larger area, and it MUST NOT resolve a new identifier into an enlargement.

Without R-16, resolution becomes an area-escalation primitive: issue against a vague string, then extend against a vaguer one. The cumulative duration ceiling in 4.3 has a cumulative-area analogue here and this is it.

### 3.9 Audit

**R-17.** A resolved notice MUST carry a `location_resolution` block recording, at minimum: the verbatim source string as received, the identifier type the resolver classified it as, the resolver's name and version, the resolution timestamp, the buffer radius applied, the number of candidates found, and the channel the identifier arrived on.

**R-18.** The public register (12) and every audit log MUST present a resolved zone as derived, not as issued. `area_desc` for a resolved zone MUST state that the geometry was synthesized and MUST quote the source string.

R-17 and R-18 exist because of what 12's three-year retention is for. Without them, an after-action review of a wrongly closed street shows a polygon with an issuer's signature over it, and nothing in the record says the issuer never drew it or that a receiver chose its size. That is the difference between a reviewable system and one that launders a guess into an official act.

### 3.10 Determinism

**R-19.** Issuers SHOULD supply coordinates rather than prose wherever their tooling allows, and a profile SHOULD say so in its issuer guidance. Two conforming receivers running different resolvers against the same street address will produce different centers, and R-17's resolver identity is what makes that divergence diagnosable rather than mysterious. It does not make it go away.

## 4. New rejection codes

Two additions to the `rejection_code` enum in `schema/acknowledgement.schema.json`:

| Code | Meaning |
|---|---|
| `AMBIGUOUS_LOCATION` | The location identifier resolved to more than one candidate within the issuer's jurisdiction. Candidates are listed in `exceptions[].detail`. |
| `LOCATION_NOT_RESOLVABLE` | The location identifier resolved to nothing within the issuer's jurisdiction, or to an area that cannot be bounded within R-6. |

`MALFORMED_GEOMETRY` remains for a notice whose supplied geometry is invalid. The split matters for the same reason L2's `MALFORMED_MESSAGE` split mattered: an issuer reading its own logs should not go looking at a polygon that was never sent.

## 5. Implementation status

This rule is specified but not yet enforceable, and the repository is deliberately consistent rather than half-changed. Three pieces of work make it real:

1. **Schema.** `geofence-notice.schema.json` has `additionalProperties: false` at the top level, so `location_resolution` must be added there before any conforming notice can carry it. Add the two rejection codes to the acknowledgement schema at the same time.
2. **Validator.** `validate.py` gains the R-6 ceiling check, the R-8 ceiling contribution, and a check that a resolved zone at a prohibitive level carries the 11.6 verification (R-15). R-9 through R-14 need a registry and a resolver, so they stay outside the reference validator for the same reason signature verification does, per Section 13.
3. **Regression cases.** At minimum: a resolved zone over the 250 m ceiling, a resolved `PROHIBITED` without callback verification, and an `EXTEND` that enlarges a resolved zone. These belong in `examples/invalid/` alongside the existing nine.

Until then, `validate.py` continues to report all 16 examples behaving as expected, and this document is a design commitment rather than an enforced one.
