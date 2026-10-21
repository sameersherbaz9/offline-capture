import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  FlatList, Switch, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

type Status = 'pending' | 'syncing' | 'synced' | 'error';
type Item = { id: string; text: string; createdAt: number; status: Status; retries: number };

const KEY = 'items:v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mock backend. Replace with a real fetch() if needed.
async function fakeApi(_item: Item, forceFail: boolean) {
  await sleep(1500);
  if (forceFail) throw new Error('Server error');
}

const COLORS: Record<Status, string> = {
  pending: '#f59e0b',
  syncing: '#3b82f6',
  synced: '#22c55e',
  error: '#ef4444',
};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [online, setOnline] = useState(true);
  const [simOffline, setSimOffline] = useState(false);
  const [forceFail, setForceFail] = useState(false);

  const itemsRef = useRef<Item[]>([]);
  const failRef = useRef(false);
  const netOn = useRef(true);
  const simOff = useRef(false);
  const onlineRef = useRef(true);
  const syncing = useRef(false);

  // Update state + persist locally on every change
  const update = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const setStatus = (id: string, status: Status, retries?: number) =>
    update(
      itemsRef.current.map((i) =>
        i.id === id ? { ...i, status, retries: retries ?? i.retries } : i
      )
    );

  // Sync queue: pending + error items, one by one
  const sync = async () => {
    if (syncing.current || !onlineRef.current) return;
    syncing.current = true;
    try {
      const queue = itemsRef.current.filter((i) => i.status === 'pending' || i.status === 'error');
      for (const item of queue) {
        if (!onlineRef.current) break;
        setStatus(item.id, 'syncing');
        try {
          await fakeApi(item, failRef.current);
          setStatus(item.id, 'synced');
        } catch {
          setStatus(item.id, 'error', item.retries + 1);
        }
      }
    } finally {
      syncing.current = false;
    }
  };

  const refreshOnline = () => {
    const on = netOn.current && !simOff.current;
    onlineRef.current = on;
    setOnline(on);
    if (on) sync(); // retry on reconnect
  };

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const list: Item[] = JSON.parse(raw).map((i: Item) =>
          i.status === 'syncing' ? { ...i, status: 'pending' } : i // app killed mid-sync
        );
        update(list);
        sync();
      }
    })();
    const unsub = NetInfo.addEventListener((s) => {
      netOn.current = !!s.isConnected && s.isInternetReachable !== false;
      refreshOnline();
    });
    return unsub;
  }, []);

  const add = () => {
    if (!text.trim()) return;
    const item: Item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
    };
    update([item, ...itemsRef.current]);
    setText('');
    sync();
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={[s.banner, { backgroundColor: online ? '#22c55e' : '#6b7280' }]}>
        <Text style={s.bannerText}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
      </View>

      <View style={s.row}>
        <Text>Simulate offline</Text>
        <Switch
          value={simOffline}
          onValueChange={(v) => { setSimOffline(v); simOff.current = v; refreshOnline(); }}
        />
      </View>
      <View style={s.row}>
        <Text>Force server error</Text>
        <Switch
          value={forceFail}
          onValueChange={(v) => { setForceFail(v); failRef.current = v; }}
        />
      </View>

      <View style={s.row}>
        <TextInput
          style={s.input}
          placeholder="Capture a field note..."
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <TouchableOpacity style={s.btn} onPress={add}>
          <Text style={s.btnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardText}>{item.text}</Text>
              <Text style={s.meta}>
                {new Date(item.createdAt).toLocaleTimeString()}
                {item.retries ? `  ·  retries: ${item.retries}` : ''}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: COLORS[item.status] }]}>
              <Text style={s.badgeText}>{item.status}</Text>
            </View>
            {item.status === 'error' && (
              <TouchableOpacity onPress={sync} style={s.retry}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 30 },
  banner: { padding: 8, alignItems: 'center' },
  bannerText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10 },
  btn: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, gap: 8 },
  cardText: { fontSize: 16 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  retry: { paddingHorizontal: 8, paddingVertical: 4 },
  retryText: { color: '#ef4444', fontWeight: '700' },
});