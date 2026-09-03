/* ------------------------------------------------------------------ *
 * Geofence Notice adoption briefing
 * Audience: fire, law enforcement, EMS and emergency management command
 * 12 slides, roughly 15 minutes.
 *
 * Palette: soot charcoal ground, apparatus red as the sharp accent for
 * anything the agency does, a cool slate teal for anything the machines
 * do. That opposition is the argument of the whole deck, so it is the
 * whole palette.
 *
 * Motif: the CAD log line. Every operational fact on these slides is a
 * dated entry from a real report, set in monospace, because that is the
 * form this audience already reads evidence in.
 * ------------------------------------------------------------------ */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const C = {
  ink:      "1C1A18",   // soot charcoal, the dark ground
  inkSoft:  "2A2622",
  paper:    "F7F5F2",   // warm off-white, the light ground
  paperAlt: "EDE9E4",
  agency:   "C1341C",   // apparatus red: the agency, used sparingly
  agencyLo: "F0DCD6",
  fleet:    "2E6E85",   // slate teal: the machines
  fleetLo:  "DCE7EB",
  warn:     "B07818",
  ok:       "44724A",
  onDark:   "F2EEE9",
  onDarkMu: "A79C90",
  onLight:  "22201D",
  onLightMu:"6B625A"
};

const F = { head: "Cambria", body: "Calibri", mono: "Courier New" };

const W = 13.333, H = 7.5, M = 0.62;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Geofence Notice Specification working draft";
pres.title = "Closing the Street to a Robotaxi";

const IMG = (f) => path.join(__dirname, f);

/* ---------- shared slide furniture -------------------------------- */

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: C.ink };
  return s;
}

function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  return s;
}

// eyebrow + title block, used on every content slide so the reader
// always knows where they are in the argument
function heading(s, eyebrow, title, dark) {
  s.addText(eyebrow.toUpperCase(), {
    x: M, y: 0.36, w: W - 2 * M, h: 0.26,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 2.2,
    color: dark ? C.agency : C.agency
  });
  s.addText(title, {
    x: M, y: 0.78, w: W - 2 * M, h: 0.92,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 34, bold: true,
    color: dark ? C.onDark : C.onLight
  });
}

function footnote(s, text, dark) {
  s.addText(text, {
    x: M, y: H - 0.62, w: W - 2 * M, h: 0.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 10,
    color: dark ? C.onDarkMu : C.onLightMu
  });
}

// A dated entry from a real report. The motif.
function logCard(s, x, y, w, h, stamp, headline, detail, opts) {
  opts = opts || {};
  s.addShape(pres.ShapeType.roundRect, {
    x: x, y: y, w: w, h: h, rectRadius: 0.06,
    fill: { color: opts.dark ? C.inkSoft : "FFFFFF" },
    line: { color: opts.dark ? "3A342E" : C.paperAlt, width: 1 },
    shadow: opts.dark ? undefined
      : { type: "outer", color: "9A9088", blur: 7, offset: 1, angle: 90, opacity: 0.16 }
  });
  s.addText(stamp, {
    x: x + 0.28, y: y + 0.2, w: w - 0.56, h: 0.24,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 10.5, bold: true, charSpacing: 1,
    color: C.agency
  });
  s.addText(headline, {
    x: x + 0.28, y: y + 0.46, w: w - 0.56, h: 0.42,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 15, bold: true,
    color: opts.dark ? C.onDark : C.onLight
  });
  s.addText(detail, {
    x: x + 0.28, y: y + 0.92, w: w - 0.56, h: h - 1.14,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 12.5, lineSpacing: 17,
    color: opts.dark ? C.onDarkMu : C.onLightMu
  });
}

/* ================================================================== *
 * 1. Title
 * ================================================================== */
{
  const s = darkSlide();

  s.addText("Closing the street\nto a robotaxi", {
    x: M, y: 1.72, w: 7.9, h: 2.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 52, bold: true, lineSpacing: 58,
    color: C.onDark
  });

  s.addText("A common format for geofence notices, so one message from your dispatcher reaches every automated vehicle operating in your jurisdiction.", {
    x: M, y: 4.18, w: 7.5, h: 1.0,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 17, lineSpacing: 26,
    color: C.onDarkMu
  });

  s.addText("Briefing for fire, law enforcement, EMS and emergency management command", {
    x: M, y: 5.42, w: 7.9, h: 0.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 13, color: C.onDark
  });
  s.addText("Draft for comment  ·  3 September 2026  ·  GFN v0.1", {
    x: M, y: 5.76, w: 7.9, h: 0.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 11.5, color: C.onDarkMu
  });

  // The single number that starts the conversation.
  s.addShape(pres.ShapeType.roundRect, {
    x: 9.05, y: 1.72, w: 3.68, h: 3.46, rectRadius: 0.08,
    fill: { color: C.agency }, line: { color: C.agency, width: 1 }
  });
  s.addText("31", {
    x: 9.05, y: 2.06, w: 3.68, h: 1.5,
    isTextBox: true, margin: 0, valign: "top", align: "center",
    fontFace: F.head, fontSize: 96, bold: true, color: "FFFFFF"
  });
  s.addText("reports filed by San Francisco\nfirefighters since April 2025,\ndocumenting robotaxis obstructing\nemergency operations", {
    x: 9.35, y: 3.62, w: 3.08, h: 1.3,
    isTextBox: true, margin: 0, valign: "top", align: "center",
    fontFace: F.body, fontSize: 12.5, lineSpacing: 17, color: "FFE7E1"
  });

  s.addNotes(
    "Open with the number, not the technology.\n\n" +
    "31 reports since April 2025, from one city's fire department. That is not a technology forecast, it is a filed record.\n\n" +
    "This briefing is about a proposed message format, not a product and not an adopted standard. Say that up front so nobody thinks they are being sold something.\n\n" +
    "Ask the room before you go on: how many of you have had an AV in the way of an apparatus placement in the last year?"
  );
}

