import { useLocalSearchParams } from 'expo-router';
import { DocumentPrintViewer } from '@/components/DocumentPrintViewer';
import type { PrintDocType } from '@/lib/document-html';

export default function PrintDocumentScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  return (
    <DocumentPrintViewer docType={(type ?? 'packing_slip') as PrintDocType} entityId={id ?? ''} />
  );
}
