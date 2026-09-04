# GFN Registry Governance

**Status:** Design analysis for v0.2. Resolves Section 14 item 1 of GFN-0.1 into a recommendation with recorded dissent.
**Date:** 2026-09-04
**Depends on:** GFN-0.1-specification.md sections 5.3, 5.4, 9, 10.1, 10.3, 10.4, 11.2, 11.6, 13, 14. SECURITY-REVIEW.md findings M6 and L3. MESSAGE-FLOW.md sections 4 and 6.

Section 14 item 1 asks who runs the credential registry and how a 12-person police department in a rural county gets a certificate. It calls this the hardest unsolved piece. It is, but not for the reason the sentence implies. The hard part is not choosing an institution. It is that v0.1 loaded five different jobs onto one word, and those jobs have constituencies that differ by four orders of magnitude in size and have nothing else in common.

This document does four things. It states what the registry is actually for. It argues that it is two registries, not one. It scores five governance models against the same criteria and picks one. And it maps the recommendation onto the legal hooks that already exist, because as of 2026 the interesting fact about this problem is that two states and one pending federal bill have already mandated the behavior GFN describes and have specified no authentication for it whatsoever.

---

## 1. What the registry is for

The word "registry" appears in nine places in GFN-0.1 and carries five distinct jobs. Naming them separately is the whole trick, because they do not have to be done by the same body.

| # | Job | Spec cite | What breaks without it |
|---|---|---|---|
| **R1** | **Credential issuance and revocation.** Root of the certificate chain. Every `ACTUAL` notice carries a detached JWS whose `x5c` chains to a registry root or whose `kid` resolves through the registry. Certificate subject MUST equal `requestor.authority_id`. Certificates one year or less. Revocation published as OCSP or an hourly CRL, issuable and revocable within 15 minutes. | 10.1, 10.3 | Nothing. There is no signature verification at all, and GFN degrades to an unauthenticated message that anyone can mint. |
| **R2** | **Tier assignment.** Tier is derived from `agency_type`, from `reason.code` for Tier 1W, and from the issuer's registry entry. It is never asserted in the message. The registry is authoritative. | 5.3 | Any issuer can claim Tier 1 by setting `agency_type` to `FIRE_EMS`, which converts every ceiling in 5.3 into a suggestion. |
| **R3** | **Jurisdiction boundaries and mutual aid.** Receivers MUST verify that every zone geometry lies wholly within the issuer's registered boundary, with state, federal, and mutual-aid exceptions. Failures are rejected with `OUTSIDE_JURISDICTION` and reported to the registry operator. | 5.4 | The primary defense against a compromised small-agency credential closing a metropolitan area is gone. There is no other. |
| **R4** | **Receiver directory and feed access control.** Poll and stream endpoints MUST authenticate clients with registered operator credentials, mutual TLS or a registry-issued token, and MUST serve `RESTRICTED` only to registered operators and `PRIVATE` only to operators named in `addressed_operators`. | 9 feed rules, 11.x | Scope is decorative. `RESTRICTED` and `PRIVATE` notices, which 10.4 requires for `ACTIVE_THREAT`, `DIGNITARY_PROTECTION`, `SPECIAL_OPERATION` and `BOMB_THREAT`, are readable by anyone who finds the endpoint. |
| **R5** | **Out-of-band truth.** The published callback number that `manual_entry.verification_method: CALLBACK_TO_PUBLISHED_NUMBER` calls back to, for any manual notice at `priority` 0 or 1 or at a prohibitive level. | 11.6 | The manual voice channel has no security. The ninety-second callback that 11.6 calls "the entire security of this channel" verifies nothing, because the number came from the caller. |

Two consequences follow immediately, and both are already visible in the repository.

`validate.py` cannot become a conformance suite on its own. Section 13 says so: it implements schema validation, geometry rules, tier ceilings, and free-text hygiene, and every file under `examples/invalid/` is a regression test for a specific rejection. It does not implement signature verification, revocation, jurisdictional containment, or any cross-message state, because all four need R1, R2 and R3. Any conformance work that does not start with a registry decision stalls at exactly the line `validate.py` stalls at now.

Several other Section 14 items are not independent problems. Item 9's endpoint discovery and registry-hosted aggregate feed is R4 with a different name. Item 8's shared gateway for small agencies issuing restricted notices needs R1 to know who the small agency is and R4 to know who may read the result. The M6 disposition in SECURITY-REVIEW.md defers the `sequence` ceiling override to "a registry override." Deciding the registry closes or substantially advances four open items, which is the strongest argument for doing it first in v0.2.

---

## 2. The registry is two registries

