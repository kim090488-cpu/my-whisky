import { useRef, useState } from "react";
import {
  View, Text, Modal, Pressable, Image, FlatList, StyleSheet,
  Dimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  /** 이미 public URL로 변환된 배열 */
  urls: (string | null)[];
  initialIndex: number;
  onClose: () => void;
};

export function PhotoLightbox({ visible, urls, initialIndex, onClose }: Props) {
  const photos = urls.filter((u): u is string => !!u);
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(initialIndex);
  const { width, height } = Dimensions.get("window");

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setIndex(initialIndex);
        // 처음 열릴 때 initialIndex로 스크롤
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
        });
      }}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(p) => p}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item: url }) => (
            <Pressable
              onPress={onClose}
              style={[styles.slide, { width, height }]}
            >
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="contain"
              />
            </Pressable>
          )}
        />

        {/* Header (close + counter) */}
        <View style={styles.header} pointerEvents="box-none">
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color="#fafafa" />
          </Pressable>
          {photos.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {index + 1} / {photos.length}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  closeBtn: {
    padding: 4,
  },
  counter: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: "#fafafa", fontSize: 13, fontWeight: "500",
  },
});
