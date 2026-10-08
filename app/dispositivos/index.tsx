import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Watch, Smartphone, Bluetooth, Check, ChevronLeft, ChevronRight, Activity, Search } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useProfile } from '../../hooks/useProfile';
import { useTranslation } from '../../hooks/useTranslation';
import { useSnackbar } from '../../hooks/useSnackbar';
import { supabase } from '../../lib/supabase';
import { bleManager } from '../../lib/heartRate/bleManager';
import { HealthConnectProvider } from '../../lib/heartRate/HealthConnectProvider';
import { setSelectedBluetoothDevice } from '../../hooks/useHeartRate';
import { ConfirmModal } from '../../components/ConfirmModal';

type Device = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  is_connected: boolean;
  last_seen_at: string;
  created_at: string;
};

type BleDevice = {
  id: string;
  name: string | null;
};

async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') {
    const apiLevel = parseInt(Platform.Version.toString(), 10);
    if (apiLevel < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return false;
}

export default function DispositivosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { locale } = useTranslation();
  const en = locale === 'en-US';
  const { show: showSnackbar } = useSnackbar();
  const [devices, setDevices] = useState<Device[]>([]);
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [hcConnecting, setHcConnecting] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);

  useEffect(() => {
    if (profile?.id) loadDevices();
  }, [profile?.id]);

  useEffect(() => {
    return () => { bleManager?.stopDeviceScan(); };
  }, []);

  async function loadDevices() {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', profile?.id)
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      const loaded = data || [];
      setDevices(loaded);

      const activeBle = loaded.find((d) => d.type === 'heart_rate_monitor' && d.is_connected);
      if (activeBle) setSelectedBluetoothDevice(activeBle.model);
    } catch (error) {
      console.error('[Dispositivos] Error cargando dispositivos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startScan() {
    if (!bleManager) {
      showSnackbar({ type: 'error', message: en ? 'Bluetooth is not available in Expo Go. Use a development build.' : 'El Bluetooth no está disponible en Expo Go. Usa una build de desarrollo.' });
      return;
    }
    if (scanning) {
      bleManager?.stopDeviceScan();
      setScanning(false);
      return;
    }
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      showSnackbar({ type: 'error', message: en ? 'Bluetooth and Location permissions are required to scan.' : 'Se requieren permisos de Bluetooth y Ubicación para escanear.' });
      return;
    }
    setBleDevices([]);
    setScanning(true);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.warn('[Dispositivos] Error en escaneo:', error);
        setScanning(false);
        showSnackbar({ type: 'error', message: en ? "Couldn't scan. Make sure Bluetooth is on." : 'No se pudo escanear. Revisa que el Bluetooth esté encendido.' });
        return;
      }
      if (device) {
        setBleDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          if (!device.name && !device.localName) return prev;
          return [...prev, { id: device.id, name: device.name || device.localName }];
        });
      }
    });

    setTimeout(() => {
      bleManager?.stopDeviceScan();
      setScanning(false);
    }, 15000);
  }

  async function connectBleDevice(device: BleDevice) {
    if (!profile?.id) return;
    try {
      setScanning(false);
      bleManager?.stopDeviceScan();
      setSelectedBluetoothDevice(device.id);

      // Evita duplicados del mismo sensor (mismo id BLE).
      await supabase
        .from('devices')
        .delete()
        .eq('user_id', profile.id)
        .eq('model', device.id);

      await supabase.from('devices').insert([{
        user_id: profile.id,
        name: device.name || 'Sensor BLE',
        type: 'heart_rate_monitor',
        manufacturer: 'Bluetooth',
        model: device.id,
        is_connected: true,
        last_seen_at: new Date().toISOString(),
      }]);

      await loadDevices();
      showSnackbar({ type: 'success', message: en ? `Sensor connected: ${device.name || 'BLE'}` : `Sensor conectado: ${device.name || 'BLE'}` });
    } catch (error) {
      console.error('[Dispositivos] Error al conectar BLE:', error);
      showSnackbar({ type: 'error', message: en ? "Couldn't save the device." : 'No se pudo guardar el dispositivo.' });
    }
  }

  async function connectHealthConnect() {
    if (!profile?.id || hcConnecting) return;
    setHcConnecting(true);
    let detectedName: string | null = null;
    let active = false;
    try {
      const provider = new HealthConnectProvider();
      const unsubDevice = provider.onDevice?.((d) => { detectedName = d?.name ?? null; });
      const unsubStatus = provider.onStatus((s) => { if (s === 'active') active = true; });
      await provider.start();  // pide permiso + detecta el dispositivo de origen
      provider.stop();         // no dejamos el feed corriendo
      unsubDevice?.();
      unsubStatus();

      if (!active) {
        showSnackbar({ type: 'error', message: en ? "Couldn't connect. Make sure Health Connect has heart rate permission." : 'No se pudo conectar. Revisa que Health Connect tenga permiso de frecuencia cardíaca.' });
        return;
      }

      // Solo puede haber un reloj de Health Connect.
      await supabase
        .from('devices')
        .delete()
        .eq('user_id', profile.id)
        .eq('model', 'health_connect');

      await supabase.from('devices').insert([{
        user_id: profile.id,
        name: detectedName ?? 'Reloj (Health Connect)',
        type: 'smartwatch',
        manufacturer: 'Health Connect',
        model: 'health_connect',
        is_connected: true,
        last_seen_at: new Date().toISOString(),
      }]);

      await loadDevices();
      showSnackbar({ type: 'success', message: detectedName ? (en ? `Watch connected: ${detectedName}` : `Reloj conectado: ${detectedName}`) : (en ? 'Watch connected to Health Connect' : 'Reloj conectado a Health Connect') });
    } catch (error) {
      console.error('[Dispositivos] Error Health Connect:', error);
      showSnackbar({ type: 'error', message: en ? "Couldn't connect to Health Connect." : 'No se pudo conectar con Health Connect.' });
    } finally {
      setHcConnecting(false);
    }
  }

  async function toggleDeviceConnection(device: Device) {
    try {
      const nextConnected = !device.is_connected;
      await supabase
        .from('devices')
        .update({ is_connected: nextConnected, last_seen_at: new Date().toISOString() })
        .eq('id', device.id);
      if (device.type === 'heart_rate_monitor') {
        setSelectedBluetoothDevice(nextConnected ? device.model : null);
      }
      await loadDevices();
    } catch (error) {
      console.error('[Dispositivos] Error actualizando dispositivo:', error);
    }
  }

  async function confirmDeleteDevice() {
    const device = deviceToDelete;
    if (!device) return;
    setDeviceToDelete(null);
    try {
      await supabase.from('devices').delete().eq('id', device.id);
      if (device.type === 'heart_rate_monitor') setSelectedBluetoothDevice(null);
      await loadDevices();
      showSnackbar({ type: 'success', message: en ? `${device.name} removed.` : `${device.name} eliminado.` });
    } catch (error) {
      console.error('[Dispositivos] Error eliminando dispositivo:', error);
      showSnackbar({ type: 'error', message: en ? "Couldn't remove the device." : 'No se pudo eliminar el dispositivo.' });
    }
  }

  function getDeviceIcon(type: string) {
    if (type === 'smartwatch' || type === 'heart_rate_monitor') return Watch;
    return Smartphone;
  }

  function formatLastSeen(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return en ? 'Now' : 'Ahora';
    if (minutes < 60) return en ? `${minutes} min ago` : `Hace ${minutes} min`;
    if (hours < 24) return en ? `${hours} h ago` : `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    return en ? `${days} day${days > 1 ? 's' : ''} ago` : `Hace ${days} día${days > 1 ? 's' : ''}`;
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 20 }}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>{en ? 'Devices' : 'Dispositivos'}</Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'Bluetooth sensor · live HR' : 'Sensor Bluetooth · FC en vivo'}</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {en
                ? 'Connect a Bluetooth heart-rate band or sensor (chest strap, FitPro-style wristband, etc.) to see your heart rate in real time.'
                : 'Conecta una banda o sensor de pulso por Bluetooth (banda de pecho, pulsera tipo FitPro, etc.) para ver tu ritmo cardíaco en tiempo real.'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={startScan}
              activeOpacity={0.85}
            >
              {scanning ? <ActivityIndicator color="white" size="small" /> : <Search size={20} color="white" />}
              <Text style={styles.primaryButtonText}>
                {scanning ? (en ? 'Scanning...' : 'Escaneando...') : (en ? 'Search devices' : 'Buscar dispositivos')}
              </Text>
            </TouchableOpacity>

            {bleDevices.length > 0 && (
              <View style={styles.foundList}>
                <Text style={[styles.foundTitle, { color: colors.text }]}>{en ? 'Devices found' : 'Dispositivos encontrados'}</Text>
                {bleDevices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    style={[styles.foundItem, { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => connectBleDevice(device)}
                  >
                    <Bluetooth size={16} color={colors.textSecondary} />
                    <Text style={[styles.foundName, { color: colors.text }]}>
                      {device.name || (en ? 'Unnamed device' : 'Dispositivo sin nombre')}
                    </Text>
                    <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Activity size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{en ? 'Watch via Health Connect' : 'Reloj vía Health Connect'}</Text>
            </View>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {en
                ? 'If your watch syncs with Health Connect, connect it here. Data comes from the health history, so it may be delayed (not real time).'
                : 'Si tu reloj sincroniza con Health Connect, conéctalo aquí. Los datos llegan del historial de salud, así que pueden tener algo de retraso (no es tiempo real).'}
            </Text>
            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.primary }]}
              onPress={connectHealthConnect}
              activeOpacity={0.85}
              disabled={hcConnecting}
            >
              {hcConnecting
                ? <ActivityIndicator color={colors.primary} size="small" />
                : <Activity size={18} color={colors.primary} />}
              <Text style={[styles.outlineButtonText, { color: colors.primary }]}>
                {hcConnecting ? (en ? 'Connecting...' : 'Conectando...') : (en ? 'Connect watch' : 'Conectar reloj')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{en ? 'My devices' : 'Mis dispositivos'}</Text>

          {devices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Smartphone size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {en ? "You haven't connected any device yet" : 'Aún no has conectado ningún dispositivo'}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {en ? 'Connect a Bluetooth sensor or your watch to start.' : 'Conecta un sensor Bluetooth o tu reloj para empezar.'}
              </Text>
            </View>
          ) : (
            devices.map((device) => {
              const Icon = getDeviceIcon(device.type);
              return (
                <TouchableOpacity
                  key={device.id}
                  style={[styles.deviceCard, { backgroundColor: colors.surface }]}
                  onPress={() => toggleDeviceConnection(device)}
                  onLongPress={() => setDeviceToDelete(device)}
                >
                  <View style={styles.deviceLeft}>
                    <View style={[styles.iconContainer, {
                      backgroundColor: device.is_connected ? colors.primary + '20' : colors.surfaceElevated,
                    }]}>
                      <Icon size={24} color={device.is_connected ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                      {device.manufacturer && (
                        <Text style={[styles.deviceModel, { color: colors.textMuted }]}>
                          {device.type === 'heart_rate_monitor' ? (en ? 'Bluetooth · live HR' : 'Bluetooth · FC en vivo') : device.manufacturer}
                        </Text>
                      )}
                      <Text style={[styles.deviceStatus, { color: device.is_connected ? colors.success : colors.textSecondary }]}>
                        {device.is_connected ? (en ? 'Connected' : 'Conectado') : (en ? `Last seen: ${formatLastSeen(device.last_seen_at)}` : `Última conexión: ${formatLastSeen(device.last_seen_at)}`)}
                      </Text>
                    </View>
                  </View>
                  {device.is_connected && (
                    <View style={[styles.connectedIndicator, { backgroundColor: colors.success + '20' }]}>
                      <Check size={16} color={colors.success} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {en
              ? 'Tap a device to connect/disconnect · long-press to remove.'
              : 'Toca un dispositivo para conectar/desconectar · mantén presionado para eliminar.'}
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={!!deviceToDelete}
        title={en ? 'Remove device' : 'Eliminar dispositivo'}
        message={deviceToDelete
          ? (en ? `Remove ${deviceToDelete.name}? You can connect it again anytime.` : `¿Eliminar ${deviceToDelete.name}? Podrás volver a conectarlo cuando quieras.`)
          : ''}
        variant="destructive"
        confirmText={en ? 'Remove' : 'Eliminar'}
        cancelText={en ? 'Cancel' : 'Cancelar'}
        onConfirm={confirmDeleteDevice}
        onCancel={() => setDeviceToDelete(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 15,
    paddingHorizontal: 24, paddingTop: 10, marginBottom: 20,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  content: { paddingHorizontal: 24 },

  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardText: { fontSize: 14, lineHeight: 20, marginBottom: 14 },

  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  outlineButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  outlineButtonText: { fontSize: 15, fontWeight: '600' },

  foundList: { marginTop: 16, gap: 8 },
  foundTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  foundItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
  },
  foundName: { fontSize: 14 },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  deviceCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 16, marginBottom: 12,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: {
    width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  deviceInfo: { gap: 2, flex: 1 },
  deviceName: { fontSize: 16, fontWeight: '600' },
  deviceModel: { fontSize: 12 },
  deviceStatus: { fontSize: 14 },
  connectedIndicator: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
