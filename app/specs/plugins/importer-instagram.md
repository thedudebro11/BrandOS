# Plugin: importer-instagram

**Type:** Importer
**Activates on:** `workspace.json` → `modules.instagram = true`
**Relocated from:** `app/specs/12_INSTAGRAM_ARCHIVE.md`

## Inputs
- Instagram data download ZIP
- Manual screenshots
- Downloaded reels/photos
- Caption exports

## Extract
- Post date
- Caption
- Media file
- Hashtags
- Visible brand name
- Product shown
- Customer/user shown if applicable
- Engagement stats if available

## Outputs
- `Instagram_Post_Index.csv`
- `Social_Media_Timeline.md`
- `Public_Use_Evidence.md`

## Important
Screenshots should be preserved, but original platform exports are stronger evidence when available.
