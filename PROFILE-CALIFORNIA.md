# GFN profile: California

**Status:** Normative binding, draft. Written 2026-09-04.
**Binds:** Cal. Veh. Code 38751 (eff. 2026-07-01, AB 1777) and 13 CCR Articles 3.7 and 3.8 (emergency-response provisions commencing 2026-07-01).
**Depends on:** `GFN-0.1-specification.md`, `LOCATION-RESOLUTION.md`.
**Audience:** an AV manufacturer holding or seeking a California driverless testing or deployment permit, and the emergency response officials who will issue to it.

---

## 1. What this profile is for

California already requires the behavior GFN describes, and specifies almost nothing about how it works.

13 CCR 228.08(c)(10)(E) requires a manufacturer operating under a Deployment Permit to "issue direction to its fleet to leave or avoid an identified area within two minutes of receiving an emergency geofencing message from an emergency response official." 227.42(f)(3)(F) imposes the same obligation on driverless testing permit holders under 10,001 lbs GVWR. Cal. Veh. Code 38751(d)(2) is the statutory original.

What triggers that obligation is defined at 227.02(cc) as "a message using commonly available communication methods to identify a location using a street address, intersection, coordinates, or any other reasonable and customary way of identifying a location, that directs an autonomous vehicle to leave or avoid an area because of an emergency." The sender is an "emergency response official," a category that by its own terms "includes, but is not limited to, emergency dispatchers, first responders, and peace officers."

So the trigger is an unauthenticated message, of no fixed format, arriving over an unspecified channel, from an open-ended category of senders, identifying a place that need not be a shape, and carrying a two-minute mandatory action. 228.08(c)(10)(F) then gives the manufacturer 30 business days to hand any newly interested official "all information necessary" to start issuing, which makes onboarding bilateral, one agency at a time, one manufacturer at a time.

This profile is what a manufacturer can hand an official under (F). It does not change the statutory duty and does not narrow it. It says how to discharge that duty in a way that is bounded, auditable, and the same across manufacturers.

## 2. The compliance principle

**A manufacturer subject to 38751 cannot refuse a conforming message it cannot authenticate.** The statute does not condition the two-minute duty on verification, and this profile does not invent a condition. Any profile that told a manufacturer to ignore an unverified message would be advising non-compliance.

What the profile does instead is bound what an unverified message can accomplish:

> **Act within two minutes on every conforming message. Bound the effect by what has been verified.**

Verification does not gate the response. It gates the severity, the area, and the duration. An unverified voice call gets an `AVOID` over a resolved intersection for a short window, applied inside two minutes. A signed notice from a registered issuer gets the full range in 5.3. Both are compliant with 38751(d)(2). Only one can close a district.

## 3. Assurance levels

This profile defines four assurance levels. A receiver MUST determine the level at receipt, MUST record it, and MUST apply the corresponding ceilings in section 4.

| Level | How the message arrived | Verification |
|---|---|---|
| **CA-0 Unverified** | Voice call, SMS, email, web form, or any other channel, with no verification completed | None |
| **CA-1 Callback verified** | Any channel, plus the receiver called the agency back on a number from a published roster and confirmed the request with the person named | 11.6 `CALLBACK_TO_PUBLISHED_NUMBER` |
| **CA-2 Channel authenticated** | A bilaterally provisioned interface established under 228.08(c)(10)(F): mutual TLS, a per-agency API credential, or an equivalent | Channel-level only. Proves the credential, not the message |
| **CA-3 Signed** | A GFN notice with a valid detached JWS under 10.1, chaining to a recognized issuer credential | Message-level. Full 10.1 |

**P-1.** A receiver MUST accept and act on a CA-0 message within two minutes. CA-0 is not a rejection state.

**P-2.** A receiver MUST record the assurance level in the notice's `manual_entry` block, or in `location_resolution` where the message was also resolved, and MUST carry it into the 12 audit record. A message's assurance level is a fact about the message and MUST NOT be upgraded retroactively.

**P-3.** Callback verification (CA-1) MUST use a number from a roster the receiver holds independently, never a number supplied by the caller. This is 11.6 unchanged, and it is the entire security of the voice path.

**P-4.** CA-3 is the target state and the only level at which 5.3's tier ceilings, 5.4's containment, and 10.1's authenticity all function as the specification intends. Sections 3 and 4 exist to make the other three levels survivable, not acceptable.

## 4. Ceilings by assurance level

**P-5.** A receiver MUST apply the stricter of the 5.3 tier ceiling and the following table. Where the assurance level is below CA-3 the issuer's tier cannot be derived from a registry, so the table below is the only ceiling in force.

| | CA-0 Unverified | CA-1 Callback | CA-2 Channel | CA-3 Signed |
|---|---|---|---|---|
| **Maximum level** | `AVOID`, `NO_STOP`, `NO_PUDO` | All, including prohibitive | All | All, per 5.3 |
| **Maximum initial duration** | 1 h | 4 h | 4 h | Per 5.3 |
| **Maximum with extensions** | 4 h | 24 h | 24 h | Per 5.3 |
| **Maximum area** | Resolved zones only, per `LOCATION-RESOLUTION.md` R-6 | 2 km² | 2 km² | Per 5.3 |
| **Issuer-drawn geometry accepted** | No | Yes | Yes | Yes |
| **Human confirmation before applying** | Not required | Required | Not required | Not required |