R1, R2, R3 and R5 describe **issuers**: fire departments, police agencies, county emergency management, public works, utilities, transit authorities. R4 describes **receivers**: the covered entities that run automated driving system backends. v0.1 treats these as one system because both need credentials. They should not be one system, and the case is not aesthetic.

| | **Issuer registry** | **Receiver directory** |
|---|---|---|
| **Population** | About 17,541 state and local law enforcement agencies (BJS, 2018 census) plus about 29,452 estimated fire departments (NFPA, 2020), before public works, utilities, transit, tribal, and event organizers. Call it 50,000 and rising. | In California, the state with the most mature program: 28 testing permits with a driver, 6 driverless testing permits, 3 deployment permits. Tens, nationally, for the foreseeable future. |
| **Vetting question** | "Is this really the Fire Department of X, and what is X's boundary?" A civic identity question, answered from records the state and county already hold. | "Is this a covered entity lawfully operating an ADS here, and what is its endpoint and contact of record?" A licensing question, already answered by an existing permit. |
| **Who has the records** | State emergency management, state CJIS systems agencies, county governments, USFA's fire department registry. Nobody at the federal transportation level. | The state AV regulator. In California and Texas, that is the DMV. |
| **Enforcement lever** | Essentially none. You cannot fine a fire department for a bad notice. The lever is credential revocation and after-action review. | Strong and already exercised. A permit can be restricted, suspended, or revoked. |
| **Revocation urgency** | 15 minutes (10.3). A stolen issuer key mints city-closing notices. | Days. A receiver credential leak exposes `RESTRICTED` notice content, which is serious, but it does not stop traffic. |
| **Failure mode of getting it wrong** | Forged closure of a metropolitan area during an emergency. The top threat in Section 10. | Disclosure of a live police perimeter. Bad, bounded, and not a mass-casualty vector. |
| **Onboarding burden tolerable** | Very low. The 12-person rural PD is the design constraint. If onboarding takes a week of staff time, coverage stops at large cities and the specification fails where it is most needed. | High. These are well-resourced firms that already complete a $3,275 California application and a 500,000-mile heavy-duty testing regime. |

Four orders of magnitude of population difference, opposite tolerances for onboarding friction, different record-holders, and different enforcement levers. There is no institution that is good at both. Forcing one body to do both means either the issuer side gets AV-regulator ergonomics, which no fire department will tolerate, or the receiver side gets public-safety ergonomics, which throws away the only working enforcement lever anyone has.

**So yes, the split is required.** Not as a matter of taste. R4 has a natural home that R1, R2, R3 and R5 cannot use, and R1, R2, R3 and R5 have natural homes that would be absurd for R4.

Texas has already made this split without being asked to. TxDMV grants the operating authorization, and the first responder interaction plan is filed with the Texas Department of Public Safety, a different agency. Two registries, one for the licensing relationship and one for the public safety relationship, in the second-largest AV market in the country.

---

## 3. Criteria

Every model below is scored on the same seven questions, drawn from Section 1 and from Section 10's threat model.

1. **Coverage.** Can it reach the 12-person rural PD, and how long until it does?
2. **Identity proofing.** Does the operator actually know the agency is real, or does it take self-assertion?
3. **Jurisdiction data.** Does it already hold, or have a path to, authoritative boundary polygons per agency (R3)?
4. **Revocation.** Can it meet 15 minutes (10.3)?
5. **Cross-jurisdiction.** Does mutual aid across a state line work?
6. **Enforcement.** Is there a consequence for abuse, in either direction?
7. **Durability.** Does it survive an administration change, a funding lapse, or a vendor exit?

---

## 4. The candidate models

### Model A. Federal single registry at NHTSA

**What it is.** NHTSA operates the credential root, credentials both issuers and receivers, publishes revocation, and holds jurisdiction boundaries.

**Why it is on the list.** H.R. 10033, the AV Emergency Response Coordination Act introduced 2026-07-28, directs that "not later than 180 days after the enactment of this Act, the Administrator shall issue a final rule establishing a process by which a Federal, State, or local government agency may issue a geofence notice." If that bill passes, NHTSA is the named rulemaker and the process is NHTSA's to define.

**Where it works.** Receiver side, unambiguously. NHTSA already has the manufacturer relationship: Part 555 exemptions, the Standing General Order crash reporting, defect authority. Receivers are national firms and NHTSA is a national regulator, and a single national receiver directory avoids the fifty-directories problem entirely.

**Where it breaks.** Issuer side, comprehensively. NHTSA has no relationship with any fire department in the United States, no basis for asserting that an agency is Tier 1, no custody of municipal boundaries, and no mechanism for identity-proofing 50,000 local agencies. Standing up that capability from zero at a agency of NHTSA's size is a decade-long project competing against its existing safety mission for staff. And R3 requires boundary data that is definitionally state and county held.

