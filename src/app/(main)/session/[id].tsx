import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-surface0">
      <Text className="text-text-hi text-text14">Session {id}</Text>
      <Text className="text-text-mid text-text13 mt-2">
        Detail + steering built in Session 3.
      </Text>
    </View>
  );
}
