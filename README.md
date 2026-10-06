# Geofence Notice Specification (GFN) v0.1

A signed, time-bounded, machine-readable instruction from a public authority telling automated vehicle fleets to restrict operation inside a defined area.

Designed so one notice can be authored once and delivered over a direct API, IPAWS/CAP 1.2, C-V2X broadcast, or a phone call, without re-authoring.

**Repository:** <https://github.com/The-Center-for-Auto-Safety/Geo-Fence-Notification>, maintained by the Center for Auto Safety.

**Live system demo:** <https://autosafety.org/geo-fence/system-demo.html>. An end-to-end model of the issuing system: the console, the gateway checks and signature, operator delivery, and the append-only record. It runs in exercise mode and nothing in it reaches an operator.

## Files

| Path | What it is |
|---|---|
| `GFN-0.1-specification.md` | The specification. Start here. |
| `schema/geofence-notice.schema.json` | JSON Schema 2020-12 for a notice. |
| `schema/acknowledgement.schema.json` | JSON Schema 2020-12 for an operator acknowledgement. |
| `examples/01-structure-fire.json` | Tier 1 fire department, `PROHIBITED`, immediate, 4 hours. |
| `examples/02-crime-scene-restricted.json` | Tier 1 police, `RESTRICTED` scope, open corridor. |
| `examples/03-flooding-avoid.json` | Tier 1W county EOC, `AVOID`, multi-zone, an `UPDATE` at sequence 3. |
| `examples/04-vip-movement-private.json` | Tier 2 federal, `PRIVATE` scope, `NO_STOP` corridor, exempt operator. |
| `examples/05-utility-outage-no-driverless.json` | Tier 3 utility, `NO_DRIVERLESS`, planned with lead time. |
| `examples/06-cancel.json` | `CANCEL` at sequence 2, ending example 01 early. |
| `examples/07-acknowledgement.json` | Operator ack with an exception for a boxed-in vehicle. |
| `examples/08-structure-fire-cap-1.2.xml` | Example 01 rendered as CAP 1.2 for IPAWS. |
| `examples/invalid/91` … `/102` | Notices that MUST be rejected, one per failure mode: duration over ceiling, swapped coordinates, level not permitted for tier, unsigned live notice, cross-authority cancel, extend loop past the cumulative ceiling, hole outside its exterior ring, self-intersecting figure-eight, buffer on a polygon, resolved buffer over the 250 m ceiling, a prohibitive level on synthesized geometry without callback verification, and a multi-candidate location the resolver picked by rank. |
| `examples/09-resolved-intersection.json` | A zone the gateway synthesized from "Valencia and 19th" rather than one the issuer drew, with the `location_resolution` audit block that makes that visible. |
| `MESSAGE-FLOW.md` | How a message is sent and received: canonicalization, signing, the thirteen receive gates in order, how a notice actually reaches a vehicle, acknowledgement, the lifecycle messages, the IPAWS path, and the failure modes. Start here to implement either end. |
| `SECURITY-REVIEW.md` | Adversarial review of the draft, with the disposition of every finding. |
| `REGISTRY-GOVERNANCE.md` | Resolves Section 14 item 1. The five jobs the registry actually does, why it is two registries rather than one, five governance models scored against the same criteria, a recommendation with recorded dissent, and a four-lane adoption path that does not wait on federal rulemaking. |
| `LOCATION-RESOLUTION.md` | Normative draft of Section 7.4. How a street address or intersection becomes a bounded, contained, auditable zone, and why a receiver must reject an ambiguous one rather than geocode it. |
| `PROFILE-CALIFORNIA.md` | Binding to Cal. Veh. Code 38751 and 13 CCR Articles 3.7 and 3.8. Four assurance levels, ceilings for each, the two-minute clock, and what a manufacturer hands an agency under 228.08(c)(10)(F). |
| Glossary | Appendix A of the specification defines every acronym and term of art. `MESSAGE-FLOW.md` carries its own, and `EXECUTIVE-SUMMARY.md` a plain-language one for a command audience. |
| `validate.py` | Validates every example against the schema plus the semantic rules the schema cannot express. |
| `demo/dispatcher-console.html` | A working demonstration console: a fire department draws a geofence, issues it, and a simulated automated vehicle fleet clears the zone. Open it in a browser, no build step and no network needed. |

## Running the validator

```
pip install jsonschema --break-system-packages
python3 validate.py
```

Files under `examples/invalid/` are expected to fail. Everything else is expected to pass. Exit code is 0 when every example behaves as its location declares.

The validator covers what JSON Schema cannot: tier ceilings on duration, area and restriction level; ring closure and self-intersection; the coordinate-order plausibility check; and the free-text hygiene rules in Section 6.1.

## The demo console

`demo/dispatcher-console.html` is the specification from the issuing side. It is a separate page from the hosted system demo linked at the top of this file, which models the whole path from console to record. It opens on a live incident: a structure fire on Valencia between 18th and 20th, four automated vehicles inside the zone, the notice still in draft.

The three lifecycle actions, **Update**, **Extend** and **Cancel**, sit in a sticky bar at the top of the window with the live countdown, so they stay reachable however far you have scrolled.

What it shows that the prose cannot:

