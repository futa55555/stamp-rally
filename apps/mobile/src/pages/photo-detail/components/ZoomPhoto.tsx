import { useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Post } from '../../../features/photos/model/types';
import { PostImage } from '../../../features/photos/ui/PostImage';

export function ZoomPhoto({
  post,
  active,
  size,
  label,
  onDisplayed,
  onZoomChange,
}: {
  post: Post;
  active: boolean;
  size: { width: number; height: number };
  label: string;
  onDisplayed: () => void;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const ratio =
    post.width && post.height
      ? Math.min(size.width / post.width, size.height / post.height)
      : 1;
  const imageWidth = post.width ? post.width * ratio : size.width;
  const imageHeight = post.height ? post.height * ratio : size.height;
  useEffect(() => {
    scale.value = savedScale.value = 1;
    x.value = y.value = savedX.value = savedY.value = 0;
    if (active) onZoomChange(false);
  }, [post.id, active, size.width, size.height]);
  const bound = () => {
    'worklet';
    const maxX = Math.max(0, (imageWidth * scale.value - size.width) / 2);
    const maxY = Math.max(0, (imageHeight * scale.value - size.height) / 2);
    x.value = Math.max(-maxX, Math.min(maxX, x.value));
    y.value = Math.max(-maxY, Math.min(maxY, y.value));
  };
  const pinch = Gesture.Pinch()
    .enabled(active)
    .onStart(() => {
      savedScale.value = scale.value;
      runOnJS(onZoomChange)(true);
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(4, savedScale.value * event.scale));
      bound();
    })
    .onFinalize(() => {
      bound();
      runOnJS(onZoomChange)(scale.value > 1);
    });
  const pan = Gesture.Pan()
    .enabled(active)
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > 1) state.activate();
      else state.fail();
    })
    .onStart(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      x.value = savedX.value + event.translationX;
      y.value = savedY.value + event.translationY;
      bound();
    });
  const doubleTap = Gesture.Tap()
    .enabled(active)
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      const next = scale.value > 1 ? 1 : 2;
      scale.value = withTiming(next, { duration: 180 });
      x.value = withTiming(0);
      y.value = withTiming(0);
      runOnJS(onZoomChange)(next > 1);
    });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <PostImage
          post={post}
          variant="large"
          label={label}
          fit="contain"
          background="background"
          className="flex-1"
          onDisplayed={onDisplayed}
        />
      </Animated.View>
    </GestureDetector>
  );
}
