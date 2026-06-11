# Farmer ROI v1.0 — Architecture Rules

## Concepts

| Term | Storage | Meaning |
|------|---------|---------|
| **Block** | `farm_blocks` | Physical plot (name, crop, acreage, planting date) |
| **Crop cycle** | `crop_seasons` | One growing season on a block (active → archived) |
| **Transaction** | `farmer_roi_entries` | Expense (debit) or income (credit) |
| **Harvest sale** | `harvest_records` + income entry | Repeatable; does **not** close the cycle |
| **Finish cycle** | `POST …/season/:id/finish` | Archives season only; no auto-new season |

## Rollup scope

- Default dashboard aggregates **active seasons** only.
- Filters: All crops + All blocks = farm ROI; Crop + All blocks = crop ROI; Crop + Block = single cycle.

## Smart visibility

- `showCropFilter` when farmer has >1 distinct crop across blocks.
- `showBlockFilter` when farmer has >1 block.
- `showExpenseBook` when crop count >1 OR block count >1.

## Financial honesty

- Always show expense and income.
- Show profit and ROI **only when** `incomeInr > 0`.

## APIs (mobile)

| Endpoint | Purpose |
|----------|---------|
| `GET /roi/summary` | Dashboard with filters + visibility |
| `GET /roi/context` | Form defaults (crop, block, season, categories) |
| `POST /roi/harvest-sale` | Record harvest income; season stays active |
| `POST /roi/season/:id/finish` | Archive cycle |
| `POST /roi/season/start` | Start new cycle on a block |
| `GET /roi/transactions` | Unified ledger |
| `GET /roi/expense-book` | Category-grouped expenses |
| `GET /roi/analytics` | Breakdown + trends |
| `POST /roi/categories` | Farmer custom category |
