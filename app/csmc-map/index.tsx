import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { MapPin, Clock, Phone, Navigation, ChevronLeft, Search } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';

// Centros de Salud Mental Comunitarios (CSMC) de Lima Centro y Lima Sur.
// Datos de fuentes oficiales (DIRIS) verificados en Google Maps.
const csmcCenters = [
  {
    id: '1',
    name: 'Centro de Salud Chacarilla de Otero (CSMC Javier Mariátegui Chiappe)',
    address: 'Jr. José Antonio Encinas 155, San Juan de Lurigancho 15401',
    phone: '(01) 743-5835 Anexo 3002',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'San Juan de Lurigancho',
    latitude: -12.020965226803243,
    longitude: -77.00685701784721,
  },
  {
    id: '2',
    name: 'CSMC Los Pinos (Diris Lima Centro)',
    address: 'Rio Majes S/N, San Juan de Lurigancho 15423',
    phone: '(01) 4594853',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'San Juan de Lurigancho',
    latitude: -11.968464288688466,
    longitude: -76.99557316634018,
  },
  {
    id: '3',
    name: 'CSMC Honorio Delgado',
    address: 'Jr, Jr. J. J. Pasos 394, Pueblo Libre 15084 (frente a la Universidad Antonio Ruiz de Montoya)',
    phone: '(01) 3303974',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'Pueblo Libre',
    latitude: -12.069248548112446,
    longitude: -77.05800928871977,
  },
  {
    id: '4',
    name: 'CSMC Jaime Zubieta',
    address: 'Jr. Antonio Bazo S/N, La Victoria 15018(a una cuadra de Av. México, entrada por Gamarra)',
    phone: '(01) 7662447',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'La Victoria',
    latitude: -12.070161576645084,
    longitude: -77.01392111164574,
  },
  {
    id: '5',
    name: 'CSMC Polideportivo San Cosme',
    address: 'Posta de San Cosme, Av. Bausate y Meza 2248, La Victoria 15019',
    phone: '(01) 743-5835',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'La Victoria',
    latitude: -12.061868749477693,
    longitude: -77.00682407534558,
  },
  {
    id: '6',
    name: 'CSMC Lince',
    address: 'Jirón Belisario Flores 426, Lince 15073 (sede Diris Lima Centro), Lince',
    phone: '(01) 936-573-839',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'Lince',
    latitude: -12.081897098483706,
    longitude: -77.03954359800166,
  },
  {
    id: '7',
    name: 'CSMC Santa Rosa de Manchay',
    address: 'Parque de la Portada 3, segundo piso de la capilla Santa Rosa (W447+2X9, Lima 15594), Manchay',
    phone: '(01) 743-5835',
    schedule: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    district: 'Pachacámac (Manchay)',
    latitude: -12.094813709339363,
    longitude: -76.88505889086414,
  },
  {
    id: '8',
    name: 'CSMC San Sebastián',
    address: 'Q2XC+HFX, Independencia, Chorrillos 15058',
    phone: '(01) 6982995',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'Chorrillos',
    latitude: -12.20088086357609,
    longitude: -76.9788185773711,
  },
  {
    id: '9',
    name: 'CSMC Virgen de la Merced',
    address: 'Gr 1 Mz M prima, Villa EL Salvador 15841 (sede comunitaria DIRIS Lima Sur)',
    phone: '(01) 5306571',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'Villa El Salvador',
    latitude: -12.243239779083545,
    longitude: -76.92935453504295,
  },
  {
    id: '10',
    name: 'CSMC Wiñay',
    address: 'Av. Túpac Amaru 4021, Comas 15312 (sede comunitaria DIRIS Lima Norte)',
    phone: '(01) 743-5835',
    schedule: 'Lunes a Domingo: 8:00 AM - 8:00 PM',
    district: 'San Juan de Miraflores',
    latitude: -11.968119401381406,
    longitude: -77.0573685178483,
  },

  // Hospitales/policlínicos con Salud Mental, como respaldo donde no hay CSMC confirmado.
  {
    id: '11',
    name: 'Hospital Nacional Arzobispo Loayza (Salud Mental)',
    address: 'Av. Alfonso Ugarte 848, Lima',
    phone: '(01) 509-4800',
    schedule: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    district: 'Lima Cercado',
    latitude: -12.049651089043019,
    longitude: -77.04266166286433,
  },
  {
    id: '12',
    name: 'Hospital María Auxiliadora (Salud Mental)',
    address: 'Av. Miguel Iglesias 968, San Juan de Miraflores',
    phone: '(01) 217-1818',
    schedule: 'Abierto las 24 horas',
    district: 'San Juan de Miraflores',
    latitude: -12.160533664844706,
    longitude: -76.95797419726868,
  },
  {
    id: '13',
    name: 'Hospital EsSalud Uldarico Rocca Fernández (Salud Mental)',
    address: 'Av. César Vallejo 825, Villa El Salvador',
    phone: '(01) 287-5266',
    schedule: 'Lunes a Domingo: hasta 8:00 PM',
    district: 'Villa El Salvador',
    latitude: -12.210266140921242,
    longitude: -76.93170411197187,
  },
  {
    id: '14',
    name: 'Policlínico EsSalud Juan José Rodríguez Lazo (Salud Mental)',
    address: 'Av. Guardia Peruana 8, Chorrillos',
    phone: '(01) 467-1453',
    schedule: 'Abierto las 24 horas',
    district: 'Chorrillos',
    latitude: -12.178421378668173,
    longitude: -77.00430662619739,
  },
  {
    id: '15',
    name: 'Hospital EsSalud Alberto Sabogal Sologuren (Salud Mental)',
    address: 'Colina 1081, Bellavista, Callao',
    phone: '(01) 429-7744',
    schedule: 'Abierto las 24 horas',
    district: 'Bellavista (Callao)',
    latitude: -12.065044828031239,
    longitude: -77.12188502718527,
  },
];

