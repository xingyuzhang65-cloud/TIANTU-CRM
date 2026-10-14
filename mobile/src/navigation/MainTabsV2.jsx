import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Dashboard from '../screens/dashboard/DashboardV2';
import CustomerHub from '../screens/customers/CustomerHub';
import LeadDetail from '../screens/leads/LeadDetailScreen';
import CreateLead from '../screens/leads/CreateLeadScreen';
import CustomerDetail from '../screens/customers/CustomerDetailScreen';
import Business from '../screens/business/BusinessScreen';
import Moments from '../screens/moments/MomentsScreen';
import Settings from '../screens/settings/SettingsScreen';
import { colors } from '../components/AppUI';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
function CustomerStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="LeadCustomerHome" component={CustomerHub} /><Stack.Screen name="LeadDetail" component={LeadDetail} /><Stack.Screen name="CreateLead" component={CreateLead} /><Stack.Screen name="CustomerDetail" component={CustomerDetail} /></Stack.Navigator>;
}
const entries = { Home: ['工作台', 'grid-outline', 'grid'], LeadCustomers: ['客户', 'people-outline', 'people'], Business: ['业务', 'briefcase-outline', 'briefcase'], Moments: ['动态', 'chatbubbles-outline', 'chatbubbles'], Settings: ['我的', 'person-outline', 'person'] };
function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>{state.routes.map((route, index) => {
    const active = index === state.index;
    const [title, icon, selectedIcon] = entries[route.name];
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{ selected: active }} onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!active && !event.defaultPrevented) navigation.navigate(route.name); }} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 3 }}><View style={{ width: 46, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: active ? colors.light : '#fff' }}><Ionicons name={active ? selectedIcon : icon} size={21} color={active ? colors.primary : '#919DB0'} /></View><Text style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? colors.primary : '#919DB0' }}>{title}</Text></Pressable>;
  })}</View>;
}
export default function MainTabsV2() {
  return <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}><Tab.Screen name="Home" component={Dashboard} /><Tab.Screen name="LeadCustomers" component={CustomerStack} /><Tab.Screen name="Business" component={Business} /><Tab.Screen name="Moments" component={Moments} /><Tab.Screen name="Settings" component={Settings} /></Tab.Navigator>;
}
