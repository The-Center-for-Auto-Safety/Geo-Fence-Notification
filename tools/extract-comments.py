#!/usr/bin/env python3
"""Pull reviewer comments out of a Word review copy and key them to rule IDs.

Reads word/comments.xml for the comment bodies (author, date, text) and
word/document.xml for the text each comment is anchored to, then walks
backwards from the anchor to the nearest rule ID (P-6, R-12, G4, section 5.3)
so every comment lands somewhere specific in the markdown source.
"""
import re, sys, zipfile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ID_PAT = re.compile(r"\b((?:P|R|G|L|C|H|M)-?\d{1,2}|\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\b")

def text_of(el):
    import xml.etree.ElementTree as ET
    return "".join(t.text or "" for t in el.iter(W + "t"))

def extract(path):
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(path)
    names = set(z.namelist())
    if "word/comments.xml" not in names:
        return []
    bodies = {}
    for c in ET.fromstring(z.read("word/comments.xml")):
        bodies[c.get(W + "id")] = {
            "author": c.get(W + "author") or "unknown",
            "initials": c.get(W + "initials") or "",
            "date": (c.get(W + "date") or "")[:10],
            "comment": " ".join(text_of(c).split()),
        }
    doc = ET.fromstring(z.read("word/document.xml"))
    out, seen_id = [], None
    open_ranges = {}
    for para in doc.iter(W + "p"):
        ptext = " ".join(text_of(para).split())
        m = ID_PAT.search(ptext[:40])
        if m:
            seen_id = m.group(1)
        for el in para.iter():
            tag = el.tag
            if tag == W + "commentRangeStart":
                open_ranges[el.get(W + "id")] = []
            elif tag == W + "commentRangeEnd":
                cid = el.get(W + "id")
                if cid in bodies:
                    rec = dict(bodies[cid])
                    rec["anchor"] = ptext[:160]
                    rec["rule"] = seen_id or "(no id)"
                    out.append(rec)
                open_ranges.pop(cid, None)
    return out

if __name__ == "__main__":
    rows = []
    for p in sys.argv[1:]:
        for r in extract(p):
            r["file"] = p
            rows.append(r)
    if not rows:
        print("no comments found"); sys.exit(0)
    rows.sort(key=lambda r: (r["rule"], r["author"]))
    for r in rows:
        print(f"[{r['rule']}] {r['author']} ({r['date']})")
        print(f"    on: {r['anchor'][:110]}")
        print(f"    >>  {r['comment']}\n")
