-- Morbeez: full transactional reset for re-testing.
-- Wipes farmers, CRM, AI, WhatsApp sessions, orders, warehouse ops, partners, etc.
--
-- PRESERVED (Morbeez employee database — not deleted):
--   admin_users, role_module_permissions, admin_password_reset_tokens
--   employee_profiles, employee_compensation, employee_attendance_rules, employee_access_tokens
--   attendance_daily, attendance_monthly_summary, activity_evidence_logs
--   payroll_cycles, payroll_entries, payroll_pdfs, payout_delivery_logs
--   employee_sales_ledger, employee_performance_snapshots, employee_monthly_kpi_scores
--   employee_quarterly_bonuses, employee_farmer_attribution, employee_scores, employee_score_history
--   bulk_margin_review_requests, reassignment_runs, reassignment_decisions, reassignment_transfers
--   commission_master, call_qc_rubric, staff_otp_challenges
--
-- PRESERVED (product & inventory database — not deleted):
--   product_intelligence, product_pack_sizes, product_pricing_tiers, product_gap_queue
--   commerce_combos, commerce_offers, commerce_coupons, commerce_flash_sales, commerce_banners
--   spray_compatibility_rules, resistance_rotation_groups, recommendation_templates
--   packaging_categories, packaging_settings, package_rules, shipping_boxes
--   inventory_items, inventory_batches, commerce_stock_batches, stock_movements
--   goods_receipts, purchase_orders, purchase_order_lines, pricing_engine_config
--   warehouses, warehouse_locations, suppliers
--
-- PRESERVED (reference / config — not deleted):
--   crm_masters, pincode_master, company_settings, crop_packs, issue_master, cultivation_task_master
--   whatsapp_quick_replies, whatsapp_language_templates, whatsapp_template_definitions
--   whatsapp_broadcast_templates, field_activity_types
--   crop_markets, markets, market_historical_prices, seo_* content tables, translation_dictionary
--
-- Run in Supabase Dashboard → SQL Editor, or:
--   npm run db:reset-retest -- --confirm
--
-- Requires explicit confirmation flag on the npm script (never run blindly in production).

BEGIN;

-- ─── Partner / commission events ───────────────────────────
DELETE FROM partner_certification_attempts;
DELETE FROM partner_training_progress;
DELETE FROM partner_events;
DELETE FROM partner_earnings_ledger;
DELETE FROM partner_payout_batches;
DELETE FROM partner_lead_allocations;
DELETE FROM partner_reliability_signals;
DELETE FROM partner_reliability_scores;
DELETE FROM partner_kpi_snapshots;
DELETE FROM partner_farmer_attribution;
DELETE FROM partner_status_history;
DELETE FROM partner_otp_challenges;
DELETE FROM partner_applications;
DELETE FROM partners;
DELETE FROM farmer_ownership_history;
DELETE FROM sales_opportunities;

-- ─── WMS / fulfillment (order-linked; product catalog preserved above) ─
DELETE FROM pack_scan_logs;
DELETE FROM pack_sessions;
DELETE FROM pick_list_lines;
DELETE FROM pick_lists;
DELETE FROM pick_waves;
DELETE FROM order_line_allocations;
DELETE FROM commerce_order_lines;
DELETE FROM shipping_labels;
DELETE FROM warehouse_label_batches;
DELETE FROM invoice_lines;
DELETE FROM invoices;
DELETE FROM shipment_exceptions;
DELETE FROM cod_reconciliation;
DELETE FROM finance_daily_snapshots;
DELETE FROM order_packages;
DELETE FROM courier_payloads;
DELETE FROM dispatch_sessions;
DELETE FROM return_requests;

-- ─── Commerce orders (not product catalog) ───────────────
DELETE FROM farmer_product_reviews;
DELETE FROM commerce_quotes;
DELETE FROM payment_events;
DELETE FROM shipment_events;
DELETE FROM checkout_sessions;
DELETE FROM commerce_orders;

-- ─── Visit AI / field findings v2 ──────────────────────────
DELETE FROM visit_ai_evidence_requests;
DELETE FROM visit_ai_recommendations;
DELETE FROM visit_ai_questions;
DELETE FROM visit_ai_hypotheses;
DELETE FROM visit_ai_cases;
DELETE FROM issue_photos;
DELETE FROM visit_measurements;
DELETE FROM visit_issues;
DELETE FROM farmer_notes;

