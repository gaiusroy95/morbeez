# WhatsApp Broadcast Module — Role Guide

## Office staff (`operations` read/write)

- Use **Broadcast Hub** (`/broadcasts`) to create ad-hoc campaigns, preview audience reach, and schedule sends.
- Draft campaigns, insert dynamic variables (`{{FarmerName}}`, `{{Crop}}`, `{{DAP}}`, etc.), and submit for approval when required.
- View **Sent** and **Analytics** for delivery outcomes; export CSV from the sent log.

## Agronomists / field leads

- Prefer **Automation** (`/broadcasts/automation`) for DAP/weekday rules tied to crop calendars.
- Maintain **Templates** for crop × DAP copy; office staff clone approved templates into campaigns.
- Do not change throttle limits or provider config — those live in Operations **Messaging** tab.

## Super Admin

- **Broadcast Admin** (`/broadcasts/admin`): approve/reject campaigns and templates, manage full rule editor (weekday, DAP range, tolerance).
- Run dry-run automation from Automation page before enabling new rules.
- Configure Meta language templates under Operations → Language templates for out-of-window sends.