There is a second problem the spec already flags. Section 10.3 notes that jurisdictional containment "bounds a compromised federal credential hardly at all," because a federal agency may issue anywhere in the United States. A federal registry that is also the largest federal issuer is a concentration of exactly the credential class containment does not constrain.

**Score.** Coverage: poor. Identity proofing: no capability. Jurisdiction data: none. Revocation: buildable. Cross-jurisdiction: excellent by construction. Enforcement: strong on receivers, none on issuers. Durability: subject to appropriations and administration priorities, and a rule can be withdrawn by the same process that made it.

### Model B. Federal single registry at FEMA, via IPAWS

**What it is.** GFN issuers become IPAWS Collaborative Operating Groups, or are credentialed by an extension of the same process. The COG identity is the GFN issuer identity, the IPAWS digital certificate is the GFN signing certificate or its parent.

**Why it is the strongest single-institution option.** FEMA already does R1, R2 and R3, for this exact population, and has for over a decade. The sign-up process is four steps: IS-247 training, procure compatible software, execute a memorandum of agreement through the IPAWS User Portal which returns a COG ID number and a digital certificate, and apply for public alerting permissions in an application "reviewed and signed by a designated state official or tribal leadership" that defines alert types and geographic coverage areas.

Read that last clause against GFN 5.3 and 5.4. An application that defines permitted alert types and geographic coverage, signed off by a state official, is R2 and R3 in production today. FEMA also operates, through USFA, a National Fire Department Registry holding 27,166 registered departments as of January 2024, about 92 percent of the roughly 29,452 the NFPA estimated existed in 2020. FEMA is the only federal body that can enumerate the fire service at all.

**Where it breaks, and it is fatal as a sole model.** Coverage. There are more than 1,600 IPAWS alerting authorities, with more than 100 in process. Against a combined law enforcement and fire universe of roughly 47,000 agencies, that is under four percent after more than a decade of operation. The 12-person rural PD in Section 14 item 1 is, empirically, not an IPAWS alerting authority and shows no sign of becoming one.

The friction is structural, not incidental. Compatible alert origination software is procured by the agency and is not free even though IPAWS-OPEN access is. A public alerting plan needs a designated state official's signature. And production access is withdrawn after three consecutive missed monthly proficiency tests, which means an agency that adopts geofence notices through IPAWS and otherwise does not use IPAWS loses the channel within a quarter. That is a specific, documented way for a GFN deployment to silently die.

There is also the delivery constraint already recorded as SECURITY-REVIEW finding L3 and Section 14 item 8. The route by which a non-government organization receives from IPAWS is the All-Hazards Information Feed, which carries public alerts. `RESTRICTED` requires COG-to-COG with the AV operator itself holding a COG, and `PRIVATE` has no route at all. A FEMA-rooted registry does not fix that, because it is a property of the delivery architecture rather than of the credential.

**Score.** Coverage: 4 percent and slow. Identity proofing: excellent. Jurisdiction data: excellent, via the permissions application. Revocation: FEMA revokes COG access today, latency unverified against the 15-minute requirement. Cross-jurisdiction: good, single root. Enforcement: withdrawal of access, plus the proficiency-test trap. Durability: strong, statutory mission.

### Model C. State by state, on the California and Texas model

**What it is.** Each state's AV regulator runs both registries for that state. California DMV and TxDMV are the working examples.

**Why it is on the list.** It is the only model with a demonstrated enforcement lever tied specifically to geofence compliance. California's regulations effective 2026-04-28 let the DMV impose targeted operational restrictions on a manufacturer covering fleet size, location, speed and weather, and restrict or suspend a permit for violating emergency geofencing directives. It is also the only model that exists. California and Texas both have live programs today; every other model in this document is a proposal.

**Where it breaks.**

*Coverage of states, not just agencies.* DMV-as-AV-regulator is a California and Texas pattern. Elsewhere the function sits with the state DOT, and in many states with nobody. A model that requires each state to first decide which agency owns AVs, then stand up a PKI, produces a national map with holes in it for a decade.

*Mutual aid dies at the state line.* GFN 5.4 explicitly contemplates a mutual-aid flag extending an agency's boundary to named neighboring jurisdictions. Kansas City, St. Louis, Memphis, Philadelphia, New York and Washington DC all have mutual-aid relationships that cross state lines routinely. Fifty unrelated roots means a receiver must trust fifty roots with no common policy, and an agency responding across a line has no credential the neighboring state's receivers will accept.

*Fifty times the attack surface with no common floor.* Section 10's threat model assumes one root with a stated certificate policy. Fifty roots means the weakest state's issuance practice sets the security of the whole system, because a receiver operating nationally must trust all of them. This is the WebPKI problem, and the WebPKI needed twenty years and a nonprofit forum to get it under control.

