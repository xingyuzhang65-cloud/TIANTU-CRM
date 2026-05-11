import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import LeadListScreen from '../screens/leads/LeadListScreen';
import LeadDetailScreen from '../screens/leads/LeadDetailScreen';
import CreateLeadScreen from '../screens/leads/CreateLeadScreen';
import CustomerListScreen from '../screens/customers/CustomerListScreen';
import CustomerDetailScreen from '../screens/customers/CustomerDetailScreen';
import QuotationScreen from '../screens/quotations/QuotationScreen';
import TrackingScreen from '../screens/tracking/TrackingScreen';
import FinanceScreen from '../screens/finance/FinanceScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import AIAssistantScreen from '../screens/ai/AIAssistantScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();
const LeadStack = createNativeStackNavigator();
const CustomerStack = createNativeStackNavigator();
const WorkbenchStack = createNativeStackNavigator();

function LeadStackNav() {
  return (
    <LeadStack.Navigator screenOptions={{ headerShown: false }}>
      <LeadStack.Screen name="LeadList" component={LeadListScreen} />
      <LeadStack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <LeadStack.Screen name="CreateLead" component={CreateLeadScreen} />
    </LeadStack.Navigator>
  );
}

function CustomerStackNav() {
  return (
    <CustomerStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomerStack.Screen name="CustomerList" component={CustomerListScreen} />
      <CustomerStack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </CustomerStack.Navigator>
  );
}

function WorkbenchStackNav() {
  return (
    <WorkbenchStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkbenchStack.Screen name="Quotation" component={QuotationScreen} />
      <WorkbenchStack.Screen name="Tracking" component={TrackingScreen} />
      <WorkbenchStack.Screen name="Finance" component={FinanceScreen} />
      <WorkbenchStack.Screen name="Analytics" component={AnalyticsScreen} />
      <WorkbenchStack.Screen name="AIAssistant" component={AIAssistantScreen} />
    </WorkbenchStack.Navigator>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Leads: focused ? 'people' : 'people-outline',
            Customers: focused ? 'briefcase' : 'briefcase-outline',
            Workbench: focused ? 'apps' : 'apps-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: '首页' }} />
      <Tab.Screen name="Leads" component={LeadStackNav} options={{ title: '线索' }} />
      <Tab.Screen name="Customers" component={CustomerStackNav} options={{ title: '客户' }} />
      <Tab.Screen name="Workbench" component={WorkbenchStackNav} options={{ title: '工作台' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
    </Tab.Navigator>
  );
}