-- ─── AI / diagnosis ────────────────────────────────────────
DELETE FROM ml_gold_queue;
DELETE FROM ai_request_logs;
DELETE FROM ai_training_events;
DELETE FROM ai_accuracy_events;
DELETE FROM ai_case_outcomes;
DELETE FROM ai_learning_samples;
DELETE FROM ai_advisory_outputs;
DELETE FROM ai_product_recommendations;
DELETE FROM advisory_automation_jobs;
DELETE FROM advisory_reuse_cases;
DELETE FROM learned_follow_up_questions;
DELETE FROM disease_history;
DELETE FROM crop_images;
DELETE FROM farmer_ai_usage_daily;
DELETE FROM farmer_image_hashes;
DELETE FROM farmer_advisory_feedback;
DELETE FROM agronomist_escalations;
DELETE FROM ai_advisory_sessions;
DELETE FROM advisory_faq_cache;
DELETE FROM whatsapp_reply_attributions;
DELETE FROM recommendation_follow_ups;
DELETE FROM recommendation_applications;
DELETE FROM recommendation_records;
DELETE FROM weather_snapshots;

-- ─── CRM / telecaller ──────────────────────────────────────
DELETE FROM crm_task_comments;
DELETE FROM crm_interaction_sessions;
DELETE FROM telecaller_notes;
DELETE FROM crm_internal_notes;
DELETE FROM crm_manual_orders;
DELETE FROM crm_field_findings;
DELETE FROM crm_recommendations;
DELETE FROM crm_soil_reports;
DELETE FROM crm_water_reports;
DELETE FROM crm_leaf_reports;
DELETE FROM crm_pathogen_reports;
DELETE FROM block_stress_flags;
DELETE FROM crm_tasks;
DELETE FROM crm_call_logs;
DELETE FROM cultivation_activities;
DELETE FROM pending_tasks;
DELETE FROM roi_activity_costs;
DELETE FROM farmer_timeline_entries;

-- ─── ROI / seasons ─────────────────────────────────────────
DELETE FROM harvest_records;
DELETE FROM crop_seasons;
DELETE FROM farmer_roi_audit_log;
DELETE FROM farmer_roi_entries;
DELETE FROM farmer_roi_settings;
DELETE FROM farmer_roi_categories;

-- ─── Regional learning (farmer-derived) ────────────────────
DELETE FROM farmer_experience_stats;
DELETE FROM local_practices;
DELETE FROM farmer_messages;
DELETE FROM terminology_learning_history;
DELETE FROM farmer_language_patterns;
DELETE FROM regional_issue_stats;
DELETE FROM regional_protocol_stats;
DELETE FROM regional_farm_clusters;

-- ─── Market insight snapshots ──────────────────────────────
DELETE FROM market_insight_snapshots;
DELETE FROM market_insight_pincode_cache;
DELETE FROM market_insight_district_profiles;
DELETE FROM farmer_market_preferences;

-- ─── WhatsApp / comms events ───────────────────────────────
DELETE FROM whatsapp_broadcast_events;
DELETE FROM whatsapp_broadcast_campaigns;
DELETE FROM farmer_broadcast_preferences;
DELETE FROM conversation_sessions;

-- ─── Intelligence / ops ────────────────────────────────────
DELETE FROM opportunity_intelligence_alerts;
DELETE FROM user_table_preferences;
DELETE FROM seo_ai_jobs;

-- ─── Core farmer graph ─────────────────────────────────────
DELETE FROM farmer_otp_challenges;
DELETE FROM interaction_logs;
DELETE FROM webhook_logs;
DELETE FROM event_outbox;
DELETE FROM crm_sync_queue;
DELETE FROM quotation_inquiries;
DELETE FROM callback_requests;
DELETE FROM farmer_agronomist_assignments;
DELETE FROM farm_blocks;
DELETE FROM farmer_crops;
DELETE FROM leads;
DELETE FROM farmers;

COMMIT;

-- After reset: re-test signup, WhatsApp, Telecaller CRM, Crop Doctor.
-- Morbeez employee records, product catalog, and inventory master data are unchanged.