**P-6.** A CA-0 message MUST NOT carry `PROHIBITED` or `NO_DRIVERLESS`. An official requesting a total closure over an unverified channel gets `AVOID` applied inside two minutes, plus an immediate callback under P-3 to raise it. The vehicle behavior difference between `AVOID` and `PROHIBITED` in the first ninety seconds of an incident is small. The difference in what a forged call can do is the whole point.

**P-7.** Where a requested duration exceeds the ceiling in force, the receiver MUST apply the ceiling, MUST apply the restriction within two minutes, and MUST tell the issuer what window it applied and when the issuer must extend. It MUST NOT reject the message for duration alone. California sets no maximum duration; GFN does. A shorter window plus a renewal prompt is compliant with 38751(d)(2) and safer than either extreme.

**P-8.** All of section 8 of the specification applies unchanged and outranks this profile. No notice at any assurance level induces an unsafe maneuver, suppresses a required yield, or holds a vehicle inside a prohibited zone. Default `on_entry_behavior` remains `EXIT_VIA_NEAREST_SAFE_EGRESS`.

## 5. The two-minute clock

**P-9.** "Receiving," for 228.08(c)(10)(E) and 227.42(f)(3)(F), means the moment the message is first available to the receiver's notice-ingestion path: the call is answered, the message is delivered to the monitored address, or the API call returns 2xx. It is not the moment a human finishes reading it and it is not the moment resolution completes.

**P-10.** The two-minute obligation is discharged by issuing fleet direction, which is 8.4's fleet-notification step, not by every vehicle having left the area. The statute says "issue direction to its fleet," and 8.3's dispersed egress necessarily takes longer than two minutes for a vehicle mid-block. A receiver MUST NOT compress egress to meet a clock that does not apply to egress.

**P-11.** Location resolution, human confirmation under P-5, and callback verification under P-3 all run inside the two minutes or in parallel with a provisional application. Where a receiver cannot both resolve and apply within two minutes, it MUST apply the provisional restriction first at the CA-0 ceiling and refine after.

**P-12.** A rejection under `LOCATION-RESOLUTION.md` R-11 or R-12 stops the clock only once the issuer has it. Per R-14 and Section 9, a rejection MUST reach a human at the issuing agency within the 8.4 budget. A silently dropped ambiguous message is a two-minute violation with no record of why.

## 6. Field mapping

**P-13.** A conforming California implementation maps the statutory and regulatory concepts as follows.

| California | GFN | Notes |
|---|---|---|
| Emergency geofencing message, 227.02(cc) | one notice, `msg_type: NEW` | |
| Emergency response official, 227.02 | `requestor.agency_name`, `requestor.authority_id` where a credential exists | At CA-0 through CA-2 the agency is claimed, not proven. Record it in `requestor.agency_name` and, where the notice is operator-issued from a voice call, follow 11.6: the notice is issued under the operator's own identity with the claimed agency recorded separately |
| Avoidance area, 227.02 | `zones[]` | Resolved per `LOCATION-RESOLUTION.md` where the official supplied a location identifier |
| Location by street address, intersection, coordinates, 227.02(cc) | `zones[].geometry` plus `location_resolution` | See section 7 |
| "Initial duration provided by the emergency response official," 227.02 | `effective_end` | Absolute, per 4.2. Never `duration`, which is drafts-only |
| "Or for an extended duration, when specified," 227.02 | `msg_type: EXTEND` with `original_effective_start` | Cumulative ceiling per 4.3 and P-5 |
| "Leave or avoid," 228.08(c)(10)(E) | `restriction.level` plus `on_entry_behavior` | "Leave" is `EXIT_VIA_NEAREST_SAFE_EGRESS`, the 6.5 default. "Avoid" is the same default with vehicles outside the zone simply not routing in |
| Two minutes from receipt | 8.4 fleet-notification deadline | See section 5 |
| 30 business days to provide interface information, 228.08(c)(10)(F) | this document plus section 8 | |
| First Responder Interaction Plan, 227.42(i) | see section 9 | |

## 7. Location

**P-14.** `LOCATION-RESOLUTION.md` applies in full. California-specific parameters:

- Default radii are the R-5 defaults, unchanged.
- The maximum resolved radius is **150 m**, stricter than R-6's 250 m. A California official who needs more than a 0.07 km² circle is asking for an area, and the correct response is a callback under P-3 and issuer-drawn geometry, not a bigger guess.
- An `AMBIGUOUS_LOCATION` rejection MUST list every candidate. In practice the disambiguating question is one sentence on a phone call the receiver is already making under P-3.

**P-15.** Issuer guidance, to be included in the packet under section 8: **send coordinates when your CAD can produce them.** A latitude and longitude pair skips resolution entirely, removes the ambiguity failure mode, and is the single highest-value thing a dispatch center can change. An intersection is the acceptable fallback. A landmark name is the worst case and should be avoided where an intersection is available.

