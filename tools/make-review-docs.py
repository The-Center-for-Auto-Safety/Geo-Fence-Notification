#!/usr/bin/env python3
"""Generate Word review copies from the markdown sources.

The markdown is the source of truth. These .docx files exist only to carry
reviewer comments back, and are discarded once the comments are extracted.
Run from the repository root:  python3 tools/make-review-docs.py
"""
import datetime, pathlib, subprocess, sys

DOCS = [
    ("EXECUTIVE-SUMMARY.md",     "Executive summary"),
    ("PROFILE-CALIFORNIA.md",    "California profile"),
    ("LOCATION-RESOLUTION.md",   "Location resolution rule"),
    ("REGISTRY-GOVERNANCE.md",   "Registry governance"),
    ("SECURITY-REVIEW.md",       "Security and safety review"),
    ("GFN-0.1-specification.md", "Specification v0.1"),
    ("MESSAGE-FLOW.md",          "Message flow"),
]

BANNER = """---
title: "{title}"
subtitle: "Geofence Notice Specification, review copy"
---

> **Review copy, {date}.** Generated from `{src}`. The markdown file in the
> repository is the source of truth; this copy exists only to carry your comments
> back and is discarded afterwards. Do not edit it as a document of record.
>
> **To comment:** select the text, then **Review > New Comment** and type. That is all
> that is needed. If your comment is about a numbered rule such as P-6 or R-12, you do
> not have to select anything precisely; quoting the number in the comment is enough.
>
> **To propose exact wording:** turn on **Review > Track Changes** and type the change
> directly into the text.
>
> **If you would rather not use Word at all:** reply by email quoting the rule number
> and what is wrong. "P-6, one hour is too short for a working structure fire" is a
> perfectly good review comment and will be treated the same way.

"""

def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    ref = root / "tools" / "reference.docx"
    outdir = root / "review-copies"
    outdir.mkdir(exist_ok=True)
    today = datetime.date.today().isoformat()
    made = []
    for src, title in DOCS:
        s = root / src
        if not s.exists():
            print(f"skip (missing): {src}"); continue
        body = BANNER.format(title=title, date=today, src=src) + s.read_text(encoding="utf-8")
        tmp = outdir / (s.stem + ".tmp.md")
        tmp.write_text(body, encoding="utf-8")
        dst = outdir / (s.stem + "-REVIEW.docx")
        # No --toc: Word leaves pandoc's TOC field unpopulated until the reader
        # updates it, which reads as a bug. These documents carry numbered
        # sections, and Word's navigation pane builds itself from the headings.
        cmd = ["pandoc", str(tmp), "-o", str(dst), "--from", "gfm+yaml_metadata_block",
               "--standalone"]
        if ref.exists():
            cmd += ["--reference-doc", str(ref)]
        subprocess.run(cmd, check=True)
        tmp.unlink()
        made.append(dst)
        print(f"wrote {dst.relative_to(root)}  ({dst.stat().st_size // 1024} KB)")
    print(f"\n{len(made)} review copies in {outdir.relative_to(root)}/")

if __name__ == "__main__":
    sys.exit(main())
