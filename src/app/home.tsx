import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function Home() {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />

        <Text style={styles.texto}>
          Home Carregando...
        </Text>
      </View>
    );
  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  texto: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
