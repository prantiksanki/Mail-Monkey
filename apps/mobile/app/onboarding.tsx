import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
	FlatList,
	Image,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SLIDES, setOnboarded } from "@/lib/onboarding";

export default function OnboardingScreen() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [index, setIndex] = useState(0);
	const listRef = useRef<FlatList>(null);

	const finish = async () => {
		await setOnboarded(true);
		router.replace("/welcome");
	};

	const goTo = (i: number) => {
		if (i < 0 || i >= SLIDES.length) return;
		listRef.current?.scrollToOffset({ offset: i * width, animated: true });
		setIndex(i);
	};

	const next = () => {
		if (index >= SLIDES.length - 1) finish();
		else goTo(index + 1);
	};

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const i = Math.round(e.nativeEvent.contentOffset.x / width);
		if (i !== index) setIndex(i);
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.topBar}>
				<Pressable onPress={finish} hitSlop={12}>
					<Text style={styles.skip}>Skip</Text>
				</Pressable>
			</View>

			<FlatList
				ref={listRef}
				data={SLIDES}
				keyExtractor={(s) => s.key}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={onScroll}
				renderItem={({ item }) => (
					<View style={[styles.slide, { width }]}>
						<View style={styles.card}>
							<Image
								source={item.image}
								style={styles.image}
								resizeMode="cover"
							/>
						</View>
						<View style={styles.dots}>
							{SLIDES.map((s, i) => (
								<View
									key={s.key}
									style={[styles.dot, i === index && styles.dotActive]}
								/>
							))}
						</View>
						<Text style={styles.title}>{item.title}</Text>
					</View>
				)}
			/>

			{/* Arrow navigator pill */}
			<View style={[styles.navWrap, { paddingBottom: insets.bottom + 24 }]}>
				<View style={styles.nav}>
					<Pressable
						onPress={() => goTo(index - 1)}
						hitSlop={10}
						disabled={index === 0}
						style={styles.navBtn}
					>
						<Ionicons
							name="arrow-back"
							size={22}
							color={index === 0 ? "#c9ccd4" : "#23262f"}
						/>
					</Pressable>
					<View style={styles.navDivider} />
					<Pressable onPress={next} hitSlop={10} style={styles.navBtn}>
						<Ionicons name="arrow-forward" size={22} color="#23262f" />
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	topBar: { alignItems: "flex-end", paddingHorizontal: 24, paddingVertical: 8 },
	skip: { fontSize: 18, fontWeight: "600", color: "#d7d7d7" },
	slide: { flex: 1, alignItems: "center", paddingHorizontal: 26 },
	card: {
		width: "100%",
		aspectRatio: 354 / 472,
		borderRadius: 20,
		overflow: "hidden",
		backgroundColor: "#e6e8ec",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 6,
		marginTop: 8,
	},
	image: { width: "100%", height: "100%" },
	dots: { flexDirection: "row", gap: 8, marginTop: 28 },
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#c9ccd4",
	},
	dotActive: { backgroundColor: "#141718", width: 9, height: 9, borderRadius: 5 },
	title: {
		fontSize: 32,
		fontWeight: "700",
		color: "#23262f",
		textAlign: "center",
		marginTop: 28,
		letterSpacing: -0.7,
		lineHeight: 44,
	},
	navWrap: { alignItems: "center" },
	nav: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fcfcfd",
		borderRadius: 16,
		paddingVertical: 16,
		paddingHorizontal: 24,
		shadowColor: "#0f0f0f",
		shadowOffset: { width: 0, height: 20 },
		shadowOpacity: 0.12,
		shadowRadius: 16,
		elevation: 8,
	},
	navBtn: { paddingHorizontal: 12 },
	navDivider: {
		width: 2,
		height: 24,
		borderRadius: 1,
		backgroundColor: "#e6e8ec",
		marginHorizontal: 8,
	},
});
