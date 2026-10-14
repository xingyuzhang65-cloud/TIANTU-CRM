import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AppFeedback from './src/components/AppFeedback';
import { colors, APP_WIDTH } from './src/components/AppUI';

export default function App() {
  return (
    <SafeAreaProvider>
      {Platform.OS === 'web' && <style>{`html,body,#root{height:100%;background:#e9edf3}body{margin:0}input:focus,textarea:focus{outline:none;box-shadow:0 0 0 3px #2458d314}button:focus-visible,[role=button]:focus-visible{outline:2px solid #2458d3;outline-offset:3px}*::-webkit-scrollbar{width:4px;height:3px}*::-webkit-scrollbar-thumb{background:#d6dde8;border-radius:8px}`}</style>}
      <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#E9EDF3' }}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? APP_WIDTH : undefined, backgroundColor: colors.bg, borderLeftWidth: Platform.OS === 'web' ? 1 : 0, borderRightWidth: Platform.OS === 'web' ? 1 : 0, borderColor: '#DCE3ED' }}>
          <AuthProvider>
            <StatusBar style="dark" />
            <AppNavigator />
            <AppFeedback />
          </AuthProvider>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}
