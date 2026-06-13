import { useRouter } from 'expo-router';
import { changeFarmerPassword } from '@morbeez/shared';
import { ChangePasswordForm } from '@morbeez/ui-native';
import { useFarmerAuth } from '@/context/FarmerAuthContext';
import { useLocale } from '@/context/LocaleContext';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { farmer, refresh } = useFarmerAuth();

  return (
    <ChangePasswordForm
      locale={locale}
      hasPassword={farmer?.hasPassword ?? false}
      onSubmit={async (input) => {
        await changeFarmerPassword(input);
      }}
      onSuccess={() => {
        void refresh();
        router.back();
      }}
    />
  );
}
