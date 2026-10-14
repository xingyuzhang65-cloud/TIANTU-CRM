import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InquiryQuotation from '../quotations/InquiryQuotationHomeScreen';
import Tracking from '../tracking/TrackingHomeScreen';
import { colors, ui, ScreenHeader, IconButton } from '../../components/AppUI';

export default function BusinessScreen({ navigation, route }) {
  const [section, setSection] = useState('pricing');
  useEffect(() => { if (route.params?.section) setSection(route.params.section); }, [route.params]);
  return <View style={ui.screen}><ScreenHeader title="业务中心" subtitle="从询价到交付，业务进展一目了然"><IconButton name="add-outline" primary label="新建询价" onPress={() => navigation.setParams({ section: 'pricing', createInquiry: Date.now() })} /></ScreenHeader><View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 22, marginBottom: 14 }}>{[['pricing', '询价与报价', 'calculator-outline'], ['tracking', '运单与异常', 'navigate-outline']].map(([key, title, icon]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} onPress={() => setSection(key)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 13, backgroundColor: section === key ? colors.navy : '#fff', borderWidth: 1, borderColor: section === key ? colors.navy : colors.border }}><Ionicons name={icon} size={18} color={section === key ? '#fff' : colors.muted} /><Text style={{ fontSize: 13, fontWeight: '600', color: section === key ? '#fff' : colors.muted }}>{title}</Text></Pressable>)}</View>{section === 'pricing' ? <InquiryQuotation navigation={navigation} route={route} embedded /> : <Tracking navigation={navigation} embedded />}</View>;
}