export default function CSMCScreen() {
  const { colors } = useTheme();
  const { locale } = useTranslation();
  const en = locale === 'en-US';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const districts = [...new Set(csmcCenters.map(center => center.district))];

  const q = query.trim().toLowerCase();
  const filteredCenters = csmcCenters.filter((center) => {
    if (selectedDistrict && center.district !== selectedDistrict) return false;
    if (!q) return true;
    return (
      center.name.toLowerCase().includes(q) ||
      center.district.toLowerCase().includes(q) ||
      center.address.toLowerCase().includes(q)
    );
  });

  const openMap = (latitude: number, longitude: number, name: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${name}`;
    Linking.openURL(url);
  };

  const callCenter = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>{en ? 'CSMC Lima Centers' : 'Centros CSMC Lima'}</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={en ? 'Search by name, district or address' : 'Buscar por nombre, distrito o dirección'}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.districtFilter}
          >
            <TouchableOpacity
              style={[
                styles.districtChip,
                { backgroundColor: !selectedDistrict ? colors.primary : colors.surfaceElevated },
              ]}
              onPress={() => setSelectedDistrict(null)}
            >
              <Text style={[
                styles.districtChipText,
                { color: !selectedDistrict ? '#fff' : colors.text },
              ]}>
                {en ? 'All' : 'Todos'}
              </Text>
            </TouchableOpacity>
            {districts.map(district => (
              <TouchableOpacity
                key={district}
                style={[
                  styles.districtChip,
                  { backgroundColor: selectedDistrict === district ? colors.primary : colors.surfaceElevated },
                ]}
                onPress={() => setSelectedDistrict(district)}
              >
                <Text style={[
                  styles.districtChipText,
                  { color: selectedDistrict === district ? '#fff' : colors.text },
                ]}>
                  {district}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {en ? `Available centers (${filteredCenters.length})` : `Centros disponibles (${filteredCenters.length})`}
          </Text>

          {filteredCenters.map(center => (
            <View key={center.id} style={[styles.centerCard, { backgroundColor: colors.surface }]}>
              <View style={styles.centerHeader}>
                <View style={[styles.centerIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MapPin size={24} color={colors.primary} />
                </View>
                <View style={styles.centerInfo}>
                  <Text style={[styles.centerName, { color: colors.text }]}>{center.name}</Text>
                  <Text style={[styles.centerDistrict, { color: colors.textSecondary }]}>
                    {center.district}
                  </Text>
                </View>
              </View>

              <View style={styles.centerDetails}>
                <View style={styles.detailRow}>
                  <MapPin size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {center.address}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {center.schedule}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Phone size={16} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {center.phone}
                  </Text>
                </View>
              </View>

              <View style={styles.centerActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => callCenter(center.phone)}
                >
                  <Phone size={18} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>{en ? 'Call' : 'Llamar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => openMap(center.latitude, center.longitude, center.name)}
                >
                  <Navigation size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>{en ? 'Go' : 'Ir'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchWrap: { paddingHorizontal: 24, marginBottom: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  content: {
    paddingHorizontal: 24,
  },
  districtFilter: {
    marginBottom: 20,
  },
  districtChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  districtChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  centerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  centerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  centerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  centerInfo: {
    flex: 1,
  },
  centerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerDistrict: {
    fontSize: 14,
    marginTop: 2,
  },
  centerDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  centerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});