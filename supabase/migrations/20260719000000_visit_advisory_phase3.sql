-- Phase 3 — visit advisory callbacks + monitoring progression job types

ALTER TABLE advisory_automation_jobs DROP CONSTRAINT IF EXISTS advisory_automation_jobs_job_type_check;

ALTER TABLE advisory_automation_jobs ADD CONSTRAINT advisory_automation_jobs_job_type_check
  CHECK (
    job_type IN (
      'follow_up_reminder',
      'callback_reminder',
      'whatsapp_follow_up',
      'seasonal_alert',
      'cultivation_application_prompt',
      'cultivation_result_validation',
      'rec_application_check',
      'rec_application_reminder',
      'rec_outcome_check',
      'rec_outcome_reminder',
      'rec_outcome_no_response',
      'rec_no_response_escalation',
      'visit_monitoring_progression',
      'visit_callback_escalation'
    )
  );
