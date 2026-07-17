const fs = require('fs');

function patchRouter() {
  const path = 'backend/src/services/whatsapp/scenarios/whatsapp-scenario-router.service.ts';
  let s = fs.readFileSync(path, 'utf8');
  const importLine =
    "import { farmActivityAssistantService } from '../../farm-activity/farm-activity-assistant.service.js';\n";
  if (!s.includes('farm-activity-assistant.service')) {
    s = s.replace(
      "import { recoveryValidationService } from '../../case/recovery-validation.service.js';\n",
      "import { recoveryValidationService } from '../../case/recovery-validation.service.js';\n" + importLine
    );
  }

  if (!s.includes('farmActivityAssistantService.tryHandleInbound')) {
    const marker =
      "      if (roiHandled) return { handled: true };\n    }\n\n    if (session.state === 'post_diagnosis_intake') {";
    const insert =
      "      if (roiHandled) return { handled: true };\n    }\n\n    if (\n      farmActivityAssistantService.enabled() &&\n      (\n        farmActivityAssistantService.isFarmActivityState(session.state) ||\n        farmActivityAssistantService.isActionButton(text) ||\n        Boolean(text && farmActivityAssistantService.looksLikeIntent(text))\n      )\n    ) {\n      const farmHandled = await farmActivityAssistantService.tryHandleInbound({\n        farmerId: captured.farmerId,\n        phone: msg.phone,\n        language: lang,\n        text,\n        messageId: msg.messageId,\n        sessionState: session.state,\n        send,\n        modality: 'text',\n        conversationSessionId: session.id,\n        blockId: session.active_block_id ?? null,\n      });\n      if (farmHandled) return { handled: true };\n    }\n\n    if (session.state === 'post_diagnosis_intake') {";
    if (!s.includes(marker)) {
      throw new Error('router marker not found');
    }
    s = s.replace(marker, insert);
  }

  fs.writeFileSync(path, s);
  console.log('router patched');
}

function patchPipeline() {
  const path = 'backend/src/services/whatsapp/pipeline/whatsapp-inbound.pipeline.ts';
  let s = fs.readFileSync(path, 'utf8');
  const importLine =
    "import { farmActivityAssistantService } from '../../farm-activity/farm-activity-assistant.service.js';\n";
  if (!s.includes('farm-activity-assistant.service')) {
    // Insert near other service imports; find a stable import.
    const anchor = "import { farmerFeedbackFlowService } from '../scenarios/farmer-feedback-flow.service.js';\n";
    if (!s.includes(anchor)) throw new Error('pipeline import anchor not found');
    s = s.replace(anchor, anchor + importLine);
  }

  if (!s.includes('farmActivityAssistantService.voiceEnabled')) {
    const marker =
      "    const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);\n    if (session.state === 'farmer_feedback_capture' && send && transcript?.trim()) {";
    const insert =
      "    const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);\n    if (\n      farmActivityAssistantService.voiceEnabled() &&\n      send &&\n      transcript?.trim() &&\n      (\n        farmActivityAssistantService.isFarmActivityState(session.state) ||\n        farmActivityAssistantService.looksLikeIntent(transcript)\n      )\n    ) {\n      const farmHandled = await farmActivityAssistantService.tryHandleInbound({\n        farmerId: captured.farmerId,\n        phone: captured.phone,\n        language: captured.language,\n        text: transcript.trim(),\n        messageId: msg.messageId,\n        sessionState: session.state,\n        send,\n        modality: 'voice',\n        transcript: transcript.trim(),\n        conversationSessionId: session.id,\n        blockId: session.active_block_id ?? null,\n      });\n      if (farmHandled) return;\n    }\n    if (session.state === 'farmer_feedback_capture' && send && transcript?.trim()) {";
    if (!s.includes(marker)) throw new Error('pipeline voice marker not found');
    s = s.replace(marker, insert);
  }

  fs.writeFileSync(path, s);
  console.log('pipeline patched');
}

patchRouter();
patchPipeline();
