import type { IssueCategory, VisitPhotoValidationIssue } from '@morbeez/shared';
import type { IssueDraft } from '../IssueCard';
import { pickDefaultIssueCategory } from './visitIssueTypes';

export type VisitPhotoDraft = {
  uri: string;
  filename: string;
  mimeType: string;
  dataBase64: string;
  photoType: string;
  validationIssues?: VisitPhotoValidationIssue[];
  retakeRecommended?: boolean;
  aiTagged?: boolean;
};

export { getDefaultSelectedPhotoTypes, getVisitPhotoTypeLabel, getVisitPhotoTypesForCrop } from './visitPhotoTypes';
export {
  getFallbackIssueTypes,
  getIssueCategoryLabel,
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_OPTIONS,
  issueCategoryHint,
  pickDefaultIssueCategory,
} from './visitIssueTypes';

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
  return pickDefaultIssueCategory();
}
