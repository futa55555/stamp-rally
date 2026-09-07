import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppTheme, ColorToken } from "../theme/tokens";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({
  name,
  size = 24,
  tone = "textSecondary",
}: {
  name: IconName;
  size?: number;
  tone?: ColorToken;
}) {
  const theme = useAppTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={theme.colors[tone]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function AppText({
  variant = "body",
  tone = "text",
  style,
  ...props
}: TextProps & { variant?: keyof AppTheme["typography"]; tone?: ColorToken }) {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: theme.colors[tone] }, style]}
    />
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  pending = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger";
  pending?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const tone: ColorToken =
    variant === "primary"
      ? "onPrimary"
      : variant === "danger"
        ? "error"
        : "text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.layout.touchTarget + 4,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        backgroundColor:
          variant === "primary"
            ? pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary
            : variant === "danger"
              ? theme.colors.errorBackground
              : theme.colors.surface,
        borderWidth: variant === "secondary" ? 1 : 0,
        borderColor: theme.colors.border,
        opacity:
          disabled || pending
            ? theme.opacity.disabled
            : pressed
              ? theme.opacity.pressed
              : 1,
      })}
    >
      {pending ? (
        <ActivityIndicator color={theme.colors[tone]} />
      ) : icon ? (
        <Icon name={icon} tone={tone} size={21} />
      ) : null}
      <AppText variant="label" tone={tone}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = "text",
  selected,
  disabled = false,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: ColorToken;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          minHeight: theme.layout.touchTarget,
          minWidth: theme.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          opacity: disabled
            ? theme.opacity.disabled
            : pressed
              ? theme.opacity.pressed
              : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} tone={tone} />
    </Pressable>
  );
}

export function UnreadBadge({
  label = "未読の写真があります",
}: {
  label?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 8,
        height: 8,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.unread,
      }}
    />
  );
}

export function Badge({
  label,
  icon,
  kind = "active",
}: {
  label: string;
  icon?: IconName;
  kind?: "active" | "neutral" | "favorite";
}) {
  const theme = useAppTheme();
  const tone =
    kind === "active"
      ? "active"
      : kind === "favorite"
        ? "favorite"
        : "textSecondary";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xxs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.pill,
        backgroundColor:
          kind === "favorite"
            ? theme.colors.favoriteBackground
            : kind === "active"
              ? theme.colors.activeBackground
              : theme.colors.background,
        alignSelf: "flex-start",
      }}
    >
      {icon ? <Icon name={icon} size={14} tone={tone} /> : null}
      <AppText variant="caption" tone={tone} style={{ fontWeight: "600" }}>
        {label}
      </AppText>
    </View>
  );
}

export function Screen({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useAppTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        {
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
          width: "100%",
          maxWidth: theme.layout.pageMaxWidth,
          alignSelf: "center",
          flexGrow: 1,
        },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function SectionHeading({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle?: string;
  count?: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.xs,
        }}
      >
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ flexShrink: 1 }}
        >
          {title}
        </AppText>
        {count !== undefined ? (
          <AppText variant="caption" tone="textMuted">
            {count}
          </AppText>
        ) : null}
      </View>
      {subtitle ? (
        <AppText variant="caption" tone="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function StateView({
  title,
  description,
  icon = "image-multiple-outline",
  loading = false,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  loading?: boolean;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: compact ? theme.spacing.lg : theme.spacing.xxl,
        gap: theme.spacing.md,
        alignItems: "center",
        justifyContent: "center",
        flex: compact ? undefined : 1,
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.md,
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="読み込み中"
        />
      ) : (
        <Icon name={icon} size={36} tone="textMuted" />
      )}
      <AppText
        variant="label"
        accessibilityRole="header"
        style={{ textAlign: "center" }}
      >
        {title}
      </AppText>
      {description ? (
        <AppText
          tone="textSecondary"
          variant="caption"
          style={{ textAlign: "center" }}
        >
          {description}
        </AppText>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  const theme = useAppTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.colors.errorBackground,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.sm,
      }}
    >
      <AppText variant="caption" tone="error">
        {message}
      </AppText>
    </View>
  ) : null;
}

export function Progress({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="caption" tone="textSecondary">
          {label}
        </AppText>
        <AppText variant="caption" tone="primary">
          {completed} / {total}
        </AppText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: total || 1,
          now: completed,
          text: `${total}件中${completed}件達成`,
        }}
        style={{
          height: 4,
          backgroundColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${total ? Math.min(100, (completed / total) * 100) : 0}%`,
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
          }}
        />
      </View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  unread,
  completed,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  unread?: boolean;
  completed?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${title}${subtitle ? `、${subtitle}` : ""}${unread ? "、未読あり" : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: pressed
          ? theme.colors.surfaceSubtle
          : theme.colors.surface,
        borderRadius: theme.radius.md,
        minHeight: 88,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={completed ? "check-circle-outline" : icon}
          tone="primary"
          size={23}
        />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {unread ? <UnreadBadge /> : null}
      {trailing ??
        (onPress ? (
          <Icon name="chevron-right" size={20} tone="textMuted" />
        ) : null)}
    </Pressable>
  );
}

export const layout = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  flex: { flex: 1 },
});
