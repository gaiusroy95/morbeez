import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';

export const farmerNotesService = {
  async list(farmerId: string, limit = 50) {
    const { data, error } = await supabase
      .from('farmer_notes')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not load farmer notes');
    return (data ?? []).map((r) => ({
      id: String(r.id),
      noteText: String(r.note_text),
      authorEmail: r.author_email ? String(r.author_email) : null,
      createdAt: String(r.created_at),
    }));
  },

  async create(farmerId: string, authorEmail: string, noteText: string) {
    const text = noteText.trim();
    if (!text) throw new ValidationError('Note text required');
    const { data, error } = await supabase
      .from('farmer_notes')
      .insert({
        farmer_id: farmerId,
        author_email: authorEmail,
        note_text: text,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save note');
    return data;
  },
};
