# How a geofence notice is sent and received

**A wire-level walkthrough of GFN v0.1, from the dispatcher pressing Issue to the vehicle changing its route.**

Companion to `GFN-0.1-specification.md`. The specification is the normative reference and wins wherever the two disagree; this document is the narrative an implementer needs on either end of the connection. Section numbers in brackets point back to it.

---

## 1. The actors

```
   ┌──────────────┐                                    ┌──────────────┐
   │   REGISTRY   │  certificates, revocation,         │   REGISTRY   │
   │              │  jurisdiction boundaries, tiers    │              │
   └──────┬───────┘                                    └──────┬───────┘
          │ issues cert                                       │ verifies cert
          ▼                                                   ▼
  ┌───────────────┐        signed notice           ┌────────────────────┐
  │    ISSUER     │ ─────────────────────────────► │     RECEIVER       │
  │ agency CAD or │                                │  AV operator's     │
  │ dispatch      │ ◄───────────────────────────── │  fleet backend     │
  │ console       │        signed acknowledgment  └─────────┬──────────┘
  └───────────────┘                                          │ routing constraint
                                                              ▼
                                                    ┌────────────────────┐
                                                    │      VEHICLES      │
                                                    └────────────────────┘
```

Four parties, three of which have to exist before any of this works. The registry is the one that does not exist yet, and everything about authenticity depends on it [§14].

A **notice** travels issuer to receiver. An **acknowledgment** travels back. Nothing travels from the issuer to a vehicle directly, and nothing in this protocol reaches into a vehicle's controls [§1.2].

---

## 2. Sending

### 2.1 Compose

The issuer builds a JSON object: identity, window, requestor, reason, restriction, zones [§3 to §7]. Everything in it is either operator-visible or public, so the composition step is also the point where the free-text hygiene rules apply [§6.1]. No names, no unit-level addresses, no patient information.

Two fields carry the whole lifecycle and are worth getting right at composition time:

- `notice_id` is minted once and never reused. Its authority slug must equal the final segment of `requestor.authority_id`, which must equal the signing certificate subject [§3.1]. All three are checked.
- `sequence` starts at 1 and increments by exactly 1 for each revision of that `notice_id`.

A live notice must carry an absolute `effective_end`. The `duration` shorthand exists only for drafts and exercises, because a duration-only message restarts its own clock when replayed [§4.1].

### 2.2 Canonicalize

JSON has no canonical byte form on its own: key order, whitespace and number formatting all vary by library, and any of them changes the signature. So before signing, the object is serialized with **RFC 8785 JSON Canonicalization Scheme**, with the `signature` member removed.

```
body        = the notice object with "signature" deleted
payload     = JCS(body)                    # RFC 8785, UTF-8 bytes
```

Two rules that catch people out: JCS sorts object keys by their UTF-16 code units, and it serializes numbers per ECMAScript `Number::toString`. Implement it with a library rather than by hand.

### 2.3 Sign

A **detached JWS** [RFC 7515] over those bytes, using ES256.

```
protected   = BASE64URL({"alg":"ES256","kid":"us-ca-sf-fire-2026-01","x5c":[...]})
signing_in  = ASCII(protected) || "." || BASE64URL(payload)
signature   = BASE64URL(ECDSA_P256_SHA256(signing_in, private_key))
```

The compact serialization is transmitted with the middle segment empty, which is what "detached" means: the payload is the HTTP body, not a copy inside the signature.

```
X-GFN-Signature: eyJhbGciOiJFUzI1NiIsImtpZCI6...  ..  MEUCIQDf8b1c...
                 └─── protected ───┘  └payload┘  └── signature ──┘
                                       (empty)
```

`alg` must be `ES256`. `none` and every HMAC algorithm are rejected outright [§10.1]. The header carries `x5c` with a chain to a registry root, or a `kid` the registry can resolve.

### 2.4 Transmit

```http
POST /gfn/v0.1/notices HTTP/1.1
Host: av-operator.example.com
Content-Type: application/vnd.gfn+json
X-GFN-Signature: eyJhbGciOiJFUzI1NiIsImtpZCI6InVzLWNhLXNmLWZpcmUtMjAyNi0wMSJ9..MEUCIQDf8b1c...
Content-Length: 1284

{"spec_version":"gfn/0.1","notice_id":"urn:gfn:us-ca-sf-fire:2026-0912-0447", ... }
```

TLS 1.3 or better. Signing proves who wrote the message; TLS is what keeps `RESTRICTED` and `PRIVATE` content off the wire in the clear. Both are required, and neither substitutes for the other [§10.4].

The body sent should be the JCS bytes themselves. Re-serializing with a different library between signing and sending is the most common cause of a `BAD_SIGNATURE` on an otherwise correct notice.

### 2.5 Fan out

An issuer publishes to every registered operator in its jurisdiction. There is no broker in v0.1, so fan-out is the issuer's loop, and each operator's response is independent: one rejection does not stop the others.

Operators also **pull**, and must support both:

```http
GET /gfn/v0.1/notices?active_at=2026-09-12T04:47:11Z&bbox=-122.44,37.74,-122.39,37.79
GET /gfn/v0.1/stream          # Server-Sent Events
```

The stream is the fast path and the poll is the truth. A stream that dies silently is the most common way a fleet stops receiving notices with nobody noticing, so a receiver must alarm when a stream goes 120 seconds with neither a message nor a keepalive, and must reconcile against the poll endpoint at least every 5 minutes [§11.1].

Because the same notice can arrive on the stream, on the poll, and again over IPAWS, **delivery is at-least-once and receivers must deduplicate on `(notice_id, sequence)`**. Arrival order is not guaranteed either; `sequence` is what orders them, not receipt time.

