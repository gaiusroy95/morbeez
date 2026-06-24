-- WhatsApp Yes/No compliance follow-up after visit recommendation

ALTER TABLE recommendation_follow_ups
  DROP CONSTRAINT IF EXISTS recommendation_follow_ups_phase_check;

ALTER TABLE recommendation_follow_ups
  ADD CONSTRAINT recommendation_follow_ups_phase_check CHECK (
    phase IN (
      'application_check',
      'application_reminder',
      'outcome_check',
      'outcome_reminder',
      'compliance_check'
    )
  );

ALTER TABLE recommendation_follow_ups
  DROP CONSTRAINT IF EXISTS recommendation_follow_ups_farmer_response_check;

ALTER TABLE recommendation_follow_ups
  ADD CONSTRAINT recommendation_follow_ups_farmer_response_check CHECK (
    farmer_response IS NULL
    OR farmer_response IN (
      'yes_applied',
      'not_yet',
      'need_clarification',
      'improved',
      'no_improvement',
      'worsened',
      'partial',
      'compliance_yes',
      'compliance_no'
    )
  );
