import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import LeadCustomerHomeScreen from '../screens/customers/LeadCustomerHomeScreen';
import LeadDetailScreen from '../screens/leads/LeadDetailScreen';
import CreateLeadScreen from '../screens/leads/CreateLeadScreen';
import CustomerDetailScreen from '../screens/customers/CustomerDetailScreen';
import InquiryQuotationHomeScreen from '../screens/quotations/InquiryQuotationHomeScreen';
import TrackingHomeScreen from '../screens/tracking/TrackingHomeScreen';
import MomentsScreen from '../screens/moments/MomentsScreen';
import AdminWorkspaceScreen from '../screens/admin/AdminWorkspaceScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();
const LeadCustomerStack = createNativeStackNavigator();

function LeadCustomerStackNav() {
  return (
    <LeadCustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <LeadCustomerStack.Screen name="LeadCustomerHome" component={LeadCustomerHomeScreen} />
      <LeadCustomerStack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <LeadCustomerStack.Screen name="CreateLead" component={CreateLeadScreen} />
      <LeadCustomerStack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </LeadCustomerStack.Navigator>
  );
}

export default function MainTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            LeadCustomers: focused ? 'people' : 'people-outline',
            InquiryQuotation: focused ? 'calculator' : 'calculator-outline',
            Tracking: focused ? 'location' : 'location-outline',
            Moments: focused ? 'earth' : 'earth-outline',
            Admin: focused ? 'briefcase' : 'briefcase-outline',
            Settings: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 10 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: '首页' }} />
      <Tab.Screen name="Moments" component={MomentsScreen} options={{ title: '朋友圈' }} />
      <Tab.Screen name="LeadCustomers" component={LeadCustomerStackNav} options={{ title: '线客' }} />
      <Tab.Screen name="InquiryQuotation" component={InquiryQuotationHomeScreen} options={{ title: '报价' }} />
      <Tab.Screen name="Tracking" component={TrackingHomeScreen} options={{ title: '运踪' }} />
      {isAdmin ? <Tab.Screen name="Admin" component={AdminWorkspaceScreen} options={{ title: '管理' }} /> : null}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '我的' }} />
    </Tab.Navigator>
  );
}