---

## 3. Receiving

### 3.1 The gate order, and why it is an order

Each step runs only if the one before it passed. The order is not stylistic: it puts the cheap checks in front of the expensive ones, and it puts the *authenticity* checks in front of everything that would otherwise process attacker-controlled data.

| # | Gate | Rejection code | Why here |
|---|---|---|---|
| 1 | Size and content type | HTTP 413, or `MALFORMED_MESSAGE` | Reject a 50 MB body before parsing it |
| 2 | JSON parse and schema | `MALFORMED_MESSAGE` / `UNSUPPORTED_VERSION` | Never hand unvalidated shapes to the code below |
| 3 | Signature verifies | `BAD_SIGNATURE` | Everything after this treats the content as authentic, so this must come first |
| 4 | Certificate chains to a registry root, is unexpired, is unrevoked | `UNKNOWN_AUTHORITY` | A valid signature from a revoked key is still a rejection |
| 5 | Certificate subject equals `requestor.authority_id` equals the `notice_id` slug | `UNKNOWN_AUTHORITY` | Binds the message to its signer in every downstream log |
| 6 | `issued_at` not more than 300 s ahead, not older than local policy | `EXPIRED` | Clock skew and long-horizon replay |
| 7 | `effective_end` is in the future | `EXPIRED` | The primary anti-replay control; needs no stored state |
| 8 | `sequence` strictly greater than any seen for this `notice_id` | `STALE_SEQUENCE` | Ordering and short-horizon replay |
| 9 | Revision authority: same `notice_id`, same issuer, `references` names itself at a lower sequence | `UNKNOWN_AUTHORITY` | Stops one credential canceling another agency's notice |
| 10 | Geometry: rings closed, non-self-intersecting, holes contained, 512-vertex cap | `MALFORMED_GEOMETRY` | All three make the area computation meaningless, so the tier check below would be meaningless too |
| 11 | Jurisdiction containment | `OUTSIDE_JURISDICTION` | Bounds the blast radius of one compromised credential |
| 12 | Tier ceilings: duration, cumulative duration, area, level | `DURATION_EXCEEDS_TIER`, `AREA_EXCEEDS_TIER`, `LEVEL_NOT_PERMITTED_FOR_TIER` | Depends on geometry being sane, hence after step 10 |
| 13 | Rate thresholds and hard gates | none; flag or hold | Policy, not validity [§10.3] |

Steps 10 and 12 are ordered that way for a specific reason. A self-intersecting ring makes the signed shoelace area cancel, so a figure-eight covering 20 km² can report under 1 km² and sail through a 2 km² ceiling. Validate the shape before you measure it.

### 3.2 What each gate actually does

**Signature (3).** Recompute `JCS(body without signature)`, rebuild the signing input, verify against the public key in `x5c` or resolved from `kid`. Reject `alg` values other than `ES256`.

**Revocation (4), and again later.** Check at receipt, and **check again at `effective_start`** [§10.3]. Without the second check, twenty minutes of key access buys an attacker a year of future-dated notices that all activate on schedule long after the certificate is dead.

**Freshness and expiry (6, 7).** The staleness bound is the receiver's own configuration. `freshness_window` inside the message is an issuer hint and must be clamped: a message cannot be trusted to define the window in which it is acceptable.

**Sequence (8).** Keep a seen-notice cache covering the maximum notice lifetime plus 24 hours. It is defense in depth, not the primary control, because a long-horizon replay will have fallen out of it. Step 7 is what actually stops that one.

**Tier (12).** Tier is derived from the registry entry and the reason code. It is never read from the message [§5.3]. Two duration ceilings apply: this message's window, and `effective_end − original_effective_start` across the whole extension chain.

### 3.3 Applying it

Once a notice passes, the receiver has a routing constraint, not a command. Three things happen, on the clock in [§8.4]:

| Priority | Acknowledge | Routing updated | Vehicles clear of zone |
|---|---|---|---|
| 0 | 15 s | 30 s | 5 min |
| 1 | 60 s | 2 min | 10 min |
| 2 to 4 | 15 min | 15 min | by `effective_start` |

1. **The routing graph is updated.** Edges intersecting the zone are excluded or cost-weighted by `level`. Corridors named in `restriction.corridors` stay traversable at `NO_STOP` regardless of `level`, and a receiver that ignores them silently defeats the incident commander's intent [§8.2].

2. **Vehicles already inside are given an egress.** The default is exit by the shortest lawful path without stopping. Egress must be *dispersed*, not nearest-point: a large zone otherwise converges a whole fleet on the same few perimeter arterials, against a five-minute deadline, on the roads an evacuating public is using [§8.3].

3. **Trips in progress are re-planned** per `occupant_policy`, subject to an accessibility floor: no rider using a mobility device is dropped more than 400 m from their destination without an accessible onward trip at no charge, and no diversion adds to the fare.

Throughout, safety outranks the notice. No notice can cause a stop in a travel lane, a reverse, an illegal turn, a speed far below surrounding traffic, or a suppressed yield [§8.1].

---

## 4. Reaching vehicles

### 4.1 Where the specification stops, and why that is a choice

Everything so far ends at the AV operator's fleet backend. GFN says nothing about how a routing constraint gets from that backend into an individual car, and that silence is deliberate rather than an oversight. Section 4.4 makes the case for it, and Section 4.5 is where it gets genuinely interesting.

### 4.2 The last hop is cellular

In practice the operator reaches its vehicles over LTE or 5G. There is no separate emergency channel and no dedicated spectrum in the loop.

