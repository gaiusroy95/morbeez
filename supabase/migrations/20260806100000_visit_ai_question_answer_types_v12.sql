-- Expand visit_ai_questions.answer_type for Dynamic Diagnostic Question Engine v12.
ALTER TABLE visit_ai_questions DROP CONSTRAINT IF EXISTS visit_ai_questions_answer_type_check;

ALTER TABLE visit_ai_questions
  ADD CONSTRAINT visit_ai_questions_answer_type_check
  CHECK (
    answer_type IN (
      'yes_no_unknown',
      'yes_no',
      'single_choice',
      'multiple_choice',
      'percentage',
      'number',
      'text',
      'image_upload'
    )
  );