*The DMV cannot do the issuer side anyway.* This is Model C's fatal flaw and it is the same one as Model A's. A DMV credentials drivers, vehicles, dealers, and in two states AV manufacturers. Asking a DMV to certify that a county emergency management agency is who it says it is, and to hold that county's boundary polygon, inverts its function. California's own statute concedes this: CVC 38751(d)(3) does not have the DMV credential anybody. It makes the *manufacturer* hand each emergency official "all information necessary" to begin issuing, within 30 business days of notice. That is bilateral onboarding, N agencies by M manufacturers, with no third party and no authentication. It is the thing GFN exists to replace.

**Score.** Coverage: strong in 2 states, absent in 48. Identity proofing: none on the issuer side. Jurisdiction data: none held. Revocation: buildable. Cross-jurisdiction: broken. Enforcement: the best available, and already in regulation. Durability: good within a state.

### Model D. Federated. State issuance under a national root operated by a nonprofit association of the issuing bodies

**What it is.** Two tiers. States credential their own agencies, using the records they already hold, under a common certificate policy. A national body operates the trust list that receivers actually consume, admits state roots against that policy, and publishes aggregate revocation. Receivers trust one list, not fifty roots.

**Why this is not speculative.** It is how the motor vehicle world already solved the identical problem for mobile driver's licenses. AAMVA operates the mDL Digital Trust Service. Participating issuing authorities are approved by AAMVA's Identity Management Steering Committee, after which "AAMVA will retrieve issuing authorities' public keys securely and will publish them to the DTS Verified Issuer Certificate Authority List (VICAL)." Relying parties download one list to obtain "the public keys of each issuing authority." Participation requires adherence to ISO/IEC 18013-5 and the AAMVA mDL Implementation Guidelines. AAMVA is a nonprofit association of the motor vehicle administrators themselves, which is why states accepted it as a root when they would not have accepted each other.

The public safety side has the same shape of institution. Nlets, founded 1967, is a not-for-profit message switching system linking "every state, local, and federal law enforcement, justice, and public safety agency," governed by its member states, moving criminal justice data including driver license and vehicle registration queries across state lines. It solves the fifty-states-must-talk-to-each-other problem for law enforcement and has for nearly sixty years. The FBI CJIS ORI scheme underneath it is a federated identifier system in which state CJIS systems agencies issue identifiers under national rules, and it enumerates essentially every law enforcement agency in the country.

**Where it works.** Coverage inherits from the state, which is the level that actually knows its agencies. Identity proofing is done by the body that holds the records. Jurisdiction polygons are state and county data, so R3 is sourced where the data lives. Mutual aid works, because the common root is what makes a neighboring state's credential meaningful. And a common certificate policy sets a floor, so the weakest state is bounded rather than unbounded.

**Where it breaks.** It has the most moving parts of any model here, and it does not exist yet for public safety geofencing. A nonprofit root needs funding, and funded-by-the-regulated is a capture risk that Section 7 treats seriously. AAMVA's own DTS is still described as a minimally viable product with fluctuating availability, which is a caution about how long this takes even when the association and the standard already exist. And fifty state programs standing up at fifty speeds means partial coverage for years, exactly as with Model C, though with the difference that partial coverage federates cleanly instead of fragmenting.

**Score.** Coverage: inherits from the state, best long-run ceiling. Identity proofing: excellent, done where the records are. Jurisdiction data: excellent. Revocation: aggregate CRL at the root, 15 minutes achievable. Cross-jurisdiction: solved, this is the point. Enforcement: policy admission and removal of a state root, plus whatever the state does. Durability: high, member-governed bodies outlast administrations.

### Model E. An independent nonprofit, standing alone

**What it is.** A new 501(c)(3) or (c)(6) runs the whole thing, credentialing issuers directly and operating the receiver directory, funded by membership dues, grants, or receiver fees. DirectTrust in health information exchange and the CA/Browser Forum in the WebPKI are the shapes.

**Where it works.** Speed and neutrality. A nonprofit can start next year rather than after a rulemaking, can write a certificate policy without notice-and-comment, and is not tied to one administration. If GFN wants a reference implementation and a pilot with three cities and two operators before anyone legislates, this is how that happens.

**Where it breaks as the permanent answer.** Two things, both serious.

*Legitimacy for R2 and R3.* A private nonprofit deciding that the Fire Department of X is Tier 1 and that X's boundary is this polygon is asserting a governmental fact without governmental authority. The first time a notice is challenged, in litigation after a delayed ambulance or a wrongly closed street, the tier assignment has to trace back to something with legal standing. AAMVA works as a root because it is the states' own association, and the state remains the issuing authority. A nonprofit with no such relationship is asserting rather than federating.

