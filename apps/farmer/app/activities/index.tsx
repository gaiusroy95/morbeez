import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Field activities live on the block detail screen — redirect here. */
export default function ActivitiesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blockId?: string }>();

  useEffect(() => {
    if (params.blockId) {
      router.replace(`/fields/${String(params.blockId)}`);
      return;
    }
    router.replace('/fields');
  }, [params.blockId, router]);

  return null;
}
