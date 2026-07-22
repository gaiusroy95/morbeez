/**
 * Maps AI training spec entity names → actual Supabase tables and key columns.
 * Use this when writing queries, exports, or UI field bindings.
 */
export declare const AI_TRAINING_SCHEMA: {
    readonly farmerProfile: {
        readonly table: "farmers";
        readonly specName: "Farmers";
        readonly keyFields: {
            readonly farmer_id: "id";
            readonly district: "district";
            readonly pincode: "pincode_id → pincode_master.pincode";
            readonly soil_type: "farm_blocks.soil_type_id → crm_masters";
            readonly irrigation_type: "farm_blocks.irrigation_type_id → crm_masters";
            readonly farming_style: "farming_style";
            readonly experience_level: "experience_level";
            readonly preferred_language: "preferred_language";
            readonly crops: "farm_blocks.crop_type (via blocks)";
        };
    };
    readonly cropBlock: {
        readonly table: "farm_blocks";
        readonly specName: "CropBlocks";
        readonly keyFields: {
            readonly crop_block_id: "id";
            readonly crop: "crop_type";
            readonly variety: "variety_name";
            readonly acreage: "acreage_decimal";
            readonly planting_date: "planting_date";
            readonly dap: "computed from planting_date";
            readonly growth_stage: "growth_stage_id → crm_masters";
            readonly expected_harvest: "metadata.expected_harvest";
        };
    };
    readonly fieldFinding: {
        readonly table: "crm_field_findings";
        readonly specName: "FieldFindings";
        readonly keyFields: {
            readonly finding_id: "id";
            readonly crop_block_id: "block_id";
            readonly finding_type: "finding_type";
            readonly severity: "severity";
            readonly symptoms: "observations";
            readonly affected_area: "affected_area_pct";
            readonly image_ids: "photo_urls";
            readonly weather_context: "weather_context";
            readonly diagnosed_by: "agronomist_name";
            readonly ai_prediction: "ai_prediction";
            readonly final_confirmed_issue: "final_confirmed_issue";
        };
    };
    readonly cropImage: {
        readonly table: "crop_images";
        readonly specName: "CropImages";
        readonly keyFields: {
            readonly image_id: "id";
            readonly crop: "crop";
            readonly dap: "dap";
            readonly symptoms: "symptoms";
            readonly gps_region: "gps_region";
            readonly weather: "weather_snapshot_id → weather_snapshots";
            readonly ai_prediction: "ai_prediction";
            readonly agronomist_confirmation: "agronomist_label";
            readonly severity: "severity";
            readonly review_status: "review_status";
        };
    };
    readonly fieldActivity: {
        readonly table: "cultivation_activities";
        readonly specName: "FieldActivities";
        readonly keyFields: {
            readonly activity_type: "activity_type / activity_type_id";
            readonly activity_date: "applied_at";
            readonly dap: "dap";
            readonly cost: "cost_inr + labour_cost_inr + spray_cost_inr + ...";
            readonly dosage: "dosage_structured";
            readonly products_used: "products";
            readonly labour_used: "labour_used";
            readonly outcome: "outcome";
        };
    };
    readonly recommendation: {
        readonly table: "recommendation_records";
        readonly specName: "Recommendations";
        readonly keyFields: {
            readonly recommendation_id: "id";
            readonly issue_type: "issue_detected";
            readonly recommendation_text: "recommendation_text";
            readonly product_cart: "products";
            readonly ai_generated: "ai_session_id IS NOT NULL";
            readonly human_corrected: "metadata.correction";
            readonly confidence_score: "ai_advisory_sessions.confidence_score";
            readonly applied_by_farmer: "application_status";
        };
    };
    readonly recommendationOutcome: {
        readonly table: "recommendation_records";
        readonly specName: "RecommendationOutcomes";
        readonly note: "Structured outcome fields on recommendation_records; training rows in ai_learning_samples";
        readonly keyFields: {
            readonly recommendation_id: "id";
            readonly outcome: "outcome";
            readonly recovery_days: "recovery_days";
            readonly farmer_feedback: "farmer_outcome_feedback";
            readonly agronomist_feedback: "agronomist_outcome_feedback";
            readonly issue_resolved: "issue_resolved";
            readonly roi_impact: "metadata.roi_impact";
        };
        readonly trainingTable: "ai_learning_samples";
    };
    readonly weather: {
        readonly table: "weather_snapshots";
        readonly specName: "WeatherData";
        readonly keyFields: {
            readonly rainfall: "rainfall_mm";
            readonly humidity: "humidity_pct";
            readonly temperature: "temperature_c";
            readonly soil_moisture: "soil_moisture_pct";
            readonly disease_outbreak_alerts: "disease_alerts";
        };
        readonly rulesTable: "weather_rule_definitions";
    };
    readonly escalationCorrection: {
        readonly table: "agronomist_escalations";
        readonly specName: "EscalationCorrections";
        readonly note: "Stage 2 will add ai_training_events as unified spine";
        readonly keyFields: {
            readonly ai_prediction: "ai_advisory_sessions → probable_issue";
            readonly employee_prediction: "correction JSONB";
            readonly agronomist_final: "correction.correctDiagnosis";
            readonly confidence_before: "confidence_at_escalation";
            readonly correction_reason: "agronomist_notes";
        };
    };
    readonly confidenceEngine: {
        readonly table: "ai_advisory_sessions";
        readonly specName: "AI Confidence Engine";
        readonly keyFields: {
            readonly confidence_score: "confidence_score";
            readonly confidence_band: "confidence_band";
            readonly auto_sent: "auto_sent";
            readonly human_reviewed: "human_reviewed";
            readonly corrected: "corrected";
            readonly escalation_required: "escalation_recommended";
        };
    };
    readonly trainingSpine: {
        readonly table: "ai_learning_samples";
        readonly specName: "AI Training Samples";
        readonly note: "Stage 2 adds ai_training_events for unified correction spine";
    };
    readonly visitIssue: {
        readonly table: "visit_issues";
        readonly specName: "VisitIssues";
        readonly keyFields: {
            readonly issue_id: "id";
            readonly field_finding_id: "field_finding_id";
            readonly issue_category: "issue_category";
            readonly issue_master_id: "issue_master_id";
            readonly issue_name: "issue_name";
            readonly severity: "severity";
            readonly observation: "observation";
            readonly status: "status";
        };
    };
    readonly issuePhoto: {
        readonly table: "issue_photos";
        readonly specName: "IssuePhotos";
        readonly keyFields: {
            readonly photo_id: "id";
            readonly visit_issue_id: "visit_issue_id";
            readonly storage_path: "storage_path";
        };
    };
    readonly visitMeasurement: {
        readonly table: "visit_measurements";
        readonly specName: "Measurements";
        readonly keyFields: {
            readonly measurement_id: "id";
            readonly field_finding_id: "field_finding_id";
            readonly measurement_key: "measurement_key";
            readonly value: "value";
            readonly unit: "unit";
        };
    };
    readonly issueMaster: {
        readonly table: "issue_master";
        readonly specName: "IssueMaster";
        readonly keyFields: {
            readonly issue_master_id: "id";
            readonly category: "category";
            readonly issue_name: "issue_name";
            readonly concept_code: "concept_code";
        };
    };
    readonly cropMeasurementTemplate: {
        readonly table: "crop_measurement_templates";
        readonly specName: "CropMeasurementTemplates";
        readonly keyFields: {
            readonly crop_type: "crop_type";
            readonly measurement_key: "measurement_key";
            readonly label_en: "label_en";
            readonly unit: "unit";
        };
    };
};
export type AiTrainingEntity = keyof typeof AI_TRAINING_SCHEMA;
//# sourceMappingURL=schema-map.d.ts.map