*Funding structure is the capture vector.* If the receivers fund the registry that constrains the receivers, the tier ceilings and the boundary data are set by the regulated party. That is a direct threat to R2, and it is not hypothetical: the pressure would be toward narrower boundaries, longer lead times, and higher evidentiary bars for prohibitive levels, all of which look like reasonable process improvements one at a time.

**Score.** Coverage: unknown, no lever to compel anything. Identity proofing: possible, but derivative. Jurisdiction data: must be sourced from states anyway. Revocation: easily met. Cross-jurisdiction: fine. Enforcement: none, only refusal to credential. Durability: funding-dependent, and funding is the capture risk.

---

## 5. Recommendation

**Split the registry, and give each half to the body that already holds the records and the lever.**

### 5.1 Receiver directory: the state AV regulator, with a federal floor

R4 goes to whoever licenses AV operation in the state, which is the DMV in California and Texas and the DOT elsewhere. It is already their job, they already hold the permit list, the endpoint and contact of record is a natural permit condition, and they hold the only enforcement lever anyone has demonstrated. California's regulations already restrict or suspend a permit for violating an emergency geofencing directive, which means the compliance consequence GFN needs exists today and needs no new authority.

The federal floor matters because receivers are national. If H.R. 10033 passes, the NHTSA rule under it should specify the directory's schema, the endpoint registration requirement, and the credential format, so that fifty state permit programs produce one interoperable directory rather than fifty. This is a low-cost, high-value use of the 180-day rulemaking, and it does not require NHTSA to credential a single fire department.

**So the DMV is an option, and a good one, for exactly one of the two registries.** It is the wrong body for the other one, and the reason is not capability, it is that the DMV has never had a relationship with a fire department and has no reason to acquire one.

### 5.2 Issuer registry: Model D, federated, with FEMA as the interim credential of record

R1, R2, R3 and R5 go to a federated scheme. States credential their own agencies under a common certificate policy. A national body admits state roots and publishes the trust list and aggregate revocation that receivers consume. The AAMVA DTS VICAL is the working template for the mechanism, and Nlets is the working template for the governance, a nonprofit owned by its member states that has moved public safety data across state lines since 1967.

The interim answer, and the part that makes this shippable before the federation exists, is that **an agency holding an IPAWS COG is already credentialed for this purpose.** FEMA has already identity-proofed it, a designated state official has already signed off on its permitted alert types and geographic coverage, and it already holds a digital certificate. GFN v0.2 should say that a valid IPAWS COG identity is an acceptable issuer credential, mapped into the registry as a recognized state-equivalent root. That gives day-one coverage of more than 1,600 agencies including most large-city emergency management, with zero new institutions, while the federated scheme is built for the other 45,000.

It is an interim answer and the document should say so plainly. Four percent coverage is not a national system, the monthly proficiency test will quietly disqualify agencies that use IPAWS only for this, and the All-Hazards Information Feed's public-only limitation (finding L3) still means small IPAWS-only agencies cannot issue a `RESTRICTED` perimeter.

### 5.3 Why not the single-institution options

Model A fails because NHTSA has no path to identity-proofing 50,000 local agencies and no custody of boundary data. Model B fails on coverage arithmetic, not on capability. Model C fails because the DMV cannot do the issuer half and because mutual aid dies at the state line. Model E fails because R2 and R3 are governmental assertions and a private body asserting them will not survive the first challenge.

Model D is the most complex and it is still correct, because it is the only one where each job is done by the body that already holds the relevant records, and the only one where a common certificate policy bounds the weakest participant.

---

## 6. Recorded dissent

The strongest arguments against the recommendation, and what would change the answer.

**"Federated means nothing ships for five years."** The most serious objection. Model D has more moving parts than the other four combined, and AAMVA's DTS is still a minimally viable product with fluctuating availability years in. If the operative deadline is the 180 days in H.R. 10033, Model D cannot meet it and Model A can. The mitigation is 5.2's interim step, which ships on FEMA's existing credentialing, and it is a real mitigation only if v0.2 specifies the IPAWS mapping concretely rather than gesturing at it.

**"Two registries doubles the failure modes."** Fair. Every split adds a seam, and the seam here is that a notice's validity depends on the issuer registry while its delivery depends on the receiver directory, so an outage in either stops notices with different symptoms. Section 7 treats this. The counter is that the alternative is not one simpler system, it is one system doing a job it cannot do.

**"California will just do it alone and everyone will copy California."** Plausible, and it is roughly how emissions standards went. If California's DMV builds a full issuer registry under CVC 38751 authority and it works, Model C wins by default regardless of what is correct. The tell to watch is whether California's implementation of 38751(d)(3) stays bilateral or whether the DMV steps in as the intermediary. If the DMV builds an issuer directory, this document's Model C critique needs revisiting.

