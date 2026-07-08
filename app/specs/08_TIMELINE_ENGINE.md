# Timeline Engine

## Timelines to Generate
The engine builds one Master Timeline per workspace always. Additional named timelines are declared by which modules a workspace has active, not hardcoded by the engine.

Illustrative, from Fatletic (brand-type workspace):
- Master Brand Timeline
- Logo Evolution Timeline
- Product Timeline
- Social Media Timeline
- Commercial Use Timeline
- Customer Use Timeline
- Trademark Timeline

A non-brand workspace (e.g. a personal knowledge vault) may only ever have the Master Timeline, or declare an entirely different named set.

## Timeline Event Fields
- Date
- Title
- Description
- Event type
- Supporting files
- Confidence score
- Verified/inferred status
- Notes

## Output
- MASTER_TIMELINE.md
- timeline.json
- Dashboard timeline view
