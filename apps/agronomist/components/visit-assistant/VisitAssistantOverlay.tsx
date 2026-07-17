import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  tokens,
  type VisitAssistantClarification,
  type VisitAssistantUnresolvedField,
} from '@morbeez/shared';
import { AlertBox, Btn, Panel } from '@morbeez/ui-native';
import {
  applyAcceptedOperationsToWizard,
  buildVisitAssistantSnapshot,
  createAssistantMessageId,
  describeVisitAssistantOperation,
  standardPendingOperationIds,
  type VisitAssistantPersistedState,
  type WizardAssistantPatch,
  type WizardAssistantSource,
} from '@/lib/visitAssistantBridge';
import { VisitAssistantComposer } from './VisitAssistantComposer';
import { VisitAssistantMessages } from './VisitAssistantMessages';
import { VisitChangeReviewCard } from './VisitChangeReviewCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  farmerId: string;
  blockId: string;
  sessionId: string | null;
  cropType: string;
  dap: number | null;
  stage: string | null;
  wizard: WizardAssistantSource;
  assistantState: VisitAssistantPersistedState;
  onAssistantStateChange: (next: VisitAssistantPersistedState) => void;
  onApplyPatch: (patch: WizardAssistantPatch) => void;
};

function formatTarget(target: VisitAssistantClarification['target'] | VisitAssistantUnresolvedField['target']): string {
  switch (target.kind) {
    case 'assessment':
      return `assessment.${target.field}`;
    case 'classification':
      return 'classification';
    case 'measurement':
      return `measurement.${target.key}`;
    case 'field_note':
      return 'field note';
    case 'issue':
      return target.issueRef ? `issue ${target.issueRef}` : 'issue';
    case 'recommendation':
      return target.groupRef ? `recommendation ${target.groupRef}` : 'recommendation';
    case 'monitoring':
      return target.monitoringRef ? `monitoring ${target.monitoringRef}` : 'monitoring';
    case 'follow_up':
      return `follow-up ${target.recommendationRef}`;
  }
}

