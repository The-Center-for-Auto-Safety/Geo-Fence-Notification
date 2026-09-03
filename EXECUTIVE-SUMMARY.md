# Closing the street to a robotaxi

**A common format for geofence notices, so one message from your dispatcher reaches every automated vehicle operating in your jurisdiction.**

Executive summary for fire, law enforcement, EMS and emergency management
Draft for comment, 3 September 2026

---

## The situation

Your people are already working around automated vehicles on scene, and the working around is manual, per-vehicle, and slow.

San Francisco firefighters have filed **31 reports since April 2025** documenting robotaxis obstructing emergency operations. The pattern in those reports is the part that matters:

- **December 2025, 15th Street.** A robotaxi blocked an engine responding to a stabbing. Crews knocked on the window to reach customer service. The remote repositioning failed. Firefighters ended up operating the vehicle themselves, and it malfunctioned in reverse. Fifteen minutes gone. Another crew got there first.
- **February 21, Sanchez Street.** A vehicle attempting a three-point turn blocked an engine responding to a patient in respiratory distress. It took SFPD and a tow truck to clear it.
- **April 2025 and May 2026.** The same lieutenant filed the same complaint about a vehicle blocking aerial positioning, eleven months apart. Nothing between those two reports changed the outcome.
- **June 20, 2026.** An unoccupied vehicle drove into an active fire ground obscured by heavy smoke, braked hard, and stopped. That one produced a 105-vehicle recall.

Chief Dean Crispin put it plainly: "It definitely creates a delay in response and a danger to the residents."

Federal regulators agree. On 8 July 2026, NHTSA Administrator Jonathan Morrison told AV developers that the inability to detect and respond to emergency scenes is a **functional insufficiency** across the industry, and that "an automated vehicle that cannot safely interact with first responders is a danger to the general public." Remediation plans were due by the end of that month.

On 3 August 2026, Rep. Kevin Mullin introduced **H.R. 10033, the AV Emergency Response Coordination Act**. It would give you two things by statute:

- A **24/7 hotline** to every operator, answered within 30 seconds.
- The authority to issue a **geofence notice**: a request from a first responder or government agency that automated vehicles avoid an area for up to 72 hours, which operators must comply with **within 2 minutes**.

## The gap

H.R. 10033 grants the authority. It does not say what a geofence notice *is*.

That gap is not academic. Without a defined message, every operator builds its own intake, and a battalion chief negotiates a separate arrangement with every company running vehicles in the city. Each one has a different form, a different contact, a different idea of what "avoid the area" means. At 04:00 on a working fire, that is a phone tree.

Meanwhile the guidance available to the fire service today is informational. The IAFC's autonomous vehicle page tells chiefs to study the DOT strategy, read manufacturer response guides, and watch what NHTSA does. Useful background. Not a mechanism.

**The Geofence Notice Specification (GFN) is a proposed mechanism.** One signed message, one format, understood by every operator, that says: this area, this long, this restriction, from this agency, for this reason.

## What a notice actually does

A geofence notice answers five questions in a form both a fire captain and a routing computer can read. **When** it starts and ends. **Who** is asking and with what authority. **Why**. **Where** the boundary runs. **What** the vehicle must do about it.

Four design decisions do most of the work, and each one exists because the alternative fails in a specific way your people would feel.

**The restriction is graduated, not a switch.** A blanket "no vehicles" is right for a fire ground and wrong for a parade route. Six levels, from `PROHIBITED` (do not enter, do not route through) down to `NO_PUDO` (drive through, just no passenger pickups on the block). Closing more street than the incident needs pushes traffic onto residential blocks and strands riders who depend on the service, so the format makes it easy to close exactly what you need.

**Vehicles exit; they do not freeze.** The default instruction to a vehicle caught inside a new zone is to drive out by the shortest lawful path without stopping. This is the single most important line in the document. A vehicle that halts where it stands the instant a geofence turns on is a vehicle abandoned in a fire lane, which is the exact behavior NHTSA cited. The notice's job is to get them **out**, not to freeze them in place.