**"IPAWS coverage is 4 percent because nobody needed it, and geofence notices are a reason to need it."** The honest version of the FEMA case. IPAWS coverage may be low because public alerting is rare and consequential, while geofence notices would be routine, and routine use survives a monthly proficiency test easily. If AV fleets reach a hundred cities, the adoption curve for IPAWS could look nothing like the last decade's. This would make Model B much stronger and is the single most likely way the recommendation is wrong.

**"An independent nonprofit is how every one of these actually started."** Also true. The CA/Browser Forum, DirectTrust, and AAMVA's own trust service all began as voluntary industry bodies before anything was mandated. Model E may be the correct *first* step even though it is the wrong *final* answer, and 5.2 plus a nonprofit convening body is a defensible reading of this document.

---

## 7. Security review of the recommended model

Worked against Section 10's threat model. The governing threat there is not one hacked car. It is a forged notice that shuts down automated transportation across a city, or a real notice that never arrives.

| ID | Threat introduced or unresolved by the recommendation | Disposition |
|---|---|---|
| **G1** | **Compromised state root.** A federated model means one state's issuance practice can mint credentials the whole country's receivers trust. Section 5.4's containment limits the damage to that state's geography, which is the saving grace, but a compromised large-state root is still a metropolitan-scale forgery capability. | **Mitigated, not closed.** Containment (5.4) bounds it geographically. The national root MUST be able to remove a state root from the trust list and publish that removal within the same 15-minute window as 10.3. The certificate policy MUST require state roots to be offline and hardware-protected. **Open for v0.2:** a state root cannot be revoked casually, because doing so disarms every legitimate agency in that state during whatever emergency is underway. Needs a graduated response, not a binary. |
| **G2** | **Cross-state mutual aid is where containment and federation collide.** 5.4's mutual-aid flag extends an agency's boundary to named neighbors. Across a state line, the flag is set by state A about geography in state B. | **Open.** The certificate policy must require that a cross-state mutual-aid extension be countersigned by the receiving state's root, or it becomes a mechanism for one state to authorize issuance into another. Not specified in v0.1 and must be in v0.2. |
| **G3** | **The national trust list is a single point of failure for verification.** If receivers cannot fetch the list or the aggregate CRL, they either fail open (accept unverifiable notices) or fail closed (reject legitimate ones during an emergency). | **Addressable, and the spec already leans the right way.** 8.5's cached-notice behavior establishes the principle that a receiver that loses its feed keeps honoring what it has. The same principle applies: a cached trust list remains valid for a bounded window, notices verified against a stale list are flagged rather than rejected, and the window is short enough that 10.3's revocation still means something. This is a genuine tension between 10.3 and availability and v0.2 must state the tradeoff explicitly rather than leave it to receivers. |
| **G4** | **Revocation latency across two tiers.** 10.3 requires issue and revoke within 15 minutes. A two-tier scheme adds a propagation hop from state root to national aggregate. | **Constrains the design.** The national aggregate CRL must be pull-refreshed by receivers at least hourly per 10.1, which is too slow for a 15-minute requirement on its own. v0.2 needs either OCSP against the state root directly, with the trust list providing the responder URL, or a push mechanism. Do not paper over this: 10.1's hourly CRL and 10.3's 15 minutes are currently in conflict, and that conflict predates this document. |
| **G5** | **The receiver directory is a target in itself.** A national list of every AV operator's notice-ingestion endpoint is a denial-of-service target map, and it is exactly what an attacker pursuing the notice-suppression threat in Section 10 would want. | **New finding.** Endpoints in the directory MUST NOT be public. The directory serves endpoint data only to authenticated issuer credentials, and issuers should receive a per-issuer view rather than the whole list. This is a real cost of solving Section 14 item 9 and it should be recorded as such. |
| **G6** | **Tier capture.** If the receiver side funds any part of the issuer registry, the party constrained by 5.3's ceilings is paying the party that assigns them. | **Structural, must be designed out.** The recommendation keeps the two registries institutionally separate partly for this reason. v0.2's certificate policy should prohibit receiver funding of issuer tier assignment, and tier assignment should be a state function reviewable by the state, not a fee-for-service. |
| **G7** | **The IPAWS interim path inherits IPAWS's failure modes.** Three consecutive missed monthly proficiency tests withdraws production access. An agency credentialed for GFN through its COG loses its GFN credential as a side effect of not sending public alerts. | **Accept and document.** v0.2 MUST warn implementers that a COG-derived credential can lapse for reasons unrelated to GFN, and receivers MUST treat a lapsed COG as revocation, which means an agency can be silently disarmed. This is an argument for treating the IPAWS path as strictly interim. |
| **G8** | **CVC 38751(d)(3) is an active attack surface today.** The statute makes manufacturers hand emergency officials "all information necessary" to begin issuing, within 30 business days, over "commonly available communication methods," with a two-minute mandatory fleet action on receipt and no authentication specified. | **This is the case for GFN, stated as a finding.** Whatever registry model is chosen, an unauthenticated message that triggers a mandatory two-minute fleet action is a forgery vector with statutory force behind it. Recommend this be raised in SECURITY-REVIEW.md as a finding about the operating environment rather than about the specification. |