/* ================================================================== *
 * 2. The problem, in their own reports
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "The problem", "It is already happening, and the workaround is manual");

  logCard(s, M, 1.94, 3.92, 2.42,
    "2025-12  ·  15TH STREET",
    "Engine blocked, stabbing call",
    "Crews knocked on the window for customer service. Remote repositioning failed. Firefighters operated the vehicle themselves and it malfunctioned in reverse. Fifteen minutes. Another crew arrived first.");

  logCard(s, M + 4.17, 1.94, 3.92, 2.42,
    "2026-02-21  ·  SANCHEZ ST",
    "Engine blocked, respiratory call",
    "A three-point turn put the vehicle across the engine's path. Clearing it took SFPD and a tow truck.");

  logCard(s, M + 8.34, 1.94, 3.92, 2.42,
    "2026-06-20  ·  FIRE GROUND",
    "Vehicle drove into heavy smoke",
    "An unoccupied vehicle entered an active fire scene obscured by smoke, braked hard, and stopped. It produced a 105-vehicle recall.");

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 4.66, w: W - 2 * M, h: 1.42, rectRadius: 0.07,
    fill: { color: C.agencyLo }, line: { color: "E2C4BB", width: 1 }
  });
  s.addText([
    { text: "The same lieutenant filed the same complaint about a vehicle blocking aerial positioning eleven months apart.", options: { bold: true, color: C.onLight } },
    { text: "  Nothing between those two reports changed the outcome. Separately, the department has responded to over 100 vehicle-initiated 911 calls to wake sleeping passengers.", options: { color: C.onLightMu } }
  ], {
    x: M + 0.34, y: 4.88, w: W - 2 * M - 0.68, h: 1.0,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14.5, lineSpacing: 21
  });

  footnote(s, "Source: San Francisco Standard, 10 July 2026, reviewing SFFD incident reports. Recall figure: NHTSA via Al Jazeera, 17 July 2026.");

  s.addNotes(
    "Three cards, three failure modes: the vehicle blocks and the remote fix does not work; the vehicle blocks and it takes police plus a tow; the vehicle drives itself into the hazard.\n\n" +
    "The bottom line is the one that should land. The same officer, the same complaint, eleven months apart. There was no mechanism to make the second one not happen.\n\n" +
    "If someone asks whether this is one city or one company: the NHTSA letter on the next slide calls it an industry-wide functional insufficiency, not a company problem."
  );
}

/* ================================================================== *
 * 3. Where things stand
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "Where things stand", "Washington has moved. The mechanism has not been written.");

  const events = [
    { d: "8 JUL 2026", t: "NHTSA calls it a functional insufficiency",
      b: "Administrator Morrison to AV developers: an automated vehicle that cannot safely interact with first responders is a danger to the general public. Remediation plans due in three weeks.", c: C.agency },
    { d: "17 JUL 2026", t: "First recall on emergency-response grounds",
      b: "105 vehicles recalled after one drove into a smoke-obscured fire ground.", c: C.warn },
    { d: "3 AUG 2026", t: "H.R. 10033 introduced",
      b: "The AV Emergency Response Coordination Act would give you a 24/7 hotline answered in 30 seconds, and the authority to issue a geofence notice that operators must comply with in 2 minutes.", c: C.fleet }
  ];

  let y = 2.02;
  events.forEach((e) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 0.02, y: y + 0.14, w: 0.3, h: 0.3,
      fill: { color: e.c }, line: { color: e.c, width: 1 }
    });
    s.addText(e.d, {
      x: M + 0.52, y: y + 0.11, w: 1.62, h: 0.28,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11.5, bold: true, color: e.c
    });
    s.addText(e.t, {
      x: M + 2.28, y: y + 0.04, w: 9.9, h: 0.42,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 19, bold: true, color: C.onLight
    });
    s.addText(e.b, {
      x: M + 2.28, y: y + 0.48, w: 9.9, h: 0.76,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13.5, lineSpacing: 19, color: C.onLightMu
    });
    y += 1.38;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 6.24, w: W - 2 * M, h: 0.64, rectRadius: 0.06,
    fill: { color: C.paperAlt }, line: { color: "DED8D1", width: 1 }
  });
  s.addText("The bill would give NHTSA two years to write the rules, and it has not passed. What happens in the meantime is being decided now.", {
    x: M + 0.3, y: 6.38, w: W - 2 * M - 0.6, h: 0.42,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, italic: true, color: C.onLight
  });

  footnote(s, "");

  s.addNotes(
    "The point of this slide is that the authority is arriving whether or not the fire service participates in shaping it.\n\n" +
    "H.R. 10033 is the important one. Read the two numbers out loud: hotline answered in 30 seconds, geofence notice complied with in 2 minutes. Those are real obligations on operators.\n\n" +
    "Note the bill was introduced 3 August 2026 and has not passed. Do not overstate it."
  );
}

/* ================================================================== *
 * 4. The gap
 * ================================================================== */
{
  const s = darkSlide();
  heading(s, "The gap", "The bill grants the authority. It does not say what a notice is.", true);

  s.addText("“a request issued by a first responder or other Federal, State, Tribal, or local government or agency to a covered entity to have its covered vehicles avoid a geographic area for up to 72 hours”", {
    x: M, y: 2.02, w: 7.5, h: 1.5,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 19, italic: true, lineSpacing: 28, color: C.onDark
  });
  s.addText("H.R. 10033, definition of “geofence notice”", {
    x: M, y: 3.6, w: 7.5, h: 0.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 11, color: C.onDarkMu
  });

  s.addText("That is the entire definition. It does not say what is in the message, how an operator knows it is really from you, what “avoid” requires a vehicle to do, or what happens to the vehicles already inside.\n\nEvery one of those is a question your incident commander will have to settle on scene, once per operator, unless somebody writes it down first.", {
    x: M, y: 4.22, w: 7.5, h: 2.0,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 15.5, lineSpacing: 23, color: C.onDarkMu
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 8.5, y: 2.02, w: 4.22, h: 3.5, rectRadius: 0.08,
    fill: { color: C.inkSoft }, line: { color: "3A342E", width: 1 }
  });
  s.addText("Without a defined message", {
    x: 8.8, y: 2.26, w: 3.62, h: 0.34,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 1.4, color: C.agency
  });
  s.addText([
    { text: "Every operator builds its own intake form.", options: { bullet: true, breakLine: true } },
    { text: "A battalion chief negotiates separately with every company running vehicles in the city.", options: { bullet: true, breakLine: true } },
    { text: "Each arrangement has a different contact, a different form, a different idea of what “avoid” means.", options: { bullet: true, breakLine: true } },
    { text: "At 04:00 on a working fire, that is a phone tree.", options: { bullet: true, bold: true } }
  ], {
    x: 8.8, y: 2.72, w: 3.62, h: 2.6,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 13.5, lineSpacing: 19, paraSpaceAfter: 9, color: C.onDark
  });

  footnote(s, "The IAFC's current guidance to chiefs is to study the federal strategy and read manufacturer response guides. Useful background. Not a mechanism.", true);

  s.addNotes(
    "This is the slide the whole briefing turns on. Slow down here.\n\n" +
    "The bill gives you authority. Authority without a defined message means every operator implements it differently, and the burden of reconciling that lands on the incident commander.\n\n" +
    "The footnote is worth reading aloud. The fire service's own guidance today is informational. Nobody has handed departments a mechanism."
  );
}