**Every notice expires on its own.** There is no open-ended form. The restriction lifts at its end time whether or not anyone remembers to cancel it. A stuck geofence fails silently: nothing alarms, service just quietly stops being available in a neighborhood, and nobody notices for a week. Mandatory expiry converts that from a permanent failure to a time-boxed one and puts the burden of continuation on the agency, where it belongs.

**Safety outranks the notice.** No notice can make a vehicle brake in a travel lane, reverse, make an illegal turn, or ignore an officer directing traffic. On-scene direction from your people beats the notice; the notice beats the operator's business logic. This is an advisory and routing constraint, not a remote kill switch, and it should never be sold as one.

## Who actually receives it

The notice goes to the company that runs the vehicles, not to the vehicles themselves. Their backend pushes the restriction down to each car over the same cellular link it already uses for dispatch, and the car acts on it locally: automated vehicles do not depend on a network connection to drive, so one that loses signal keeps honoring the restriction until it expires.

That boundary is about accountability. Someone has to answer "how many of your vehicles are in my zone and when will they be out," and a car cannot answer for a fleet. It is also the only way vehicles leaving a large zone can spread across different exits instead of all converging on the same two streets.

**For a privately owned automated vehicle there is no fleet, and the duty falls on the manufacturer.** H.R. 10033 defines a covered entity as a manufacturer *or* operator, so the carmaker's connected-vehicle service is the receiver, exactly as a robotaxi company's dispatch system is. Several things about that case are unresolved and named in the draft, including an owner who turns connectivity off.

**The same notice should reach human drivers.** A public-scope closure is the same kind of object that Google Maps, Waze and Apple Maps already ingest from agencies through the federal Work Zone Data Exchange. Anything that is safe to publish should go there too. Everyone benefits from knowing the block is closed, not only the robotaxis, and that binding is one of the open items on the draft.

## What it would take to use it

For a department, adoption is four things:

1. **A credential.** A signing certificate from a registry, so a notice from your agency is provably from your agency and a forged one is not. Who runs that registry is the hardest unsolved question in the draft, and it is the piece that most needs a public safety voice.
2. **A person authorized to issue.** Incident commander, watch commander, or dispatch supervisor, per your policy. The format assumes an incident number and a staffed callback line, both of which you already have.
3. **A way to draw the zone.** Either a CAD integration or a standalone console. A working console ships with the draft; a dispatcher can draw a zone and issue in well under a minute.
4. **Standing policy on which level to use when.** The format supplies the vocabulary. Deciding that a working structure fire gets `PROHIBITED` and a fender bender gets `AVOID` is a local command decision, and it should be written down before the incident, not during it.

## Where the draft and the bill differ

Worth knowing before anyone briefs a legislator.

| | H.R. 10033 | GFN draft v0.1 |
|---|---|---|
| Maximum duration | Up to 72 hours | 4 hours initial for a fire or police incident, 24 hours cumulative. 72 hours only for planned infrastructure work |
| Compliance timing | Within 2 minutes | Acknowledge in 15 seconds, routing updated in 30 seconds, vehicles clear of the zone in 5 minutes |
| Who may issue | Any first responder or government agency | Tiered by agency type, with duration and area ceilings that scale with the authority |

The draft is deliberately **tighter** than the statute would permit. A four-hour ceiling on an incident-scale closure is not a limitation on your authority; it is a forcing function that makes someone look at the zone again while the incident is still live. Extending is one click. Forgetting is the failure mode the ceiling prevents.

The compliance timing is the one place the draft may need to move. "Comply within 2 minutes" and "clear of the zone within 5 minutes" are not the same claim, and the draft should say which it means.

## What this is, and what it is not

**It is** a draft technical specification, complete enough to implement: the message format, the rules, a working demonstration console, and a validator. It has been through one adversarial security and safety review, which found eighteen significant defects, all now fixed and covered by regression tests.

**It is not** an adopted standard, a product, or anything anyone has committed to build. No AV operator has agreed to accept these notices. The credential registry does not exist.

## The ask