The important part is what that link is **not** doing. The vehicle is not driving on the network. Waymo's position is explicit: "We don't want to have a situation where, say, if the car lost cell connection, it couldn't make a left turn." Maps, perception, planning and routing all run on board. The cellular link carries dispatch, remote assistance, software updates and road-condition data.

A geofence notice is squarely in that last category: a routing constraint pushed down, cached, and acted on locally. Which is why Section 8.5 of the specification reads the way it does. A vehicle that loses its feed keeps honoring every cached notice until `effective_end`, and time authority sits with the backend rather than the car's own clock. Connectivity loss degrades the freshness of what a vehicle knows; it does not strand the vehicle or lift the restriction.

### 4.3 Broadcast: real reach, no accountability

Broadcasting a notice to every vehicle in an area is genuinely attractive, and the specification carries a sketch of it: a compact CBOR profile over C-V2X, small enough for roadside-unit payload budgets, signed with COSE_Sign1 [§11.5]. It is explicitly non-normative and described as "a fast-path hint, not a replacement."

Two things stop it being the primary path today.

**Deployment.** The FCC only finalized C-V2X rules for the 5.9 GHz band effective February 2025, allocating 30 MHz, with the transition deadline in December 2026. The FCC's own reasoning notes that DSRC "failed to take hold and achieve scale in the United States" across more than twenty years. You cannot build an emergency mechanism on roadside units that mostly are not installed.

**A broadcast cannot be acknowledged.** An incident commander who broadcasts learns nothing: not how many automated vehicles are in the zone, not whether any of them moved, not which one is boxed in behind an engine. The signed acknowledgment is the entire feedback loop, and radio has no return path.

So broadcast is not rejected. It is a second channel that adds reach and subtracts accountability, and v0.1 treats it as a hint that a vehicle should confirm over its normal channel.

### 4.4 Why the receiver is the operator and not the vehicle

Seven reasons, roughly in order of how hard they are to design around.

1. **There is no common vehicle-addressable channel.** No standard way exists to reach an arbitrary automated vehicle from outside its own manufacturer's systems. Direct addressing would mean building a national radio network first. The operator's backend already reaches every vehicle it runs, today, over infrastructure that already exists.

2. **Verification has to live somewhere patchable.** The thirteen gates in Section 3 include certificate chain validation, revocation lookup, jurisdictional containment and tier ceilings. Replicating that across a hundred thousand embedded endpoints means a hundred thousand copies of a security-critical verifier on hardware that updates slowly. One well-maintained verifier at the backend is a smaller attack surface and a faster fix when something is wrong.

3. **Dispersed egress is only possible above the vehicle.** Section 8.3 of the specification requires that vehicles leaving a zone spread across available exits rather than each independently minimizing its own distance. A vehicle acting alone on a broadcast cannot do this: it has no idea what the others are doing, so it necessarily runs the nearest-point algorithm. A pure broadcast design converges a whole fleet on the same two perimeter arterials against a five-minute deadline, on the roads an evacuating public is using. Coordination requires a coordinator.

4. **Somebody has to answer the question.** "How many of your vehicles are in my zone and when will they be out." A vehicle cannot answer for a fleet. The acknowledgment, the exception report for a boxed-in vehicle, and the 24/7 hotline all require one accountable party per operator.

5. **Direct addressing would require knowing where the vehicles are.** To send to specific vehicles, an issuer needs a live registry of vehicle positions. Section 9 already treats the acknowledgment as a surveillance channel to be bounded; a per-vehicle addressing scheme would be a far larger one, held by government, continuously.

6. **The backend holds context the notice does not.** Which trips are in progress, which rider needs an accessible drop-off, which vehicles are supervised and which are driverless, how much remote-operator capacity is staffed right now. Applying `occupant_policy` correctly is impossible without it.

7. **The law puts the duty there.** H.R. 10033 places the obligation to comply with geofence notices and maintain the hotline on the "covered entity," not on the vehicle.

None of this argues against broadcasting as well. It argues that the accountable path and the wide-reach path are different paths, and v0.1 specifies the accountable one properly and the wide-reach one thinly.

### 4.5 Human drivers should get these too

An automated vehicle is not the only thing that should stay out of a fire ground. The specification already says so in passing: "Issuers SHOULD use `PUBLIC` where possible. Most restrictions benefit from every driver knowing, not just automated ones" [§10.4].

The route to a human driver is their navigation app, and that route already exists. Agencies publish closures and work zones, and Google Maps, Waze, Apple Maps and TomTom ingest them. The USDOT **Work Zone Data Exchange** is the standard shape for it: an agency publishes a GeoJSON feed, aggregators pick it up, drivers see it. Waze for Cities and Esri's road-closure sharing are the same idea by other routes.

A `PUBLIC` geofence notice is structurally the same object as a WZDx road event. Same geometry, same start and end, same reason, same issuing authority. The mapping is close to mechanical, and Section 14 of the specification already carries linear referencing borrowed from WZDx as a v0.2 item.

So the honest position for v0.1: **the consumer-navigation binding is missing, it should exist, and it is the cheapest large win available.** Two caveats that shape it rather than block it.

- **Only `PUBLIC` scope may go this way.** A live police perimeter published to every navigation app is a map of where the police are. The scope field already gates this correctly [§10.4].
- **Advisory, not compliance.** A navigation app can route a human around a closure. It cannot make them comply, cannot acknowledge, and is not an accountable party. That is fine: it is a different job. Telling ten thousand drivers to avoid a block is worth doing even though none of them will send an acknowledgment.

One honest note on the state of the art: the case study literature reports that the WZDx feed "is not widely used by automotive or navigation entities, yet." The pathway is real and the standard exists; adoption is uneven. Publishing into it is still the right move, because the alternative is a bespoke arrangement with each map provider, which is exactly the failure this whole specification exists to avoid.

