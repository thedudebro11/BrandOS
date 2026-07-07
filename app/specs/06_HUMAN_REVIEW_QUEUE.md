# Human Review Queue

## Purpose
The system must notify the user whenever it cannot confidently classify or connect a file.

## Required Output
Human_Review_Queue.md with:
- File path
- Preview thumbnail if possible
- Current classification
- Confidence score
- Reason for uncertainty
- Suggested classifications
- Questions for user
- Recommended action

## Examples
- Unsure whether image is customer photo or owner photo.
- Logo visible but too small to confirm.
- File date conflicts with claimed timeline.
- Screenshot lacks visible date.
