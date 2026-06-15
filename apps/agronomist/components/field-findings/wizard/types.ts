import type { IssueCategory } from '@morbeez/shared';
import { ISSUE_CATEGORIES } from '@morbeez/shared';
import type { IssueDraft } from '../IssueCard';

export type VisitPhotoDraft = {
  uri: string;
  filename: string;
  mimeType: string;
  dataBase64: string;
  photoType: string;
};

export const VISIT_PHOTO_TYPES = [
  { value: 'whole_field', label: 'Whole field' },
  { value: 'rhizome', label: 'Rhizome' },
  { value: 'plant', label: 'Plant' },
  { value: 'pest', label: 'Pest' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'disease', label: 'Disease' },
  { value: 'stem', label: 'Stem' },
  { value: 'other', label: 'Other' },
] as const;

export function newIssueDraft(category: IssueCategory, localId: string): IssueDraft {
  return {
    localId,
    category,
    issueName: '',
    severity: 'medium',
    status: 'open',
    observation: '',
    photos: [],
    photosPreview: [],
  };
}

export function pickDefaultCategory(): IssueCategory {
  return ISSUE_CATEGORIES[0] ?? 'disease';
}