### 4.6 Privately owned automated vehicles

The model assumes a fleet. Increasingly there will not be one: privately owned vehicles with conditional and high automation are already sold.

**The model still holds, because the duty follows the manufacturer.** H.R. 10033 defines a covered entity as "a manufacturer or operator that manufactures for sale, sells, offers for sale, introduces or delivers for introduction in interstate commerce, imports into the United States, or operates a covered vehicle," and a covered vehicle as "a vehicle with an Automated Driving System." The manufacturer is a covered entity by virtue of selling one.

So for a privately owned automated vehicle, the receiver in Section 3 is **the manufacturer's connected-vehicle backend**, not the owner. That backend already exists, already reaches every car the manufacturer sold, and already pushes map and software updates down the same cellular link. Read "operator" throughout this document as "the covered entity that runs the automated driving system's backend": a robotaxi company for a robotaxi, a carmaker for a privately owned car.

Four things genuinely break, and none of them are addressed in v0.1.

1. **Connectivity becomes optional.** A fleet operator cannot turn off its own vehicles' connectivity; it is the business. A private owner can, and some will. A vehicle that has never received a notice cannot honor one, and nothing in the design detects that.

2. **`occupant_policy` assumes a dispatched trip.** "Complete the trip at a safe drop-off outside the zone" and "relocate and rebook at no charge" are ride-hail concepts. In a private car the occupant owns the vehicle and is driving home. The equivalent obligation is not a rebooking, it is telling them clearly why the route changed.

3. **A supervised private vehicle has a licensed human in the seat.** For `ADS_DRIVERLESS` a silent reroute is right, because there is nobody to tell. For a privately owned conditional-automation vehicle the correct response is arguably to inform the driver and hand back control, not to quietly steer around something. GFN's `applies_to` already separates `ADS_DRIVERLESS` from `ADS_SUPERVISED`, but Section 8.2 defines no distinct behavior for the supervised case, and it should.

4. **Enforcement does not scale.** You can audit one operator's compliance records. You cannot audit two hundred thousand owners. This is an argument for keeping the duty on the manufacturer rather than the owner, and for the audit obligations in Section 12 sitting where the records actually are.

There is also the orphan case: a retrofit or aftermarket automation system, or a vehicle whose manufacturer has left the business. Nobody holds the duty, and nobody runs a backend. v0.1 has no answer.

---

## 5. Acknowledging

The acknowledgment goes back to the issuer, **signed with the operator's own key**:

```http
POST /gfn/v0.1/notices/urn%3Agfn%3Aus-ca-sf-fire%3A2026-0912-0447/ack HTTP/1.1
Content-Type: application/vnd.gfn+json
```

```json
{
  "spec_version": "gfn/0.1",
  "type": "ACK",
  "notice_id": "urn:gfn:us-ca-sf-fire:2026-0912-0447",
  "sequence": 1,
  "operator_id": "urn:gfn:operator:example-av",
  "received_at": "2026-09-12T04:47:19Z",
  "disposition": "ACCEPTED_WITH_EXCEPTIONS",
  "vehicles_in_zone_at_receipt": 3,
  "routing_updated_at": "2026-09-12T04:47:34Z",
  "estimated_clear_at": "2026-09-12T04:51:00Z",
  "exceptions": [
    {
      "vehicle_id": "AV-4471",
      "reason": "PHYSICALLY_BLOCKED",
      "detail": "Boxed in on Valencia St by parked apparatus. Vehicle is empty and awaiting a tow.",
      "expected_clear_at": "2026-09-12T05:30:00Z"
    }
  ],
  "signature": { "protected": "...", "signature": "..." }
}
```

The reverse channel needs authentication as much as the forward one. A forged `ACCEPTED` with zero vehicles tells an incident commander the fire ground is clear when it is not, which is a safety claim someone will act on [§9].

Three rules that are easy to miss:

- `disposition: ACCEPTED` means **no** exceptions. An acceptance carrying exceptions is schema-invalid, so non-compliant vehicles cannot hide in a field the issuer's dashboard reads as clean.
- `exceptions[].detail` must carry no rider, trip, passenger or occupancy information. It flows from a commercial operator to a public agency and into a three-year retained record on both sides.
- Acknowledgments are also a surveillance channel. `ack_required` is meaningful only at priority 0 and 1, per-vehicle location may be omitted above priority 1, and issuers must not retain it past the after-action review.

**A rejection is not a refusal to cooperate.** It is a machine-readable "this message is wrong, here is why," and it must reach a human at both ends inside the latency budget. The issuer's response to a rejection is a phone call to the operator hotline, not a retry loop.

---

## 6. Changing or ending a notice

| Operation | `msg_type` | `sequence` | Carries | Effect |
|---|---|---|---|---|
| First issue | `NEW` | 1 | signature | Restriction begins at `effective_start` |
| Revise zone, level, text | `UPDATE` | +1 | `references`, `original_effective_start`, signature | Replaces the prior revision |
| Add time | `EXTEND` | +1 | `references`, `original_effective_start`, signature | New window measured from now |
| End early | `CANCEL` | +1 | `references`, `original_effective_start`, signature | Effective on receipt |
| Expiry | none | none | nothing | Restriction lifts on its own |

Every one of these except expiry must be signed, regardless of `status`. Cancellation is the operation that *removes* a safety restriction, so an unsigned `CANCEL` accepted on a lifecycle code path is a total compromise for the cost of one HTTP request [§3.1].

