# Action needed: add the real OFL.txt

This directory ships the Bender font (`Jovanny Lemonad` foundry), used under the SIL Open Font License (OFL) 1.1 - confirmed permissive for commercial/embedded use.

**This file is a placeholder.** An attempt to fetch the exact, verbatim OFL 1.1 legal text automatically (via `https://scripts.sil.org/OFL` → redirects to `https://openfontlicense.org/`) only returned a paraphrased summary, not byte-accurate legal text - bundling a paraphrase as a license file would be worse than not bundling one, so it was deliberately not written here.

**To complete this:**

1. Download the official plaintext file directly from either:
   - `https://openfontlicense.org/open-font-license-official-text/` (has direct download links for `OFL.txt`)
   - Or copy `OFL.txt` from any Google Fonts family already using OFL (e.g. any font in the `google/fonts` GitHub repo ships one alongside it) - they're all the same canonical 1.1 text.
2. Save it as `src/app/fonts/bender/OFL.txt` in this directory.
3. Delete this `LICENSE-TODO.md` file once `OFL.txt` is in place.

No code in this project depends on `OFL.txt` existing - this is a provenance/compliance step, not a build dependency.
