import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { STAFF_API_V1, staffApi, tokens } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, ListCard, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

const FIELD = `${STAFF_API_V1}/os/field`;

type Farmer = { id: string; name: string; phone: string | null; district: string | null };
type Block = { id: string; name: string; cropType: string; plotLabel: string | null };
type ListItem = Farmer | Block;

function isBlock(item: ListItem): item is Block {
  return 'cropType' in item;
}

export default function VisitsScreen() {
  const router = useRouter();
  const { logout } = useStaffAuth();
  const [query, setQuery] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search() {
    setError('');
    try {
      const data = await staffApi<{ ok: boolean; farmers: Farmer[] }>(
        `${FIELD}/farmers/search?q=${encodeURIComponent(query.trim())}`
      );
      setFarmers(data.farmers ?? []);
      setSelectedFarmer(null);
      setBlocks([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    }
  }

  async function selectFarmer(f: Farmer) {
    setSelectedFarmer(f);
    setError('');
    setBusy(true);
    try {
      const data = await staffApi<{ ok: boolean; blocks: Block[] }>(`${FIELD}/farmers/${f.id}/blocks`);
      setBlocks(data.blocks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocks');
    } finally {
      setBusy(false);
    }
  }

  function startVisit(block: Block) {
    if (!selectedFarmer) return;
    router.push({
      pathname: '/visit',
      params: {
        farmerId: selectedFarmer.id,
        blockId: block.id,
        blockName: block.name,
        cropType: block.cropType,
        farmerName: selectedFarmer.name,
      },
    });
  }

  const listData: ListItem[] = selectedFarmer ? blocks : farmers;

  return (
    <View style={styles.root}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <TextInput
              style={styles.search}
              placeholder="Search farmer by name or phone"
              placeholderTextColor={tokens.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
            />
            <Btn label="Search" onPress={search} />
            {selectedFarmer ? (
              <Panel title={`Blocks — ${selectedFarmer.name}`}>
                <Btn
                  label="Back to search"
                  onPress={() => {
                    setSelectedFarmer(null);
                    setBlocks([]);
                  }}
                  variant="secondary"
                />
              </Panel>
            ) : null}
          </>
        }
        renderItem={({ item }) =>
          selectedFarmer && isBlock(item) ? (
            <ListCard
              title={item.name}
              subtitle={[item.cropType, item.plotLabel].filter(Boolean).join(' · ')}
              onPress={() => startVisit(item)}
            />
          ) : !selectedFarmer && !isBlock(item) ? (
            <ListCard
              title={item.name}
              subtitle={[item.phone, item.district].filter(Boolean).join(' · ')}
              onPress={() => selectFarmer(item)}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState>
            {busy
              ? 'Loading blocks…'
              : selectedFarmer
                ? 'No blocks for this farmer.'
                : 'Search to find a farmer.'}
          </EmptyState>
        }
        ListFooterComponent={<Btn label="Sign out" onPress={() => void logout()} variant="secondary" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
    color: tokens.text,
  },
});