**`EXTEND` opens a fresh window from now.** Growing `effective_end` while leaving `effective_start` alone breaches the per-message ceiling, which is the whole point of having two ceilings. `original_effective_start` rides along so the cumulative bound can be enforced from the message in hand, without the receiver reconstructing the notice's history [§4.3].

**Expiry sends nothing.** The receiver releases the restriction at `effective_end` whether or not it hears anything further, and must never extend one on its own initiative. This is the property that makes the whole design safe to hand to a tired incident commander: forgetting cannot leave a neighborhood restricted [§4.2].

**Re-issuing after a cancel mints a new `notice_id`.** Reusing one puts a second notice at sequence 1 under a key receivers have already processed, and every conforming receiver discards it.

---

## 7. The IPAWS and CAP 1.2 path

### 6.1 Why this path exists

A large operator will take a direct HTTPS connection. A city of forty thousand will not stand up an API for three robotaxi companies, and neither will its fire department.

What that city may already have is an IPAWS alerting authority: a credential, a piece of alerting software, and an emergency manager trained to use it. The IPAWS binding exists so that agency can reach AV operators through the tool it already owns, rather than through an integration nobody will build.

That is the promise. Section 7.6 is the part that limits it, and it limits it more than the specification originally admitted.

### 6.2 The actors

**CAP**, the Common Alerting Protocol, is an OASIS XML standard for emergency messages. It is the lingua franca of public alerting: one message, many delivery channels.

**IPAWS**, the Integrated Public Alert and Warning System, is FEMA's national alert aggregator. Its server side is **IPAWS-OPEN**, which "receives and authenticates messages from federal, state, local, tribal, and territorial emergency management officials and routes them to IPAWS-compliant public alerting systems."

```
  ┌──────────────┐   CAP 1.2    ┌──────────────┐              ┌──────────────────┐
  │  ALERTING    │  over HTTPS  │              │─────────────►│ EAS broadcasters │
  │  AUTHORITY   │─────────────►│  IPAWS-OPEN  │─────────────►│ WEA carriers     │
  │              │              │              │─────────────►│ NOAA / HazCollect│
  │ agency's COG │              │ authenticates│─────────────►│ All-Hazards Feed │
  │ + AOT        │              │ and routes   │              └────────┬─────────┘
  └──────────────┘              └──────────────┘                       │
                                                                        ▼
                                                              ┌──────────────────┐
                                                              │  AV OPERATOR     │
                                                              │  as a subscriber │
                                                              └──────────────────┘
```

- A **COG**, Collaborative Operating Group, is the unit of identity in IPAWS. An agency gets a COG ID, and its alerts are attributed to it.
- An **AOT**, alert origination tool, is the commercial software that composes CAP and submits it. Agencies buy one; FEMA does not supply it.
- The **All-Hazards Information Feed** is how a non-government organization *receives* from IPAWS. It is a subscriber feed of CAP messages, "digitally signed by the alerting authority to ensure authenticity."

### 6.3 What it takes to originate

Concrete, because "the agency already has IPAWS" is doing a lot of work in Section 7.1 and is often untrue:

1. **Training.** IS-247, *IPAWS for Alert Originators*, about two hours. A prerequisite for full IPAWS-OPEN access. IS-251 for administrators is optional.
2. **Software.** An IPAWS-compatible AOT, procured by the agency. IPAWS access is free; the tool is not.
3. **A Memorandum of Agreement** with the IPAWS Office, submitted through the IPAWS User Portal. The executed MOA comes back with **a digital certificate** used to configure the software.
4. **A public alerting plan**, defining alert types and geographic coverage, which "must be reviewed and signed by a designated state official or tribal leadership."
5. **Monthly proficiency.** Authorities demonstrate proficiency by sending a monthly test through the IPAWS training environment. **Miss three consecutive months and production access is withdrawn.**

That last point is worth planning around. An agency that adopts geofence notices through IPAWS and then does not otherwise use IPAWS will quietly lose the channel in a quarter.

To *receive*, an AV operator registers on the IPAWS User Portal and executes its own MOA. Alerts may be redistributed to the intended audience but not used for marketing, and only FEMA-authorized public safety agencies may originate.

### 6.4 What travels

The complete signed GFN notice rides base64url-encoded in a CAP parameter, with the CAP elements around it populated so a CAP-only consumer still gets something usable:

```xml
<parameter>
  <valueName>GFN-payload</valueName>
  <value>eyJzcGVjX3ZlcnNpb24iOiJnZm4vMC4xIiwibm90aWNlX2lkIjoi...</value>
</parameter>
<parameter>
  <valueName>GFN-payload-alg</valueName>
  <value>ES256</value>
</parameter>
```

**A receiver that sees `GFN-payload` must decode and verify that payload and treat it as authoritative.** Everything else in the XML is a lossy rendering. Geometry precision, restriction nuance and the agency's own signature all live in the payload, and the thirteen gates in Section 3 run against the payload, not against the CAP.

Note there are now **two** authentication layers doing different jobs. IPAWS-OPEN authenticates the *submission* using the agency's IPAWS certificate: it proves the message came from that COG. The GFN signature inside `GFN-payload` proves the *notice* came from that agency and has not been altered since. A gateway cannot strip or re-sign the payload without breaking it, which is the point.

### 6.5 What the IPAWS profile requires

The IPAWS CAP Profile v1.0 tightens base CAP. Five of its rules bite a geofence notice directly:

| Profile rule | Effect on a GFN notice |
|---|---|
| `code` SHALL include `IPAWSv1.0` | Emit alongside `GFNv0.1` |
| `expires` is REQUIRED | Satisfied automatically. Every GFN notice has an absolute `effective_end` |
| At least one `area` block MUST be present | Satisfied. Every notice has at least one zone |
| `eventCode` with `valueName` `SAME` REQUIRED for EAS, CMAS and HazCollect | Only matters if you route there, which Section 7.8 says not to |
| **`effective` and `onset` are ignored. "Alerts SHALL be effective upon issuance."** | **A scheduled notice cannot be scheduled through IPAWS** |

