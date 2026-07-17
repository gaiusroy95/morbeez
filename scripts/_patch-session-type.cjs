const fs = require('fs');
const path = 'backend/src/services/whatsapp/conversation-session.service.ts';
let s = fs.readFileSync(path, 'utf8');
if (!s.includes('active_block_id?:')) {
  s = s.replace(
    '  last_ai_at: string | null;\n  context: SessionContext;',
    '  last_ai_at: string | null;\n  active_plot_id?: string | null;\n  active_block_id?: string | null;\n  context: SessionContext;'
  );
  if (!s.includes('active_block_id?:')) {
    s = s.replace(
      '  last_ai_at: string | null;\r\n  context: SessionContext;',
      '  last_ai_at: string | null;\r\n  active_plot_id?: string | null;\r\n  active_block_id?: string | null;\r\n  context: SessionContext;'
    );
  }
}
if (!s.includes('active_block_id?:')) throw new Error('failed to patch ConversationSession');
fs.writeFileSync(path, s);
console.log('session type patched');