## 8. What to hand an agency under 228.08(c)(10)(F)

**P-16.** Within 30 business days of notice that an official wishes to begin issuing, a manufacturer MUST provide, at minimum:

1. A monitored voice number and the hours it is staffed, satisfying 227.42(f)(3)(A) and (B).
2. A monitored message address for text or email, with the format this profile expects.
3. The API endpoint, its credential provisioning process, and this profile's version, for agencies able to reach CA-2 or CA-3.
4. The published-number roster process for P-3, so the agency knows which of its numbers the receiver will call back, and how to update it.
5. The resolver identity and version, the default radii, and the 150 m maximum, so the agency knows what a bare address will produce.
6. The acknowledgement format under section 10, and how the agency reads it.
7. A named point of contact for rejections, per P-12.

**P-17.** A manufacturer SHOULD provide the same packet to every agency in its operating area rather than waiting for each to ask. (F) sets a deadline, not a trigger, and an agency that has to ask first will ask during an incident.

## 9. First Responder Interaction Plan

**P-18.** 227.42(i) requires an annually reviewed plan covering remote support roles and contact procedures among other elements. A manufacturer claiming conformance with this profile SHOULD incorporate sections 5, 7, 8 and 10 of it into that plan by reference, so that the plan already on file with the department describes the geofencing interface rather than describing it separately.

This is the fastest available route to making the interface real: the plan is a filing that already exists, is already reviewed annually, and is already updated "based on first responder interactions." Nothing new has to be created for it to carry this content.

## 10. Acknowledgement and record

Neither Article 3.7 nor Article 3.8 requires a manufacturer to log or report the geofencing messages it receives, and 228.24(a) reaches non-compliance only through the general catch-all at (a)(10). The department therefore has authority to act and no way to learn that it should. This section fills that gap voluntarily, and a manufacturer that adopts it is in a materially better position in any enforcement conversation than one that cannot produce a record.

**P-19.** A receiver MUST send an acknowledgement per Section 9 for every geofencing message at any assurance level, to the channel the message arrived on where that channel supports it, and to the section 8 contact otherwise.

**P-20.** The acknowledgement MUST state the assurance level, the geometry actually applied, whether that geometry was resolved or issued, the level and window actually applied, and any ceiling that reduced the request under P-5 or P-7.

**P-21.** Section 9's hygiene rules apply without exception. `exceptions[].detail` MUST NOT carry rider, passenger, trip, or occupancy information. `ack_required` is meaningful only at `priority` 0 and 1, and per-vehicle location is optional above `priority` 1 and MUST NOT be retained past after-action review. A statutory compliance record is not a licence to build a fleet-tracking feed pointed at a public agency, and California's own record-retention exposure makes that worse rather than better.

**P-22.** Records MUST be retained per Section 12. A manufacturer SHOULD be able to produce, on request, every geofencing message received in a period, its assurance level, the action taken, and the elapsed time from receipt to fleet direction.

## 11. What this profile does not claim

Stated plainly, because a profile that oversells itself is worse than none.

- **It does not make an unverified message trustworthy.** It bounds what one can do. A determined caller who reaches the voice line can still cause a small, short `AVOID` around a real intersection, applied for up to an hour. That is the residual risk, and it is deliberate, because the alternative under P-1 is non-compliance.
- **It does not satisfy 5.4 containment below CA-3.** Without a registry there is no registered jurisdiction boundary to contain against. P-5's area ceilings are a substitute for containment, not an implementation of it. This is the strongest single argument for the issuer registry in `REGISTRY-GOVERNANCE.md`.
- **It does not derive tier.** 5.3 is explicit that tier comes from the registry and is never asserted in the message. Below CA-3, tier is unavailable, which is why P-5's table exists at all.
- **It has no legal force.** The department has not adopted it, and the Final Statement of Reasons shows that when the DMV tried to add specificity beyond AB 1777 it was pushed back to the statutory floor. This profile is a voluntary construction that helps a manufacturer discharge a duty it already has.
- **It is untested against a real dispatch center.** Every number in section 4 and every radius in section 7 is a reasoned default, not a measured one. They should survive contact with one large agency before anyone treats them as settled.

## 12. Conformance statement

A manufacturer may claim conformance with this profile if all of the following hold:

1. Every geofencing message at every assurance level is acted on within two minutes of receipt as defined in P-9, and the elapsed time is recorded.
2. Assurance level is determined at receipt, recorded, and never upgraded retroactively.
3. The section 4 ceilings are enforced, and the stricter of those and 5.3 is applied.
4. `LOCATION-RESOLUTION.md` is implemented with the 150 m California maximum, and ambiguous or unresolvable identifiers are rejected rather than guessed, with the rejection reaching a human at the agency.
5. No resolved zone carries a prohibitive level without callback verification.
6. The section 8 packet is available to every emergency response official in the operating area, not only on request.
7. Acknowledgements per section 10 are sent and retained, with Section 9's hygiene rules enforced.
8. Section 8 of the specification outranks every rule in this profile, in the implementation and not only on paper.