/* ================================================================== *
 * 5. What a notice is
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "The proposal", "One signed message. Five questions. Every operator.");

  const qs = [
    { k: "WHEN", t: "Start and end", b: "Every notice carries an end time. There is no open-ended form." },
    { k: "WHO", t: "Agency and authority", b: "Your agency, your incident number, your callback line. Signed, so it cannot be forged." },
    { k: "WHY", t: "Reason code", b: "Fire, crime scene, flooding, outage, evacuation, protective movement." },
    { k: "WHERE", t: "The boundary", b: "A polygon, a radius, or a corridor along a street. Drawn on a map, not described in words." },
    { k: "WHAT", t: "Required behavior", b: "Which restriction applies, and what a vehicle already inside must do." }
  ];

  const cw = (W - 2 * M - 4 * 0.22) / 5;
  qs.forEach((q, i) => {
    const x = M + i * (cw + 0.22);
    s.addShape(pres.ShapeType.roundRect, {
      x: x, y: 1.98, w: cw, h: 3.0, rectRadius: 0.07,
      fill: { color: "FFFFFF" }, line: { color: C.paperAlt, width: 1 },
      shadow: { type: "outer", color: "9A9088", blur: 7, offset: 1, angle: 90, opacity: 0.15 }
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.24, y: 2.24, w: 0.46, h: 0.46,
      fill: { color: C.fleetLo }, line: { color: C.fleetLo, width: 1 }
    });
    s.addText(String(i + 1), {
      x: x + 0.24, y: 2.29, w: 0.46, h: 0.36,
      isTextBox: true, margin: 0, valign: "top", align: "center",
      fontFace: F.head, fontSize: 16, bold: true, color: C.fleet
    });
    s.addText(q.k, {
      x: x + 0.24, y: 2.86, w: cw - 0.48, h: 0.28,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 1.6, color: C.agency
    });
    s.addText(q.t, {
      x: x + 0.24, y: 3.14, w: cw - 0.48, h: 0.6,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 16, bold: true, color: C.onLight
    });
    s.addText(q.b, {
      x: x + 0.24, y: 3.76, w: cw - 0.48, h: 1.0,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 12, lineSpacing: 16, color: C.onLightMu
    });
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.24, w: W - 2 * M, h: 1.0, rectRadius: 0.06,
    fill: { color: C.fleetLo }, line: { color: "C6D8DE", width: 1 }
  });
  s.addText("The same notice travels two ways: straight to operators over a direct connection, or through IPAWS as a CAP message, using the alerting tool your emergency manager already has.", {
    x: M + 0.34, y: 5.44, w: W - 2 * M - 0.68, h: 0.62,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, lineSpacing: 20, color: C.onLight
  });

  footnote(s, "");

  s.addNotes(
    "Five questions, in the order a dispatcher would ask them. Nothing here is exotic. It is the information you already put in a CAD entry.\n\n" +
    "The IPAWS point matters for small agencies. If your county already has an alert origination tool and a COG ID, you can issue one of these without any new credentialing process.\n\n" +
    "Do not get drawn into the data format on this slide. If someone asks, the answer is: it is JSON, and it also renders as CAP 1.2. Move on."
  );
}

/* ================================================================== *
 * 6. Graduated restriction
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "Design decision 1 of 4", "The restriction is graduated, not a switch");

  // Bar width encodes how much street the level takes away. The name rides
  // inside the bar; everything else sits in fixed columns, so a short bar
  // can never squeeze its own label.
  const COL_DESC = M + 5.0, COL_USE = M + 8.72;
  const levels = [
    { n: "PROHIBITED",    w: 4.62, c: C.agency,  t: "Do not enter, do not route through",   u: "Fire ground, active threat, collapse, flood water" },
    { n: "AVOID",         w: 3.96, c: "CD6A3E",  t: "Enter only if there is no alternative", u: "Congested perimeter, weather, utility work" },
    { n: "NO DRIVERLESS", w: 3.30, c: "C08A34",  t: "Safety operator aboard, or stay out",   u: "Signals dark, officers directing traffic" },
    { n: "NO STOP",       w: 2.64, c: "9A8A48",  t: "Drive through, do not stop or wait",    u: "Parade staging, motorcade, narrow work zone" },
    { n: "SPEED LIMITED", w: 1.98, c: "5C7C60",  t: "Reduced speed through the area",        u: "Debris field, degraded pavement" },
    { n: "NO PICKUPS",    w: 1.62, c: C.fleet,   t: "No passenger pickup or drop-off",       u: "Event egress, temporary curb conflict" }
  ];

  s.addText("HOW MUCH STREET IT TAKES", {
    x: M, y: 1.86, w: 4.62, h: 0.24,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 9.5, bold: true, charSpacing: 1.2, color: C.onLightMu
  });
  s.addText("WHAT THE VEHICLE MUST DO", {
    x: COL_DESC, y: 1.86, w: 3.5, h: 0.24,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 9.5, bold: true, charSpacing: 1.2, color: C.onLightMu
  });
  s.addText("TYPICAL USE", {
    x: COL_USE, y: 1.86, w: 3.4, h: 0.24,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 9.5, bold: true, charSpacing: 1.2, color: C.onLightMu
  });

  let y = 2.24;
  levels.forEach((l) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y, w: l.w, h: 0.5, rectRadius: 0.05,
      fill: { color: l.c }, line: { color: l.c, width: 1 }
    });
    s.addText(l.n, {
      x: M + 0.2, y: y + 0.12, w: l.w - 0.32, h: 0.3,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 0.6, color: "FFFFFF"
    });
    s.addText(l.t, {
      x: COL_DESC, y: y + 0.12, w: 3.5, h: 0.32,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13, color: C.onLight
    });
    s.addText(l.u, {
      x: COL_USE, y: y + 0.13, w: 3.4, h: 0.32,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 11.5, color: C.onLightMu
    });
    y += 0.62;
  });

  s.addText("Closing more street than the incident needs is not free. It pushes traffic onto residential blocks and strands riders who depend on the service. The format makes it easy to close exactly what you need, and no more.", {
    x: M, y: 6.22, w: W - 2 * M, h: 0.72,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, lineSpacing: 20, color: C.onLight
  });

  footnote(s, "");

  s.addNotes(
    "The bar widths encode severity. That is the whole visual.\n\n" +
    "The argument for a chief: a blanket no-vehicles rule is right for a fire ground and wrong for a parade route. If the only tool is total closure, people will either over-close, or stop using it.\n\n" +
    "NO DRIVERLESS is the interesting one for a signals-dark intersection where an officer is hand-directing traffic. A human in the vehicle can read a hand signal."
  );
}

/* ================================================================== *
 * 7. Three more guarantees
 * ================================================================== */
{
  const s = darkSlide();
  heading(s, "Design decisions 2, 3 and 4", "The three rules that protect your people", true);

  const cards = [
    { k: "EXIT, NEVER FREEZE", t: "Vehicles drive out, they do not stop where they stand",
      b: "The default instruction to a vehicle caught inside a new zone is to leave by the shortest lawful path without stopping. A vehicle that halts the instant a geofence turns on is a vehicle abandoned in a fire lane, which is the exact behavior NHTSA cited." },
    { k: "EVERY NOTICE EXPIRES", t: "The restriction lifts on its own",
      b: "There is no open-ended form. A stuck geofence fails silently: nothing alarms, service just quietly stops being available in a neighborhood. Extending takes one click. Forgetting cannot happen." },
    { k: "SAFETY OUTRANKS THE NOTICE", t: "It is a routing constraint, not a kill switch",
      b: "No notice can make a vehicle brake in a travel lane, reverse, make an illegal turn, or ignore an officer directing traffic. Your people on scene outrank the message. Nobody should ever sell this as remote control." }
  ];

  const cw = (W - 2 * M - 2 * 0.28) / 3;
  cards.forEach((c, i) => {
    const x = M + i * (cw + 0.28);
    s.addShape(pres.ShapeType.roundRect, {
      x: x, y: 2.0, w: cw, h: 3.72, rectRadius: 0.08,
      fill: { color: C.inkSoft }, line: { color: "3A342E", width: 1 }
    });
    s.addText(c.k, {
      x: x + 0.3, y: 2.26, w: cw - 0.6, h: 0.3,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 1.3, color: C.agency
    });
    s.addText(c.t, {
      x: x + 0.3, y: 2.62, w: cw - 0.6, h: 1.0,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 19, bold: true, lineSpacing: 25, color: C.onDark
    });
    s.addText(c.b, {
      x: x + 0.3, y: 3.68, w: cw - 0.6, h: 1.86,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13, lineSpacing: 19, color: C.onDarkMu
    });
  });

  s.addText("Together with graduated restriction, these are the four decisions that make the format safe to hand to an incident commander at 04:00.", {
    x: M, y: 6.02, w: W - 2 * M, h: 0.5,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, italic: true, color: C.onDarkMu
  });

  s.addNotes(
    "If you only have time for one card, use the first. Exit, never freeze.\n\n" +
    "The second card is the one that protects the public and your relationship with the city. A geofence nobody cancelled is a neighborhood quietly losing service, and nobody finds out for a week.\n\n" +
    "The third card is what you say when someone in the room asks whether this lets you shut down cars remotely. It does not, deliberately, and that is a feature. An advisory that never causes an unsafe maneuver is a thing an operator can accept immediately."
  );
}