- **Tier limits as you work.** The duration and area meters fill against the Tier 1 limits. A single verdict says whether the notice is ready to issue; the twelve individual checks are behind it for anyone who wants them.
- **Revision without rewriting.** Update opens a revision: the published restriction stays in force while you redraw it, and publishing emits an `UPDATE` at the next sequence with `references` and `original_effective_start`. Editing a live notice in place at sequence 1 would silently rewrite something receivers have already accepted.
- **What "exit, never freeze" looks like.** Issue the notice and the vehicles inside route out along the street grid rather than stopping where they stand. One of them, AV-4471, gets boxed in by apparatus and is reported as an acknowledgement exception, which is the case example 07 in the spec describes.
- **Mandatory expiry.** The countdown runs down and the restriction lifts on its own. Run the clock at 900x to watch it happen.
- **The lifecycle rules.** Extend opens a fresh window from now rather than stretching the old one, because stretching it would breach the per-message ceiling. Cancel issues sequence 2. Re-issuing after a cancel mints a new `notice_id`, because reusing one puts a second notice at sequence 1 under a key receivers have already seen.
- **The coordinate reversal.** Under Message, the Notice view shows GeoJSON `[longitude, latitude]` and the CAP 1.2 view shows the same ring as `latitude,longitude`.

Everything simulated is labelled as simulated: the fleet, the operator acknowledgements, and the signature. The notices it emits are real, and validate against `schema/geofence-notice.schema.json`.

Four incident presets fill the reason, severity, restriction, window and public text in one click, because the failure mode at 04:00 is a half-filled form rather than a wrong one.

Drawing is a drag: press on the map and pull out a box, with no tool to arm first. The Area, Radius and Street tools change what a drag produces, and clicking places individual corners for a precise outline. Drag a corner to adjust an existing zone. By keyboard: focus the map, then arrow keys move the crosshair, Space places a point, Enter finishes.

The interface uses a neutral system palette and system fonts, follows the operating system between light and dark, and loads nothing from the network.

## The five questions

A notice answers five things in a form both a fire captain and a routing planner can read:

1. **When** does it start, and when does it end? Section 4. Every notice expires. There is no open-ended form.
2. **Who** is asking, and with what authority? Section 5. Tier is derived from the registry, never asserted in the message.
3. **Why** is the area restricted? Section 6.1 and 6.2.
4. **What** must the vehicle do? Sections 6.3 through 6.5 and Section 8. The restriction is graduated, not binary.
5. **Where** is the boundary? Section 7. GeoJSON, WGS 84, `[longitude, latitude]`.

## Three things that are easy to get wrong

**Coordinate order.** GFN uses GeoJSON `[longitude, latitude]`. CAP 1.2 uses `latitude,longitude`. Getting the conversion backwards moves a San Francisco geofence into the Southern Ocean. `examples/invalid/92-swapped-coordinates.json` is the regression test.

**Stopping instead of leaving.** The default `on_entry_behavior` is `EXIT_VIA_NEAREST_SAFE_EGRESS`, not "stop." A vehicle that halts where it stands when a geofence turns on is a vehicle abandoned in a fire lane, which is the exact behavior NHTSA cited in July 2026.

**Broadcasting to the public.** Do not route routine geofence notices to EAS or WEA. Section 11.4. Alert fatigue is a measured public safety harm, and a notice telling robotaxis to avoid two blocks is not a public emergency.

## How to comment on this draft

Everything here is a draft for comment. There are two ways to give feedback, and
both end up in the same place. Pick whichever costs you the least.

### 1. Reply in plain language, quoting the rule number

The lowest-friction option, and a perfectly good one. Nearly every reviewable statement
in these documents carries a stable identifier: `P-1` to `P-22` in the California profile,
`R-1` to `R-19` in the location resolution rule, `C1` / `H4` / `M7` / `L5` in the security
review, `G1` to `G10` in the registry governance analysis, and numbered sections
everywhere else. Quote the identifier and say what is wrong:

> P-6, one hour is too short for a working structure fire. Make it two.

That is a complete review comment. Send it by email or [open a GitHub issue](https://github.com/The-Center-for-Auto-Safety/Geo-Fence-Notification/issues). Nothing
else is required.

### 2. Review on GitHub

For anyone comfortable with it, this is the least work for everybody. Reviewers need
only the **Read** role on the repository, which is enough to submit reviews and comment
on specific lines of a pull request, and does not permit pushing, merging, or applying
suggestions. Comments anchor to lines, thread, and resolve, and nothing has to be merged
by hand afterwards.

### What not to use

Do not leave comments as HTML comments (`<!-- like this -->`) in the markdown. They are
invisible in every rendered view, so no other reviewer can see them and the same
objection arrives several times.

Do not make a Google Doc the master copy. Round-tripping these tables and code blocks back to
markdown loses fidelity every trip, and the exact regulatory quotations in
`PROFILE-CALIFORNIA.md` do not survive an editor that curls quotation marks.

## Status

Draft for review, September 2, 2026.

The draft has been through one adversarial security and safety review, recorded in `SECURITY-REVIEW.md`. It found 6 critical and 12 high findings, all now closed, and the regression cases in `examples/invalid/` cover the ones a validator can catch. Several of the fixes changed normative behavior, most consequentially: `duration` is no longer permitted on a live notice, revisions must carry `original_effective_start` and are bound to their original issuer, acknowledgements are signed, and the rate-limit table in Section 10.3 now distinguishes thresholds that page a human from gates that actually stop a notice.

Section 14 lists the open questions for v0.2, of which registry governance is the hardest.
