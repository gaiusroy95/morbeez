import { useRouter } from 'expo-router';
import { changeStaffPassword } from '@morbeez/shared';
import { ChangePasswordForm } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useStaffAuth } from '@/context/StaffAuth';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { admin, refresh } = useStaffAuth();

  return (
    <ChangePasswordForm
      locale={locale}
      hasPassword={admin?.hasPassword ?? false}
      onSubmit={async (input) => {
        await changeStaffPassword(input);
      }}
      onSuccess={() => {
        void refresh();
        router.back();
      }}
    />
  );
}