export function VisitAssistantOverlay({
  visible,
  onClose,
  farmerId,
  blockId,
  sessionId,
  cropType,
  dap,
  stage,
  wizard,
  assistantState,
  onAssistantStateChange,
  onApplyPatch,
}: Props) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const snapshot = useMemo(
    () => buildVisitAssistantSnapshot(wizard, assistantState),
    [wizard, assistantState]
  );

  const pendingReviews = useMemo(() => {
    const proposal = assistantState.pendingProposal;
    if (!proposal) return [];
    const rejected = new Set(assistantState.rejectedOperationIds);
    return proposal.operations
      .filter((operation) => !rejected.has(operation.id))
      .map((operation) => describeVisitAssistantOperation(operation, snapshot));
  }, [assistantState.pendingProposal, assistantState.rejectedOperationIds, snapshot]);

  const clarifications = assistantState.pendingProposal?.clarifications ?? [];
  const unresolved = assistantState.pendingProposal?.unresolvedFields ?? [];
  const recommendationValidation = assistantState.recommendationValidation;

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');

    const messageId = createAssistantMessageId('agronomist');
    const createdAt = new Date().toISOString();
    const agronomistMessage = {
      id: messageId,
      role: 'agronomist' as const,
      content,
      createdAt,
    };

    const withUserMessage: VisitAssistantPersistedState = {
      ...assistantState,
      messages: [...assistantState.messages, agronomistMessage],
    };
    onAssistantStateChange(withUserMessage);
    setDraft('');

    try {
      const liveSnapshot = buildVisitAssistantSnapshot(wizard, withUserMessage);
      const proposal = await agronomistClient.extractVisitAssistantProposal({
        farmerId,
        blockId,
        sessionId: sessionId ?? undefined,
        snapshot: liveSnapshot,
        message: { id: messageId, content, createdAt },
      });

      const mergedMessages = [
        ...withUserMessage.messages,
        ...proposal.messages.filter(
          (message) => !withUserMessage.messages.some((existing) => existing.id === message.id)
        ),
      ];

      onAssistantStateChange({
        ...withUserMessage,
        messages: mergedMessages,
        pendingProposal: proposal,
        rejectedOperationIds: [],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Assistant request failed';
      setError(message);
      onAssistantStateChange({
        ...withUserMessage,
        messages: [
          ...withUserMessage.messages,
          {
            id: createAssistantMessageId('system'),
            role: 'system',
            content: `Could not get a proposal: ${message}`,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    } finally {
      setSending(false);
    }
  }

  async function applyIds(operationIds: string[], explicitCriticalConfirmation: boolean) {
    const proposal = assistantState.pendingProposal;
    if (!proposal || !operationIds.length || applying) return;
    setApplying(true);
    setError('');
    try {
      const { applyResult, patch, nextAssistant } = applyAcceptedOperationsToWizard(
        wizard,
        assistantState,
        proposal,
        { acceptedOperationIds: operationIds, explicitCriticalConfirmation }
      );
      if (!applyResult.ok) {
        const detail =
          applyResult.error.code === 'critical_confirmation_required'
            ? 'Confirm critical changes before applying.'
            : applyResult.error.code === 'stale_base_revision'
              ? 'Wizard changed since this proposal. Send a new message to refresh.'
              : applyResult.error.code === 'invalid_proposal'
                ? applyResult.error.errors.join('; ')
                : applyResult.error.detail ?? 'Could not apply proposal';
        setError(detail);
        return;
      }
      if (patch) onApplyPatch(patch);
      const appliedRecommendationChange = proposal.operations.some(
        (operation) =>
          operationIds.includes(operation.id) && operation.kind.startsWith('recommendation.')
      );
      if (!appliedRecommendationChange || !patch) {
        onAssistantStateChange(nextAssistant);
        return;
      }

      onAssistantStateChange(nextAssistant);
      const validation = await agronomistClient.validateVisitAssistantRecommendations({
        farmerId,
        blockId,
        sessionId: sessionId ?? undefined,
        cropType: cropType || undefined,
        dap,
        stage,
        recommendationGroups: patch.recommendationGroups,
      });
      onAssistantStateChange({
        ...nextAssistant,
        safetyConfirmation: null,
        recommendationValidation: validation,
      });
      if (validation.blockers.length) {
        setError(
          `Recommendation kept as an unresolved draft: ${validation.blockers
            .map((item) => item.message)
            .join(' ')}`
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Recommendation was applied but safety validation failed: ${e.message}`
          : 'Recommendation was applied but safety validation failed'
      );
    } finally {
      setApplying(false);
    }
  }

  function rejectOperation(operationId: string) {
    const proposal = assistantState.pendingProposal;
    if (!proposal) return;
    const remaining = proposal.operations.filter((operation) => operation.id !== operationId);
    onAssistantStateChange({
      ...assistantState,
      rejectedOperationIds: Array.from(
        new Set([...assistantState.rejectedOperationIds, operationId])
      ),
      pendingProposal: remaining.length ? { ...proposal, operations: remaining } : null,
    });
  }

  function applyAllSafe() {
    const proposal = assistantState.pendingProposal;
    if (!proposal) return;
    const ids = standardPendingOperationIds(proposal, assistantState.rejectedOperationIds);
    void applyIds(ids, false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Visit assistant</Text>
            <Text style={styles.sub}>Revision {assistantState.revision}</Text>
          </View>
          <Btn label="Close" variant="secondary" onPress={onClose} />
        </View>

        {error ? <AlertBox>{error}</AlertBox> : null}

        <VisitAssistantMessages messages={assistantState.messages} />

        <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent}>
          {clarifications.length ? (
            <Panel title="Clarifications">
              {clarifications.map((item) => (
                <Text key={item.id} style={styles.metaLine}>
                  {item.required ? '* ' : ''}{item.question} ({formatTarget(item.target)})
                </Text>
              ))}
            </Panel>
          ) : null}

          {unresolved.length ? (
            <Panel title="Unresolved">
              {unresolved.map((item, index) => (
                <Text key={`${formatTarget(item.target)}-${index}`} style={styles.metaLine}>
                  {formatTarget(item.target)}: {item.detail}
                </Text>
              ))}
            </Panel>
          ) : null}

          {recommendationValidation?.blockers.length ? (
            <Panel title="Recommendation safety blockers">
              {recommendationValidation.blockers.map((item, index) => (
                <Text key={`${item.code}-${item.materialRef ?? index}`} style={styles.metaLine}>
                  {item.materialRef ? `${item.materialRef}: ` : ''}{item.message}
                </Text>
              ))}
            </Panel>
          ) : null}

          {recommendationValidation?.warnings.length ? (
            <Panel title="Recommendation safety warnings">
              {recommendationValidation.warnings.map((item, index) => (
                <Text key={`${item.code}-${index}`} style={styles.metaLine}>{item.message}</Text>
              ))}
            </Panel>
          ) : null}

          {pendingReviews.length ? (
            <View style={styles.bulkRow}>
              <Btn
                label="Apply all safe"
                variant="secondary"
                onPress={applyAllSafe}
                disabled={applying || sending}
              />
            </View>
          ) : null}

          {pendingReviews.map((review) => (
            <VisitChangeReviewCard
              key={review.operation.id}
              review={review}
              busy={applying || sending}
              onApply={(explicitCriticalConfirmation) =>
                void applyIds([review.operation.id], explicitCriticalConfirmation)
              }
              onReject={() => rejectOperation(review.operation.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.composerWrap}>
          <VisitAssistantComposer
            value={draft}
            onChangeText={setDraft}
            onSend={() => void handleSend()}
            sending={sending}
            disabled={applying}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.bg,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 12, color: tokens.textMuted },
  reviewScroll: { maxHeight: '42%', marginTop: 4 },
  reviewContent: { gap: 10, paddingBottom: 8 },
  metaLine: { fontSize: 13, lineHeight: 18, color: tokens.text, marginBottom: 4 },
  bulkRow: { marginBottom: 4 },
  composerWrap: { marginTop: 8 },
});