That last row is the one that surprises people. A Tier 3 utility notice with a twelve-hour lead time, or any Tier 2 or 4 notice with a required lead, cannot be pre-published over IPAWS and expected to activate later. A gateway must **hold the message and submit it at `effective_start`**, or publish immediately and accept that the restriction begins now.

One more, easy to miss: for `Update` and `Cancel`, the profile requires that **all** related messages that have not yet expired be referenced, not just the immediately prior one. GFN's `references` carries the prior sequence only, so a gateway must expand it to every unexpired revision of that `notice_id` and retain each one's `sent` timestamp to build the `sender,identifier,sent` triples.

### 6.6 The limitation the specification understated

**The All-Hazards Information Feed carries public alerts.** It is the feed of what went to the public.

So the honest position, corrected from the specification's earlier framing:

| GFN `scope` | Can it reach AV operators over IPAWS? |
|---|---|
| `PUBLIC` | Yes, through the All-Hazards Information Feed |
| `RESTRICTED` | Not through the public feed. Would require COG-to-COG, which requires the operator to hold a COG |
| `PRIVATE` | No. Use the direct channel only |

This matters most for exactly the notices you would least want mishandled. A live police perimeter or a protective movement is `RESTRICTED` or `PRIVATE` by rule [§10.4], so **the IPAWS path is unavailable for them and the direct channel is the only option.** An agency whose sole route to operators is IPAWS can issue a fire-ground closure that way, and cannot issue an `ACTIVE_THREAT` perimeter that way.

There is a second, sharper reason not to try. `reason.internal_text` sits inside the signed body, so a gateway cannot strip it to widen distribution without invalidating the signature. Anything placed in `internal_text` on a message that touches a broadcast path reaches everyone on that path. The operational rule stands: **do not put anything in `internal_text` that would harm the operation if the whole path saw it**, and send genuinely sensitive notices `DIRECT_API` only.

### 6.7 The three encoding mistakes

1. **Coordinate order reverses.** GeoJSON is `[longitude, latitude]`. CAP `<polygon>` is `latitude,longitude`, space-delimited, ring closed. Getting it backward moves a San Francisco geofence into the Southern Ocean. `examples/invalid/92-swapped-coordinates.json` is the regression test.

   ```
   GeoJSON:  [-122.4221, 37.7615]
   CAP:       37.7615,-122.4221
   ```

2. **The `Z` designator is illegal in CAP.** Times are `YYYY-MM-DDThh:mm:ss±hh:mm`, and UTC is written `-00:00`, never `Z`.

   ```
   GFN:  2026-09-12T04:47:11Z
   CAP:  2026-09-12T04:47:11-00:00
   ```

3. **A buffered `LineString` has no native CAP form.** CAP offers `<polygon>` and `<circle>` only. The gateway must compute the buffer polygon itself and emit that. Skip it and the most common corridor notice, the shape Section 7.3 of the specification recommends for parades, motorcades and evacuation routes, arrives at a CAP-only consumer with no geometry at all. A `Point` plus `buffer_m` does have a native form and maps to `<circle>lat,lon radius_km</circle>`.

### 6.8 Do not route these to EAS or WEA

EAS and WEA reach millions of broadcast receivers and phones. Alert fatigue is a measured public safety harm, and a message telling robotaxis to avoid two blocks is not a public emergency.

They are appropriate only when the notice is already a public emergency in its own right: an evacuation order, a wildfire perimeter, a tsunami zone, a shelter-in-place. In those cases the AV geofence is a footnote to an alert the public needs anyway.

If you do route there: WEA's `CMAMtext` is capped at 90 English characters, which leaves no room for GFN detail, so the AV-specific instruction stays on the direct and IPAWS channels. And neither EAS nor WEA may be a notice's **only** channel: neither delivers to fleet systems reliably, and neither supports acknowledgment, so an issuer using them alone learns nothing about whether any vehicle moved [§11.4].

### 6.9 Choosing a path

| Situation | Path |
|---|---|
| Operator has a direct integration | `DIRECT_API`. Fastest, and the only one with real acknowledgment |
| Small agency, public-scope notice, no direct integration | IPAWS, `scope: PUBLIC` |
| Restricted or private notice | `DIRECT_API` only. IPAWS cannot carry it to operators |
| Notice with a lead time | `DIRECT_API`, or hold the IPAWS submission until `effective_start` |
| Already issuing a public evacuation or wildfire alert | IPAWS, and EAS or WEA alongside it, never instead of it |
| Alerting tool is down at 03:00 | The manual path, below |

---

## 8. The manual path

Every issuer needs a route that works when the alerting tool is down: a phone call to the AV operator's hotline. H.R. 10033 would require that hotline to be answered within 30 seconds.

A transcribed notice is issued **under the operator's own identity**, not the caller's. It carries `requestor.authority_id` and `notice_id` in the operator's namespace, so the binding rules in Section 3 hold unchanged, and it records the claimed originating agency in `requestor.agency_name` plus a `manual_entry` block naming who took the call, when, and how the caller was verified. An operator-issued notice is never mistaken for an agency-signed one, in the register or anywhere else.

That distinction matters because this is the only path with no cryptography, which makes it the obvious social-engineering target: phone the hotline at 03:00, claim to be the fire department, ask for a city block closed.

