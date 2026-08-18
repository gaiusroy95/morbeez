import type { FarmerIntent } from './types.js';

const YES =
  /\b(yes|yeah|yep|applied|completed|done|finished|ok|okay|ho gaya|hogaya|ayi|aayi|cheythu|panniten|maaDidde|kiya)\b/iu;
const NO =
  /\b(no|not yet|later|tomorrow|rain|mazha|baarish|illa|illae|illaa|nahi|illa\b|pending|wait)\b/iu;
const WORSE =
  /\b(worse|worsening|dying|yellowing|spreading|getting worse|kooduthal|kettathu|kharab|mosam|kevalam)\b/iu;
const SYMPTOMS =
  /\b(spot|spots|lesion|rot|wilting|wilt|leaf|leaves|stem|insect|pest|fungus|disease|symptom|ila|ila koththu|patta)\b/iu;
const HUMAN =
  /\b(agronomist|human|person|agent|talk to|call me|speak to|doctor|specialist)\b/iu;
const OPT_OUT =
  /\b(stop calling|don'?t call|do not call|unsubscribe|opt ?out|remove (me|number)|stop (calls|calling))\b/iu;

export function parseFarmerIntent(text: string): FarmerIntent {
  const raw = text.trim();
  if (!raw) return 'unclear';
  if (OPT_OUT.test(raw)) return 'opt_out';
  if (HUMAN.test(raw)) return 'human_requested';
  if (WORSE.test(raw)) return 'worsening';
  if (YES.test(raw) && !NO.test(raw)) return 'yes_completed';
  if (NO.test(raw)) return 'no_pending';
  if (SYMPTOMS.test(raw)) return 'symptoms';
  return 'unclear';
}