/* ================================================================== *
 * 8. What it looks like
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "In practice", "A dispatcher draws the zone and issues it in under a minute");

  s.addImage({
    path: IMG("console-map.png"),
    x: M, y: 1.94, w: 8.05, h: 4.42,
    sizing: { type: "contain", w: 8.05, h: 4.42 }
  });

  const steps = [
    { t: "0:00", b: "Draw the zone on the map. The console will not let you issue one that breaks a duration or area limit." },
    { t: "0:15", b: "Every operator acknowledges, and reports how many of their vehicles are inside." },
    { t: "0:30", b: "Routing is updated. No new vehicles enter." },
    { t: "5:00", b: "Vehicles already inside are out. Any that cannot move are reported by exception on the hotline." },
    { t: "4:00:00", b: "The restriction expires by itself unless the incident commander extends it." }
  ];

  let y = 2.02;
  steps.forEach((st) => {
    s.addText(st.t, {
      x: 8.98, y: y, w: 0.98, h: 0.3,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 12, bold: true, color: C.agency
    });
    s.addText(st.b, {
      x: 10.02, y: y - 0.02, w: 2.72, h: 0.86,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 12, lineSpacing: 16, color: C.onLightMu
    });
    y += 0.88;
  });

  footnote(s, "Working demonstration console. The fleet, the acknowledgements and the signature are simulated; the notice it produces is real and validates against the specification.");

  s.addNotes(
    "Show, do not describe. If you have a laptop, open the console and draw a zone live instead of using this slide. It takes about twenty seconds.\n\n" +
    "The timings on the right come from the specification's latency budget for a life-safety notice.\n\n" +
    "Point at the red vehicle in the map if it is visible: that is one that got boxed in by apparatus and could not leave. The format has a way to report that by exception rather than pretending the zone is clear."
  );
}

/* ================================================================== *
 * 9. What adoption takes
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "Adoption", "Four things a department needs");

  const items = [
    { n: "1", t: "A credential", b: "A signing certificate, so a notice from your agency is provably yours and a forged one is not. Who runs that registry is the hardest unsolved question in the draft.", flag: true },
    { n: "2", t: "An authorized issuer", b: "Incident commander, watch commander or dispatch supervisor, per your policy. The format assumes an incident number and a staffed callback line. You already have both." },
    { n: "3", t: "A way to draw the zone", b: "A CAD integration, or the standalone console. Nothing to install and no network dependency beyond reaching the operators." },
    { n: "4", t: "Standing policy on levels", b: "The format supplies the vocabulary. Deciding that a working structure fire gets PROHIBITED and a fender bender gets AVOID is a local command decision, made before the incident." }
  ];

  const cw = (W - 2 * M - 3 * 0.26) / 4;
  items.forEach((it, i) => {
    const x = M + i * (cw + 0.26);
    s.addShape(pres.ShapeType.roundRect, {
      x: x, y: 1.98, w: cw, h: 3.46, rectRadius: 0.07,
      fill: { color: "FFFFFF" },
      line: { color: it.flag ? C.agency : C.paperAlt, width: it.flag ? 2 : 1 },
      shadow: { type: "outer", color: "9A9088", blur: 7, offset: 1, angle: 90, opacity: 0.15 }
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.28, y: 2.24, w: 0.5, h: 0.5,
      fill: { color: it.flag ? C.agency : C.fleet }, line: { color: it.flag ? C.agency : C.fleet, width: 1 }
    });
    s.addText(it.n, {
      x: x + 0.28, y: 2.3, w: 0.5, h: 0.38,
      isTextBox: true, margin: 0, valign: "top", align: "center",
      fontFace: F.head, fontSize: 18, bold: true, color: "FFFFFF"
    });
    s.addText(it.t, {
      x: x + 0.28, y: 2.92, w: cw - 0.56, h: 0.64,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 18, bold: true, color: C.onLight
    });
    s.addText(it.b, {
      x: x + 0.28, y: 3.62, w: cw - 0.56, h: 1.68,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 12.5, lineSpacing: 17, color: C.onLightMu
    });
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.68, w: W - 2 * M, h: 0.9, rectRadius: 0.06,
    fill: { color: C.agencyLo }, line: { color: "E2C4BB", width: 1 }
  });
  s.addText([
    { text: "Item 1 is not solved. ", options: { bold: true, color: C.onLight } },
    { text: "If the fire service does not say who should issue these credentials, and how a twelve-person rural department gets one, that decision will be made without you.", options: { color: C.onLight } }
  ], {
    x: M + 0.34, y: 5.86, w: W - 2 * M - 0.68, h: 0.56,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14.5, lineSpacing: 20
  });

  footnote(s, "");

  s.addNotes(
    "Three of the four are things a department already has or can decide locally in an afternoon. The first one is the real work.\n\n" +
    "Card 1 is outlined in red on purpose. Registry governance is genuinely unsolved and it is the piece where public safety input matters most and is currently absent.\n\n" +
    "If someone asks who pays: nobody has costed this. Say so."
  );
}

/* ================================================================== *
 * 10. Where the draft and the bill differ
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "Honesty slide", "Where this draft is tighter than the bill would allow");

  const cols = [3.6, 4.1, 4.19];
  const x0 = M, x1 = M + cols[0] + 0.16, x2 = M + cols[0] + cols[1] + 0.32;

  const hdr = [["", x0, cols[0]], ["H.R. 10033 would permit", x1, cols[1]], ["This draft sets", x2, cols[2]]];
  hdr.forEach(([t, x, w]) => {
    if (!t) return;
    s.addText(t, {
      x: x + 0.24, y: 2.02, w: w - 0.48, h: 0.3,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11, bold: true, charSpacing: 1.3,
      color: x === x1 ? C.fleet : C.agency
    });
  });

  const rows = [
    { k: "Maximum duration", a: "Up to 72 hours", b: "4 hours for a fire or police incident, 24 hours cumulative. 72 hours only for planned infrastructure work." },
    { k: "Compliance timing", a: "Within 2 minutes", b: "Acknowledge in 15 seconds, routing updated in 30 seconds, vehicles clear of the zone in 5 minutes." },
    { k: "Who may issue", a: "Any first responder or government agency", b: "Tiered by agency type, with duration and area ceilings that scale with the authority." }
  ];

  let y = 2.44;
  rows.forEach((r, i) => {
    if (i % 2 === 0) {
      s.addShape(pres.ShapeType.roundRect, {
        x: M, y: y, w: W - 2 * M, h: 1.06, rectRadius: 0.05,
        fill: { color: C.paperAlt }, line: { color: C.paperAlt, width: 1 }
      });
    }
    s.addText(r.k, {
      x: x0 + 0.24, y: y + 0.2, w: cols[0] - 0.48, h: 0.66,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 16, bold: true, color: C.onLight
    });
    s.addText(r.a, {
      x: x1 + 0.24, y: y + 0.2, w: cols[1] - 0.48, h: 0.66,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13.5, lineSpacing: 18, color: C.onLightMu
    });
    s.addText(r.b, {
      x: x2 + 0.24, y: y + 0.2, w: cols[2] - 0.48, h: 0.66,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13.5, lineSpacing: 18, color: C.onLight
    });
    y += 1.14;
  });

  s.addText([
    { text: "A four-hour ceiling is not a limit on your authority. ", options: { bold: true } },
    { text: "It is a forcing function that makes someone look at the zone again while the incident is still live. Extending is one click. Forgetting is the failure the ceiling prevents.", options: {} }
  ], {
    x: M, y: 5.98, w: 8.3, h: 0.9,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, lineSpacing: 20, color: C.onLight
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 9.1, y: 5.9, w: 3.62, h: 1.0, rectRadius: 0.06,
    fill: { color: C.agencyLo }, line: { color: "E2C4BB", width: 1 }
  });
  s.addText("Compliance timing is the one place this draft may need to move toward the bill.", {
    x: 9.34, y: 6.06, w: 3.14, h: 0.7,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 12.5, lineSpacing: 17, color: C.onLight
  });

  footnote(s, "");

  s.addNotes(
    "Put this slide in deliberately. A room of chiefs will assume anything technical is overselling itself, and the fastest way past that is to volunteer where the draft disagrees with the statute.\n\n" +
    "The 4 hours versus 72 hours gap is the one people will push on. The answer: the bill sets an outer ceiling, the draft sets working limits inside it, and the working limits are a proposal you can argue with.\n\n" +
    "Comply in 2 minutes versus clear the zone in 5 minutes are not the same claim. The draft should say which it means, and currently it does not. That is a genuine open item, not a rhetorical concession."
  );
}

/* ================================================================== *
 * 11. What this is not
 * ================================================================== */
{
  const s = darkSlide();
  heading(s, "Scope", "What this is, and what it is not", true);

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 2.06, w: 5.95, h: 3.5, rectRadius: 0.08,
    fill: { color: C.inkSoft }, line: { color: C.ok, width: 2 }
  });
  s.addText("IT IS", {
    x: M + 0.34, y: 2.34, w: 5.27, h: 0.32,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 12, bold: true, charSpacing: 1.6, color: C.ok
  });
  s.addText([
    { text: "A draft technical specification, complete enough to implement.", options: { bullet: true, breakLine: true } },
    { text: "The message format, the rules, a working console, and a validator.", options: { bullet: true, breakLine: true } },
    { text: "Through one adversarial security and safety review, which found eighteen significant defects. All are fixed and covered by regression tests.", options: { bullet: true, breakLine: true } },
    { text: "Open for comment, and expected to change.", options: { bullet: true } }
  ], {
    x: M + 0.34, y: 2.8, w: 5.27, h: 2.5,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, lineSpacing: 20, paraSpaceAfter: 10, color: C.onDark
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M + 6.15, y: 2.06, w: 5.95, h: 3.5, rectRadius: 0.08,
    fill: { color: C.inkSoft }, line: { color: C.agency, width: 2 }
  });
  s.addText("IT IS NOT", {
    x: M + 6.49, y: 2.34, w: 5.27, h: 0.32,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 12, bold: true, charSpacing: 1.6, color: C.agency
  });
  s.addText([
    { text: "An adopted standard. No standards body has taken it up.", options: { bullet: true, breakLine: true } },
    { text: "A product. There is nothing to buy and nothing to install.", options: { bullet: true, breakLine: true } },
    { text: "Agreed by anyone. No AV operator has committed to accept these notices.", options: { bullet: true, breakLine: true } },
    { text: "Remote control. It cannot stop, steer or disable a vehicle, by design.", options: { bullet: true } }
  ], {
    x: M + 6.49, y: 2.8, w: 5.27, h: 2.5,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14, lineSpacing: 20, paraSpaceAfter: 10, color: C.onDark
  });

  s.addText("The credential registry, which everything else depends on, does not exist yet.", {
    x: M, y: 5.92, w: W - 2 * M, h: 0.5,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 17, italic: true, color: C.onDarkMu
  });

  s.addNotes(
    "Say this slide plainly and do not soften it. A command audience has been pitched vaporware before and will be listening for it.\n\n" +
    "The eighteen defects line is a credibility point, not a confession. A draft that has been attacked and repaired is worth more than one that has not.\n\n" +
    "If the room's takeaway is only that geofence notices need a common format and public safety should shape it, the briefing has done its job."
  );
}