1. **Read it and push back**, particularly on the tier ceilings and the timing. These numbers were set by reasoning about failure modes, not by anyone who has run a fire ground.
2. **Run a tabletop.** Take a real incident from your records, draw the zone in the console, and tell us where the format gets in the way.
3. **Take a position on the registry.** If the fire service does not say who should issue these credentials and how a twelve-person rural department gets one, that decision will be made without you.
4. **Back a common format.** The alternative to one specification is a separate bespoke arrangement with every operator, renegotiated every time a new one enters your city. That is the outcome to avoid, and the window to avoid it is now. H.R. 10033 would give NHTSA two years to write the rules, and the bill has not passed.

---

## Plain-language glossary

| Term | What it means here |
|---|---|
| **ADS** | Automated Driving System. The technical term for the driving automation itself. "AV" is the loose everyday word for a vehicle that has one. |
| **CAD** | Computer-Aided Dispatch. Your incident system. Not computer-aided design. |
| **CAP** | Common Alerting Protocol. The standard XML format emergency alerts already travel in. |
| **Covered entity** | H.R. 10033's term for who carries the duty: the company operating the vehicles, or the manufacturer that sold them. |
| **EAS** | Emergency Alert System. The broadcast channel: radio, television, cable. |
| **Geofence notice** | A signed message telling automated vehicles to restrict operation in a defined area for a defined time. The thing this document is about. |
| **GFN** | Geofence Notice Specification. The draft proposed here. |
| **H.R. 10033** | The AV Emergency Response Coordination Act, introduced 3 August 2026. Would give you a 24/7 operator hotline and the authority to issue geofence notices. Not passed. |
| **IAFC** | International Association of Fire Chiefs. |
| **IPAWS** | Integrated Public Alert and Warning System. FEMA's national alert system. If your emergency manager sends alerts, this is what they send them through. |
| **NHTSA** | National Highway Traffic Safety Administration. The federal vehicle safety regulator. |
| **Registry** | The credential authority that would issue signing certificates to agencies, so a notice from your department is provably from your department. It does not exist yet, and that is the hardest open question. |
| **Tier** | The authority class of the issuing agency, which sets how long and how large a restriction it may impose. A fire department at an incident is Tier 1. |
| **WEA** | Wireless Emergency Alerts. The alerts that arrive on phones. |
| **WZDx** | Work Zone Data Exchange. A federal standard by which agencies already publish road closures to Google Maps, Waze and Apple Maps. The route for getting these notices to human drivers too. |

---

## Sources

- [San Francisco firefighters on robotaxi interference, SF Standard, 10 July 2026](https://sfstandard.com/2026/07/10/waymo-robotaxi-emergency-response/)
- [NHTSA statement to AV developers, 8 July 2026](https://www.nhtsa.gov/press-releases/av-developers-automated-vehicle-that-cannot-safely-interact-first-responders-danger)
- [Feds demand AV companies stop interfering with first responders, TechCrunch, 8 July 2026](https://techcrunch.com/2026/07/08/feds-demand-autonomous-vehicle-companies-stop-interfering-with-first-responders/)
- [Zoox recall over emergency response issues, Al Jazeera, 17 July 2026](https://www.aljazeera.com/news/2026/7/17/amazons-zoox-recalls-self-driving-vehicles-amid-emergency-response-issues)
- [H.R. 10033, AV Emergency Response Coordination Act, introduced 3 August 2026](https://www.govinfo.gov/bulkdata/BILLS/119/2/hr/BILLS-119hr10033ih.xml)
- [Rep. Mullin bill announcement, 28 July 2026](https://kevinmullin.house.gov/2026/07/28/rep-mullin-introduces-bill-to-standardize-autonomous-vehicles-protocol-during-emergencies/)
- [IAFC guidance on autonomous vehicles](https://www.iafc.org/topics-and-tools/resources/resource/autonomous-vehicles-(avs))
- [Common Alerting Protocol v1.2, OASIS](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html)

Full draft: `GFN-0.1-specification.md`. Demonstration console: `demo/dispatcher-console.html`. Security review: `SECURITY-REVIEW.md`.
