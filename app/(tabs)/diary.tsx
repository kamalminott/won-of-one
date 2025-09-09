import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function DiaryScreen() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Diary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