/* ================================================================== *
 * 12. The ask
 * ================================================================== */
{
  const s = darkSlide();

  s.addText("THE ASK", {
    x: M, y: 0.36, w: W - 2 * M, h: 0.3,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.mono, fontSize: 12, bold: true, charSpacing: 2.2, color: C.agency
  });
  s.addText("Four things, none of which cost money", {
    x: M, y: 0.78, w: W - 2 * M, h: 0.7,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.head, fontSize: 36, bold: true, color: C.onDark
  });

  const asks = [
    { n: "01", t: "Read it and push back", b: "Particularly the duration and area ceilings. Those numbers were set by reasoning about failure modes, not by anyone who has run a fire ground." },
    { n: "02", t: "Run a tabletop", b: "Take a real incident from your records, draw the zone in the console, and tell us where the format gets in the way." },
    { n: "03", t: "Take a position on the registry", b: "Who issues the credentials, and how a small department gets one. This is the decision most likely to be made without you." },
    { n: "04", t: "Back a common format", b: "The alternative is a separate bespoke arrangement with every operator, renegotiated each time a new one enters your city." }
  ];

  let y = 1.98;
  asks.forEach((a) => {
    s.addText(a.n, {
      x: M, y: y, w: 0.86, h: 0.44,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 17, bold: true, color: C.agency
    });
    s.addText(a.t, {
      x: M + 0.98, y: y - 0.04, w: 4.0, h: 0.44,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.head, fontSize: 20, bold: true, color: C.onDark
    });
    s.addText(a.b, {
      x: M + 5.1, y: y - 0.02, w: 7.0, h: 0.86,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 13.5, lineSpacing: 19, color: C.onDarkMu
    });
    y += 1.06;
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 6.24, w: W - 2 * M, h: 0.68, rectRadius: 0.06,
    fill: { color: C.inkSoft }, line: { color: "3A342E", width: 1 }
  });
  s.addText("Federal rules are at least two years away, and only if the bill passes. The window to shape what a geofence notice means is open now.", {
    x: M + 0.34, y: 6.4, w: W - 2 * M - 0.68, h: 0.46,
    isTextBox: true, margin: 0, valign: "top",
    fontFace: F.body, fontSize: 14.5, color: C.onDark
  });

  s.addNotes(
    "Close on the timing. Two years of rulemaking sounds slow, but the practices that get written into that rule are being set now by whoever shows up.\n\n" +
    "Concrete next step to offer the room: a one-hour tabletop with a real incident from their own records. That is the smallest useful commitment and it produces the feedback the draft actually needs.\n\n" +
    "Leave behind: the executive summary, the draft specification, and the console."
  );
}

