import { Alert, Linking } from 'react-native';
import {
  farmConfirmedHasCorrectionPath,
  resolveFarmConfirmedVisibility,
  t,
  type AppLocale,
  type FarmConfirmedVisibility,
  type FarmConfirmedVisibilityInput,
} from '@morbeez/shared';
import { whatsAppUrl } from '@/lib/config';
import { defaultFarmConfirmedSupportMessage } from '@/lib/farm-confirmed-support';

export { defaultFarmConfirmedSupportMessage } from '@/lib/farm-confirmed-support';

export function openFarmConfirmedCorrectionPath(
  visibility: FarmConfirmedVisibility,
  locale: AppLocale
): void {
  const path = visibility.correctionPath;
  if (path.kind === 'correct' || path.kind === 'undo') {
    void Linking.openURL(path.url).catch(() => {
      Alert.alert(t('couldNotOpenLink', locale));
    });
    return;
  }
  if (path.kind === 'support') {
    void Linking.openURL(whatsAppUrl(path.message)).catch(() => {
      Alert.alert(t('couldNotOpenLink', locale));
    });
  }
}

export function presentFarmConfirmedActions(params: {
  input: FarmConfirmedVisibilityInput;
  locale: AppLocale;
  kind: 'activity' | 'roi';
  id: string;
  label: string;
  onEdit?: () => void;
}): boolean {
  const visibility = resolveFarmConfirmedVisibility(params.input);
  if (!visibility.isWhatsAppConfirmed) return false;

  const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
    { text: t('cancel', params.locale), style: 'cancel' },
  ];

  if (params.onEdit) {
    buttons.push({
      text: t('editTransaction', params.locale),
      onPress: params.onEdit,
    });
  }

  let path = visibility.correctionPath;
  if (path.kind === 'none') {
    path = {
      kind: 'support',
      message: defaultFarmConfirmedSupportMessage({
        kind: params.kind,
        id: params.id,
        label: params.label,
      }),
    };
  }

  const withPath: FarmConfirmedVisibility = { ...visibility, correctionPath: path };
  if (farmConfirmedHasCorrectionPath(withPath) || path.kind === 'support') {
    const actionLabel =
      path.kind === 'undo'
        ? t('undoWhatsAppEntry', params.locale)
        : path.kind === 'correct'
          ? t('correctWhatsAppEntry', params.locale)
          : t('requestCorrectionWhatsApp', params.locale);
    buttons.push({
      text: actionLabel,
      onPress: () => openFarmConfirmedCorrectionPath(withPath, params.locale),
    });
  }

  Alert.alert(params.label, farmConfirmedActionsSubtitle(visibility, params.locale), buttons);
  return true;
}

export function farmConfirmedActionsSubtitle(
  visibility: FarmConfirmedVisibility,
  locale: AppLocale
): string | undefined {
  const parts: string[] = [];
  if (visibility.confirmedAtLabel) {
    parts.push(`${t('confirmedOn', locale)} ${visibility.confirmedAtLabel}`);
  }
  if (visibility.linkedRoiLabel) {
    parts.push(`${t('linkedRoi', locale)}: ${visibility.linkedRoiLabel}`);
  }
  if (visibility.linkedActivityLabel) {
    parts.push(`${t('linkedActivity', locale)}: ${visibility.linkedActivityLabel}`);
  }
  return parts.length ? parts.join('\n') : undefined;
}
