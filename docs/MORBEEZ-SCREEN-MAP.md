# Morbeez AI OS — Screen Map

Maps master-list screens to staff console routes (post enterprise plan).

## Module A — Visit Intelligence

| Screen | Route |
|--------|-------|
| Visit command center | `/agronomist/visit-command` |
| Visit wizard (18 steps) | `/agronomist/visit` |
| Agronomist operations | `/agronomist` |
| Visit detail | `/agronomist/visits/:findingId` |
| Route planner | `/agronomist/routes` |
| Farmer map | `/agronomist/map` |

## Module B — Farmer CRM

| Screen | Route |
|--------|-------|
| Telecaller CRM | `/telecaller` |
| Farmer 360 | `/farmers/:farmerId/360` |
| Opportunity dashboard | `/opportunity` |

## Module C — Plot Intelligence

| Screen | Route |
|--------|-------|
| Plot intelligence | `/plot-intelligence/:farmerId/:blockId` |
| Block workspace (CRM) | `/telecaller` (block tab) |

## Module D/E — AI Diagnosis & Training

| Screen | Route |
|--------|-------|
| AI review center | `/agronomist/ai-review` |
| Weakness dashboard | `/ai-ops/weakness` |
| Retraining ops | `/ai-ops/retraining` |
| Training export | `/agronomist/ai-review` (tab) |

## Module F/G — Recommendation & Protocol

| Screen | Route |
|--------|-------|
| Product gaps | `/product-gaps` |
| Resistance intelligence | `/intelligence/resistance` |
| Protocol builder | `/intelligence?tab=protocols` |
| Outcome intelligence | `/agronomist/outcome-intelligence` |

## Module H — Admin Intelligence

| Screen | Route |
|--------|-------|
| Executive cockpit | `/executive` |
| Analytics hub | `/analytics` |
| Economic dashboard | `/analytics/economics` |
| Escalation command | `/escalations` |
| Regional threat radar | `/operations/regional-threat-radar` |

## Module I — Copilot

| Screen | Route |
|--------|-------|
| Similar cases explorer | `/copilot/similar-cases` |
| Knowledge explorer | `/copilot/knowledge` |
| Copilot (embedded) | Case review panel |
