const fs = require('fs');
const path = 'backend/src/services/farm-activity/farm-activity-commit.service.ts';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(
  `await supabase
        .from('operation_commands')
        .update({
          status: 'succeeded',
          response_json: response,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commandId);`,
  `await supabase
        .from('operation_commands')
        .update({
          status: 'succeeded',
          response_json: response,
          completed_at: new Date().toISOString(),
        })
        .eq('id', commandId);`
);
s = s.replace(
  `await supabase
        .from('operation_commands')
        .update({
          status: 'failed',
          error_json: { message: err instanceof Error ? err.message : String(err) },
          updated_at: new Date().toISOString(),
        })
        .eq('id', commandId);`,
  `await supabase
        .from('operation_commands')
        .update({
          status: 'failed',
          error_text: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', commandId);`
);
fs.writeFileSync(path, s);
console.log('commit service patched');
