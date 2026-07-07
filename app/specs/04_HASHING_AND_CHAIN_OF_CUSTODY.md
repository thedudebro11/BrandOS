# Hashing and Chain of Custody

## Requirements
- Compute SHA-256 hash for every file.
- Store hash, timestamp, file path, file size.
- Re-hash on demand to verify no changes.
- Generate CHAIN_OF_CUSTODY.md.

## Chain of Custody Report Must Include
- Original path.
- Archive path.
- Import date.
- SHA-256 hash.
- Whether file was copied.
- Whether file was modified by system.

## Rule
Original files should be read-only from the system perspective.
