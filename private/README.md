# private/ — owner-only, not committed

This directory is **git-ignored** by `.gitignore`. Anything you place here
(other than this README and `.gitkeep`) stays on your local machine and is
**never pushed** to GitHub.

## Recommended contents

- `partners.txt` — plaintext mapping of donor email → date/Cash.App note.
  Use this as your private ledger of who donated, what they paid, and
  which hashed entry in `assets/data/partners.json` corresponds to them.

  Example format (one per line):

  ```
  alice@example.com   2026-05-01   $50   note:"alice@example.com"
  bob@partner.io      2026-05-02   $250  note:"bob@partner.io"
  ```

- Any other notes, secrets, or scratch files you don't want published.

## How partner access works

1. Donor sends payment to **https://Cash.App/$dascient** and writes their
   email address in the Cash.App note.
2. You receive the donation, copy the email from the note, and add it to
   your local `private/partners.txt` (this file).
3. You compute the SHA-256 hash of the normalized (trimmed, lowercased)
   email and append it to the public allowlist
   `assets/data/partners.json`. For example:

   ```sh
   printf '%s' "alice@example.com" | sha256sum
   # → 2bd806c97f0e00af1a1fc3328fa763a9269723c8db8fac4f93af71db186d6e90
   ```

   Then commit/push the updated `assets/data/partners.json`. GitHub Pages
   will serve the new list, and the donor can immediately unlock partner
   access from the **Partner Access Required** modal by entering the
   email they used in the Cash.App note.

Plaintext emails are **never** published to the public site or repo —
only the irreversible SHA-256 hashes are.
