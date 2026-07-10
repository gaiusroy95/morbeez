import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import type { PartnerFarmerHeader as HeaderType, PartnerFarmerWorkspace } from '@morbeez/shared';
import { addFarmerToTodayRoute, formatPhoneDisplay, partnerClient, telHref, tokens, whatsAppHref } from '@morbeez/shared';
import { Btn, KeyValueRow, Panel } from '@morbeez/ui-native';
import { openDirections } from '@/lib/farmer-workspace-routing';

type Props = {
  farmerId: string;
  workspace: PartnerFarmerWorkspace;
  onStartVisit: (blockId?: string) => void;
};

export function PartnerFarmerHeader({ farmerId, workspace, onStartVisit }: Props) {
  const header = workspace.header ?? workspace.farmer;
  const callHref = telHref(header.phone);
  const waHref = whatsAppHref(header.phone);
  const [routeBusy, setRouteBusy] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);

  const mapsUrl = openDirections(header.latitude, header.longitude);

  async function addToRoute() {
    setRouteBusy(true);
    try {
      const blockId = workspace.blocks[0]?.id ? String(workspace.blocks[0].id) : undefined;
      const result = await addFarmerToTodayRoute(partnerClient, farmerId, blockId);
      Alert.alert('Added to route', `${header.name} added to "${result.routeName}".`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add to route');
    } finally {
      setRouteBusy(false);
    }
  }

  async function requestAgronomistVisit() {
    setSupportBusy(true);
    try {
      await partnerClient.createSupportRequest(farmerId, {
        requestType: 'joint_visit',
        notes: 'Partner requested agronomist field visit.',
      });
      Alert.alert('Request sent', 'Expert team has been notified.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send request');
    } finally {
      setSupportBusy(false);
    }
  }

  async function scheduleCallback() {
    try {
      await partnerClient.scheduleCallback(farmerId, 'Partner scheduled callback from farmer profile.');
      Alert.alert('Scheduled', 'Callback task created for tomorrow.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not schedule callback');
    }
  }

  return (
    <Panel title={header.name}>
      <KeyValueRow label="Phone" value={formatPhoneDisplay(header.phone)} />
      <KeyValueRow label="Village" value={header.village ?? '—'} />
      <KeyValueRow label="Primary crop" value={header.primaryCrop ?? '—'} />
      <KeyValueRow
        label="Area"
        value={header.totalAcreage != null ? `${header.totalAcreage} ac` : '—'}
      />
      <KeyValueRow label="Customer owner" value={header.customerOwnerType ?? '—'} />
      <KeyValueRow label="Telecaller" value={header.assignedTelecallerEmail ?? '—'} />
      <View style={styles.actions}>
        <Btn label="Call" onPress={() => callHref && Linking.openURL(callHref)} disabled={!callHref} />
        <Btn
          label="WhatsApp"
          variant="secondary"
          onPress={() => waHref && Linking.openURL(waHref)}
          disabled={!waHref}
        />
        <Btn
          label="Directions"
          variant="secondary"
          onPress={() => mapsUrl && Linking.openURL(mapsUrl)}
          disabled={!mapsUrl}
        />
        <Btn label="Schedule callback" variant="secondary" onPress={() => void scheduleCallback()} />
        <Btn
          label={supportBusy ? 'Sending…' : 'Request agronomist visit'}
          variant="secondary"
          onPress={() => void requestAgronomistVisit()}
          disabled={supportBusy}
        />
        <Btn label="Start visit" variant="secondary" onPress={() => onStartVisit()} />
        <Btn
          label={routeBusy ? 'Adding…' : 'Add to route'}
          variant="secondary"
          onPress={() => void addToRoute()}
          disabled={routeBusy}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
