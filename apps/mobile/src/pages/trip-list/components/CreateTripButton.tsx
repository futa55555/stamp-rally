import { useRouter } from 'expo-router';
import { Button } from '../../../shared/ui/Button';
export function CreateTripButton() {
  const router = useRouter();
  return (
    <Button
      label="旅行を作成"
      icon="plus"
      onPress={() => router.push('/editor/trip')}
    />
  );
}