So `manual_entry.verification_method` MUST be `CALLBACK_TO_PUBLISHED_NUMBER` for any manual notice at priority 0 or 1, or at a prohibitive level. The operator hangs up and calls the agency back on a number from the registry, not a number the caller supplied. Ninety seconds, and it is the entire security of this channel [§11.6].

---

## 9. When things go wrong

| Failure | What the receiver does |
|---|---|
| Stream dies silently | Alarm after 120 s without a message or keepalive; reconcile against the poll endpoint |
| Network partition | Keep honoring every cached notice until its `effective_end`. Fail closed on the restriction |
| Cached notice past `freshness_window` | Stays in force. The bounded downside is a slightly over-long restriction; the alternative is a vehicle driving into a fire |
| Cannot verify a `CANCEL` | Contact the issuer hotline rather than extending indefinitely. The notice still expires on schedule |
| Vehicle clock disagrees with the backend by >60 s | Use the backend's time and flag it. Never let a spoofed local clock stop a vehicle from accepting notices, or GNSS spoofing becomes a fleet-disable primitive |
| Notice arrives out of order | `sequence` orders them, not arrival time. Discard anything at or below the highest seen |
| Same notice arrives twice | Deduplicate on `(notice_id, sequence)`. Delivery is at-least-once |
| Rate threshold breached | Accept, apply, flag, page a human. Rate limiting a real emergency is worse than the abuse it prevents |
| Hard gate breached | Hold until a named human confirms. No automatic approval on timeout |

---

## 10. A complete exchange

A structure fire on Valencia Street, priority 0, from the reference example.

```
04:47:11.0  ISSUER    Dispatcher finishes the zone and presses Issue.
04:47:11.1  ISSUER    JCS-serialize, ES256-sign, POST to three operators.
04:47:11.4  RECEIVER  200 OK. Gates 1 to 13 pass in about 40 ms.
04:47:19.0  RECEIVER  POST ack: ACCEPTED_WITH_EXCEPTIONS, 3 vehicles in zone.
                      Inside the 15 s budget for priority 0.
04:47:34.0  RECEIVER  Routing graph updated. No new vehicle enters.
                      Inside the 30 s budget.
04:47:36.0  VEHICLES  Two vehicles inside compute dispersed egress and drive out
                      without stopping. AV-4471 is boxed in by apparatus.
04:50:12.0  RECEIVER  Two clear. AV-4471 reported by exception on the hotline.
                      Inside the 5 min budget.
06:31:02.0  ISSUER    Fire under control. CANCEL at sequence 2, signed,
                      references sequence 1, carries original_effective_start.
06:31:02.3  RECEIVER  Restriction released. Routing restored.

            (had nobody sent the CANCEL, the restriction would have released
             itself at 08:47:11 with no message from anyone)
```

---

## 11. Implementation checklist

**Issuer**

- [ ] RFC 8785 canonicalization from a library, not by hand
- [ ] ES256 detached JWS; never emit `alg: none`
- [ ] `notice_id` slug, `authority_id` and certificate subject all agree
- [ ] Absolute `effective_end` on every live notice
- [ ] `references` and `original_effective_start` on every revision
- [ ] Sign `UPDATE`, `EXTEND` and `CANCEL` regardless of `status`
- [ ] Mint a new `notice_id` for a new incident; never reuse one
- [ ] Free text clean of the content in §6.1
- [ ] A staffed E.164 callback number
- [ ] Send `CANCEL` when the scene clears rather than running to expiry
- [ ] Retain the signed notice, issuer identity, incident number and every ack for three years

**Receiver**

- [ ] All thirteen gates, in that order
- [ ] Re-check revocation at `effective_start`, not only on receipt
- [ ] Deduplicate on `(notice_id, sequence)`; order by sequence, not arrival
- [ ] Stream plus poll, with a 120 s keepalive alarm and 5-minute reconciliation
- [ ] Honor `corridors` as `NO_STOP` regardless of `level`
- [ ] Dispersed egress, and the accessibility floor on diverted trips
- [ ] Never induce an unsafe maneuver, including a suppressed yield
- [ ] Release at `effective_end` with no further instruction
- [ ] Honor cached notices through connectivity loss; take time from the backend
- [ ] Signed acknowledgments, and machine-readable rejections that reach a human
- [ ] Retain notices, verification results, clear times and diverted trips for three years

`validate.py` in this repository covers the schema, the geometry rules, the tier ceilings and the free-text checks. It does **not** cover signature verification, revocation, jurisdiction containment or any cross-message state, all of which need a registry. Treat it as a partial reference, not a conformance suite.

---

## 12. Glossary

Expanded here because this document is meant to be readable on its own. The specification's Appendix A is the fuller list.

**The pieces of a message**

| Term | Meaning |
|---|---|
| **Notice** | One signed geofence message, identified for life by `notice_id` plus `sequence`. |
| **Issuer** | The agency that composes and signs it. |
| **Receiver** | The covered entity running the driving system's backend: a fleet operator for a robotaxi, a manufacturer for a privately owned car. |
| **Zone** | One restricted area. A notice may carry several. |
| **Level** | What vehicles must do inside, from `PROHIBITED` down to `NO_PUDO`. |
| **Tier** | The issuer's authority class, derived from the registry, never asserted in the message. |
| **Corridor** | A street kept open through a zone, treated as `NO_STOP` whatever the level. |
| **Detached signature** | A signature sent separately from the bytes it covers. The payload is the HTTP body, not a copy inside the signature. |

**Signing and transport**

