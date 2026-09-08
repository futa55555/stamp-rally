import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Stamp } from '../../../features/trips/model/types';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Badge } from '../../../shared/ui/Badge';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
export function StampDetailHeader({
  stamp,
  stampId,
  genreName,
  photoCount,
}: {
  stamp: Stamp;
  stampId: string;
  genreName?: string;
  photoCount: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
      <AppText variant="caption" tone="primary">
        {genreName}
      </AppText>
      <EditableTitle title={stamp.name} kind="stamp" id={stampId} />
      {stamp.description ? (
        <AppText tone="textSecondary">{stamp.description}</AppText>
      ) : null}
      <Badge
        label={stamp.isCompleted ? 'スタンプ達成' : 'これからのお楽しみ'}
        icon={stamp.isCompleted ? 'check-circle-outline' : 'postage-stamp'}
        kind={stamp.isCompleted ? 'active' : 'neutral'}
      />
      <View style={{ marginTop: theme.spacing.lg }}>
        <SectionHeading
          title="みんなの写真"
          subtitle="星を押して、お気に入りの一枚に。"
          count={photoCount}
        />
      </View>
    </View>
  );
}