Findings G2, G3, G4 and G5 are new and should be carried into SECURITY-REVIEW.md as open items. G4 in particular identifies an internal inconsistency between 10.1 and 10.3 that exists in v0.1 independent of any registry decision.

---

## 8. Adoption path

The registry does not need to be invented before GFN is useful. Three hooks already exist and each takes a different piece.

### 8.1 California, live now

Cal. Veh. Code 38751, effective 2026-07-01, created by AB 1777. Subdivision (d)(1): "An emergency response official may issue an emergency geofencing message to a manufacturer," the category defined to include emergency dispatchers, peace officers and first responders. An emergency geofencing message is defined as "a message delivered using commonly available communication methods" identifying a location and directing AVs to leave or avoid it. Subdivision (d)(2): "Within two minutes of receiving an emergency geofencing message, a manufacturer shall issue direction to its fleet to leave or avoid the area identified." The official must include an initial duration based on a reasonable assessment of the emergency, extendable.

Read that against GFN. A duration set by the issuer based on the emergency, extendable, is 4.2's mandatory expiry and 4.3's `EXTEND` with cumulative ceilings. A two-minute mandatory fleet action is 8.4's latency budget. "An emergency response official" with no further qualification is R1 and R2 unfilled. "Commonly available communication methods" is the absence of 10.1. GFN is, almost line for line, the missing implementation of this statute.

The California DMV regulations effective 2026-04-28 supply the enforcement half: annual first responder interaction plan updates, two-way communication with a 30-second response, Notices of AV Noncompliance for moving violations, targeted operational restrictions on fleet size, location, speed and weather, and permit restriction or suspension for violating emergency geofencing directives.

**What GFN should do:** publish a California profile. A short normative mapping showing that a conforming GFN notice satisfies 38751(d), that `effective_end` is the required initial duration, that `EXTEND` is the statutory extension, and that the two-minute clock starts at receipt as defined in 8.4. Offer it to the DMV as the answer to the question 38751(d)(3) currently answers bilaterally.

### 8.2 Texas, live now

TxDMV authorization enforceable 2026-05-28, applications through TxMCCS, no fee, with authority to suspend, revoke or restrict for unsafe operation subject to a notification and appeals process and State Office of Administrative Hearings review. The first responder interaction plan goes to the Texas Department of Public Safety, not the DMV.

**What GFN should do:** cite Texas as the existence proof for the two-registry split. Texas separated the licensing relationship from the public safety relationship without being prompted, and DPS, unlike a DMV, is a plausible issuer-side state root.

### 8.3 Federal, pending

H.R. 10033 directs NHTSA to issue a final rule within 180 days of enactment "establishing a process by which a Federal, State, or local government agency may issue a geofence notice," defines a geofence notice as a request to avoid an area for up to 72 hours, and defines covered entity and covered vehicle as recorded in MESSAGE-FLOW.md. It contains no registry, no credentialing, and no authentication requirement.

**What GFN should do:** the 180-day rulemaking is the single highest-leverage intervention available, and the ask is narrow. The rule should specify the receiver directory (5.1), the notice format, and that issuer credentialing federates to the states under a common policy. It should not attempt to have NHTSA credential local agencies. Note also that the bill's 72-hour ceiling is stricter than GFN Tier 1W's 14-day maximum, which is a real conflict that v0.2 must address, either by arguing the ceiling up for wide-area hazards or by capping 1W at 72 hours with re-issuance.

### 8.4 Sequence

1. **Now.** Publish the California profile (8.1). Specify the IPAWS COG mapping as an interim issuer credential (5.2). Both are documents, not institutions.
2. **Next.** Get the receiver directory into the NHTSA rule if H.R. 10033 moves, or into the California and Texas permit conditions if it does not. This is the half that has a home today.
3. **Then.** Convene the federated issuer scheme. The natural conveners are the associations that already exist, and the model to copy is AAMVA's DTS with public safety membership rather than motor vehicle membership.

---

## 9. What this changes in the specification

Proposed for v0.2, listed so it can be worked without re-reading this document.