| Term | Expansion |
|---|---|
| **CBOR** | Concise Binary Object Representation (RFC 8949). Compact binary encoding, used in the C-V2X sketch. |
| **COSE** | CBOR Object Signing and Encryption (RFC 9052). The CBOR-native equivalent of JWS. |
| **CRL / OCSP** | Certificate Revocation List / Online Certificate Status Protocol. The two ways to ask whether a certificate is still valid. |
| **ECDSA** | Elliptic Curve Digital Signature Algorithm. |
| **ES256** | ECDSA with curve P-256 and SHA-256. The only signature algorithm permitted here. |
| **E.164** | ITU phone number format: leading plus, country code, digits, nothing else. |
| **GeoJSON** | RFC 7946. Geospatial JSON. Coordinates are `[longitude, latitude]`. |
| **HMAC** | Hash-based Message Authentication Code. Symmetric, so it cannot prove which party signed. Rejected here. |
| **JCS** | JSON Canonicalization Scheme (RFC 8785). One deterministic byte sequence per JSON object, so a signature over it is reproducible. |
| **JOSE / JWS** | JSON Object Signing and Encryption, and JSON Web Signature (RFC 7515), the member of that family used here. |
| **SSE** | Server-Sent Events. The one-way streaming transport for the notice feed. |
| **TLS** | Transport Layer Security. 1.3 or better for anything not public. |
| **URN** | Uniform Resource Name. The identifier form for `notice_id` and `authority_id`. |
| **UTC** | Coordinated Universal Time. Timestamps here end in `Z`; CAP writes the same instant as `-00:00`. |
| **WGS 84 / EPSG:4326** | The geodetic datum GPS uses, and its coordinate-system identifier. All coordinates here are in it. |

**Alerting and public safety**

| Term | Expansion |
|---|---|
| **ADS** | Automated Driving System. The precise term for what "AV" means loosely. |
| **AOT** | Alert Origination Tool. Commercial software an agency uses to submit CAP into IPAWS. |
| **CAD** | Computer-Aided Dispatch. The agency's incident system, and the source of `incident_number`. |
| **CAP** | Common Alerting Protocol. OASIS XML standard for emergency messages, version 1.2 here. |
| **CMAS** | Commercial Mobile Alert Service. WEA's former name, still used by the IPAWS profile. |
| **COG** | Collaborative Operating Group. The unit of identity in IPAWS. |
| **EAS** | Emergency Alert System. The broadcast channel. |
| **FEMA / FCC / NHTSA / USDOT** | Federal Emergency Management Agency, Federal Communications Commission, National Highway Traffic Safety Administration, United States Department of Transportation. |
| **FIPS** | Federal Information Processing Standards. Here the six-digit county code, which doubles as the SAME location code. |
| **GNSS** | Global Navigation Satellite System. GPS and equivalents. Its time signal is spoofable, which Section 9 accounts for. |
| **H.R. 10033** | The AV Emergency Response Coordination Act, introduced 3 August 2026. Would authorize geofence notices and a 24/7 operator hotline. Not passed. |
| **IPAWS** | Integrated Public Alert and Warning System. FEMA's national alert aggregator. |
| **IPAWS-OPEN** | IPAWS Open Platform for Emergency Networks. The server side that authenticates and routes. |
| **IS-247 / IS-251** | FEMA study courses for alert originators and alerting administrators. IS-247 is a prerequisite for full IPAWS-OPEN access. |
| **MOA** | Memorandum of Agreement. Required with the IPAWS Office to originate or receive; returns a digital certificate. |
| **OASIS** | Organization for the Advancement of Structured Information Standards. Publishes CAP. |
| **SAME** | Specific Area Message Encoding. The EAS scheme supplying CAP's location and event codes. |
| **WEA** | Wireless Emergency Alerts. Cell broadcast to phones. Its `CMAMtext` is capped at 90 English characters. |

**Vehicles and roads**

| Term | Expansion |
|---|---|
| **C-V2X** | Cellular Vehicle-to-Everything. Short-range radio in the 5.9 GHz band. |
| **DSRC** | Dedicated Short-Range Communications. The older 5.9 GHz standard C-V2X replaces, which the FCC noted never reached scale. |
| **LTE / 5G** | Cellular generations. What an operator's backend actually uses to reach its vehicles. |
| **MAP / TIM** | V2X message types (SAE J2735): intersection geometry, and Traveler Information Message. Cited only for payload size. |
| **UAS** | Uncrewed Aircraft System. A drone. |
| **WZDx** | Work Zone Data Exchange. USDOT standard by which agencies publish road events as a GeoJSON feed that Google Maps, Waze, Apple Maps and TomTom consume. The model for reaching human drivers (Section 4.5). |

---

## Sources

The IPAWS facts in Section 7 come from FEMA and OASIS, not from inference:

- [IPAWS-OPEN, FEMA](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers/ipaws-open)
- [IPAWS All-Hazards Information Feed, FEMA](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers/all-hazards-information-feed)
- [Sign up to use IPAWS, FEMA](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/sign-up)
- [Alerting Authorities, FEMA](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/alerting-authorities)
- [CAP v1.2 USA IPAWS Profile v1.0, OASIS](https://docs.oasis-open.org/emergency/cap/v1.2/ipaws-profile/v1.0/cap-v1.2-ipaws-profile-v1.0.html)
- [Common Alerting Protocol v1.2, OASIS](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html)

---

## See also

- `GFN-0.1-specification.md`: the normative specification
- `schema/geofence-notice.schema.json`: notice schema, JSON Schema 2020-12
- `schema/acknowledgment.schema.json`: acknowledgment schema
- `examples/`: worked notices, an acknowledgment, and a CAP 1.2 rendering
- `examples/invalid/`: one rejection per failure mode, each a regression test
- `demo/dispatcher-console.html`: the issuing side, working
- `SECURITY-REVIEW.md`: why several of these rules exist
