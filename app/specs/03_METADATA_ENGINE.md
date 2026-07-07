# Metadata Engine

## Extract
- File system dates.
- EXIF/IPTC/XMP for images.
- Dimensions and color profile.
- Video duration, codec, resolution, frame rate.
- PDF page count and text.
- Text document contents.
- PSD/XCF metadata when possible.
- Screenshot OCR when enabled.

## Store
All metadata goes into SQLite and exportable JSON.

## Confidence
Metadata directly read from the file receives high confidence. AI-inferred metadata must be labeled as inferred.
