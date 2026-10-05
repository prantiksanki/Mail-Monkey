import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { MonkeyAvatar } from "@/components/monkey-avatar";

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: "#141718",
				headerShown: true,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Chats",
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="chatbubbles"
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="monkeychan"
				options={{
					title: "MonkeyChan",
					tabBarIcon: ({ size }) => (
						<MonkeyAvatar variant={0} size={size + 6} />
					),
				}}
			/>
			<Tabs.Screen
				name="calendar"
				options={{
					title: "Calendar",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="calendar" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="settings"
				options={{
					title: "Settings",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="settings" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