/* ================================================================== *
 * 13. Glossary, a leave-behind reference slide
 * ================================================================== */
{
  const s = lightSlide();
  heading(s, "Reference", "The acronyms, in plain words");

  const terms = [
    ["ADS", "Automated Driving System. The driving automation itself. \u201cAV\u201d is the everyday word for a vehicle that has one."],
    ["CAD", "Computer-Aided Dispatch. Your incident system, and where the incident number comes from."],
    ["CAP", "Common Alerting Protocol. The standard format emergency alerts already travel in."],
    ["Covered entity", "H.R. 10033's term for who carries the duty: the company operating the vehicles, or the manufacturer that sold them."],
    ["Geofence notice", "A signed message telling automated vehicles to restrict operation in a defined area for a defined time."],
    ["H.R. 10033", "The AV Emergency Response Coordination Act, introduced 3 August 2026. Not passed."],
    ["IPAWS", "FEMA's national alert system. What your emergency manager sends alerts through."],
    ["NHTSA", "National Highway Traffic Safety Administration. The federal vehicle safety regulator."],
    ["Registry", "The credential authority that would issue signing certificates to agencies. Does not exist yet."],
    ["Tier", "The authority class of the issuing agency, setting how long and how large a restriction it may impose."],
    ["WEA / EAS", "Wireless Emergency Alerts to phones, and the Emergency Alert System on broadcast."],
    ["WZDx", "Work Zone Data Exchange. How agencies already publish closures to Google Maps, Waze and Apple Maps."]
  ];

  const colW = (W - 2 * M - 0.5) / 2;
  terms.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (colW + 0.5);
    const y = 1.9 + row * 0.79;
    s.addText(t[0], {
      x: x, y: y, w: 1.72, h: 0.36,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.mono, fontSize: 11.5, bold: true, color: C.agency
    });
    s.addText(t[1], {
      x: x + 1.8, y: y - 0.02, w: colW - 1.8, h: 0.74,
      isTextBox: true, margin: 0, valign: "top",
      fontFace: F.body, fontSize: 11.5, lineSpacing: 15, color: C.onLightMu
    });
  });

  s.addNotes(
    "A leave-behind, not a slide to read out. Skip it in the room.\n\n" +
    "Useful if someone takes the deck away and circulates it, which is the most likely thing to happen to it.\n\n" +
    "The two worth saying aloud if they come up: covered entity is the bill's term and it covers manufacturers as well as fleet operators, which is what makes privately owned vehicles work. And the registry is the piece that does not exist."
  );
}

/* ------------------------------------------------------------------ */

const out = path.join(__dirname, "GFN-first-responder-briefing.pptx");
pres.writeFile({ fileName: out }).then(() => console.log("wrote", out));