1. **Rewrite Section 14 item 1** as a resolved design direction with the two-registry split, replacing the open question.
2. **Appendix A glossary, "Registry"** currently reads "The credential authority that issues and revokes signing certificates and holds jurisdiction boundaries and tiers. Does not yet exist." Split into **Issuer Registry** (R1, R2, R3, R5) and **Receiver Directory** (R4).
3. **New section under 10** stating the trust model: state roots, national trust list, common certificate policy, and the cached-trust-list availability behavior from G3.
4. **Reconcile 10.1 and 10.3** (finding G4). The hourly CRL and the 15-minute revocation requirement are in conflict as written.
5. **Add cross-state mutual aid countersigning** to 5.4 (finding G2).
6. **Add the endpoint confidentiality requirement** to the Section 9 feed rules (finding G5).
7. **Add the IPAWS COG interim credential mapping**, with the lapse warning from G7.
8. **Resolve the 72-hour conflict** between H.R. 10033 and Tier 1W (8.3).
9. **Add findings G2, G3, G4, G5, G8** to SECURITY-REVIEW.md.
10. **Update Section 13** to note which conformance items become implementable once a registry exists, since the current text explains only why they are not.

---

## 10. Verification status

Everything asserted above traces to a source in Section 11. Three caveats, stated so nobody quotes this document beyond what it supports.

- **The primary text of California's Article 3.7 and 3.8 regulations has not been read.** The regulation content here comes from the DMV's own news release and two trade summaries, which agree with each other. Before quoting regulation language, pull the Order To Adopt PDFs from the DMV regulations page. Specifically unverified: whether the regulations specify any mechanism or authentication for receiving an emergency geofencing message, which is the single most important open question for the California profile in 8.1.
- **CVC 38751 was read through California.public.law and corroborated by a second summary, not through leginfo,** which blocks automated retrieval. The quoted subdivisions agree across both sources. Verify against the official text before publication.
- **AAMVA DTS revocation procedures, fees, participant count, and go-live date were not obtainable** from the public pages. The mechanism described (Identity Management Steering Committee approval, secure key retrieval, VICAL publication) is sourced; the operational details are not.
- **IPAWS revocation latency against the 15-minute requirement in 10.3 is unverified.** FEMA withdraws production access; how fast that propagates to a relying party is not documented publicly.

---

## 11. Sources

- California Vehicle Code section 38751. https://california.public.law/codes/vehicle_code_section_38751
- California Vehicle Code Section 38751: Emergency Response Requirements for Autonomous Vehicles. https://www.thebulldog.law/california-vehicle-code-section-38751-emergency-response-requirements-for-autonomous-vehicles
- California DMV, New Autonomous Vehicle Regulations Strengthen Oversight and Enforcement, Authorize Trucks and Transit. https://www.dmv.ca.gov/portal/news-and-media/new-autonomous-vehicle-regulations-strengthen-oversight-and-enforcement-authorize-trucks-and-transit/
- ADAS & Autonomous Vehicle International, DMV updates AV rules to improve accountability, first responder coordination and public safety. https://www.autonomousvehicleinternational.com/news/legislation/dmv-updates-av-rules-to-improve-accountability-first-responder-coordination-and-public-safety.html
- California DMV, Autonomous Vehicle Testing Permit Holders. https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-testing-permit-holders/
- California DMV, California Autonomous Vehicle Regulations. https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/california-autonomous-vehicle-regulations/
- Texas DMV, Automated Vehicles Regulatory Program. https://www.txdmv.gov/AVprogram
- H.R. 10033, AV Emergency Response Coordination Act, 119th Congress. https://www.govinfo.gov/bulkdata/BILLS/119/2/hr/BILLS-119hr10033ih.xml
- Rep. Kevin Mullin, introduction announcement. https://kevinmullin.house.gov/2026/07/28/rep-mullin-introduces-bill-to-standardize-autonomous-vehicles-protocol-during-emergencies/
- FEMA, IPAWS Alerting Authorities. https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/alerting-authorities
- FEMA, Sign Up to Use IPAWS to Send Public Alerts and Warnings. https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/sign-up
- USFA, National Fire Department Registry Summary, January 2024. https://www.usfa.fema.gov/downloads/pdf/registry-summary-2024.pdf
- Bureau of Justice Statistics, Census of State and Local Law Enforcement Agencies, 2018. https://bjs.ojp.gov/media/67846/download
- AAMVA, Mobile Driver License Digital Trust Service. https://www.aamva.org/identity/mobile-driver-license-digital-trust-service
- AAMVA, mDL Digital Trust Service, For Issuing Authorities. https://www.aamva.org/identity/mobile-driver-license-digital-trust-service/for-issuing-authorities
- AAMVA, Verified Issuer Certificate Authority List. https://vical.dts.aamva.org/
- Nlets, About: What We Do. https://nlets.org/about/what-we-do
