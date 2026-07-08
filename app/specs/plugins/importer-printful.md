# Plugin: importer-printful

**Type:** Importer
**Activates on:** `workspace.json` → `modules.printful = true`
**Relocated from:** `app/specs/13_PRINTFUL_IMPORTER.md`

## Inputs
- Printful order exports
- Invoices
- Packing slips
- Product mockups
- Shipping records
- Emails/screenshots

## Extract
- Order number
- Order date
- Product title
- Design/artwork used
- Shipping date
- Delivery date
- Recipient/customer if available
- Amount paid if available

## Outputs
- `Printful_Order_Index.csv`
- `Sales_Timeline.md`
- `First_Commercial_Use.md`
