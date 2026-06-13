import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatPaise, tokens } from '@morbeez/shared';
import { Btn, EmptyState, Panel, useStickyFooterPadding } from '@morbeez/ui-native';
import { useShopCart } from '@/context/ShopCartContext';

export default function CartScreen() {
  const router = useRouter();
  const { items, totalPaise, setQuantity, removeItem } = useShopCart();
  const bottomPad = useStickyFooterPadding(0);

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState>Your cart is empty.</EmptyState>
        <Btn label="Browse products" onPress={() => router.replace('/(tabs)/shop')} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 140 + bottomPad }]}>
      <Panel title="Smart cart">
        <Text style={styles.hint}>
          Items from recommendations and recovery kits appear here. Adjust quantities before checkout.
        </Text>
      </Panel>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePh]} />
          )}
          <View style={styles.main}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {item.variantTitle ? <Text style={styles.variant}>{item.variantTitle}</Text> : null}
            <Text style={styles.price}>{formatPaise(item.pricePaise)}</Text>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity(item.key, item.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{item.quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity(item.key, item.quantity + 1)}
                disabled={item.quantity >= item.maxQuantity}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Pressable onPress={() => removeItem(item.key)} style={styles.remove}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.lineTotal}>{formatPaise(item.pricePaise * item.quantity)}</Text>
        </View>
      ))}

      <Panel title="Order summary">
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatPaise(totalPaise)}</Text>
        </View>
      </Panel>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + bottomPad }]}>
        <Btn label={`Checkout · ${formatPaise(totalPaise)}`} onPress={() => router.push('/shop/checkout')} />
        <Btn label="Continue shopping" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
  emptyWrap: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 16, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 10,
  },
  image: { width: 72, height: 72, borderRadius: 8 },
  imagePh: { backgroundColor: tokens.border },
  main: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: tokens.text },
  variant: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  price: { fontSize: 13, color: tokens.green800, fontWeight: '600', marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg,
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: tokens.text },
  qty: { fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  remove: { marginLeft: 4 },
  removeText: { fontSize: 12, color: tokens.danger, fontWeight: '600' },
  lineTotal: { fontSize: 14, fontWeight: '700', color: tokens.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: tokens.textMuted },
  summaryValue: { fontSize: 16, fontWeight: '700', color: tokens.green800 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
});
