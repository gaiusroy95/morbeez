const fs = require('fs');

function patchPipelineInvoice() {
  const path = 'backend/src/services/whatsapp/pipeline/whatsapp-inbound.pipeline.ts';
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes('farmActivityInvoiceEvidenceService')) {
    s = s.replace(
      "import { farmActivityAssistantService } from '../../farm-activity/farm-activity-assistant.service.js';\n",
      "import { farmActivityAssistantService } from '../../farm-activity/farm-activity-assistant.service.js';\nimport { farmActivityInvoiceEvidenceService } from '../../farm-activity/farm-activity-invoice-evidence.service.js';\nimport { env } from '../../../config/env.js';\n"
    );
  }

  // Avoid duplicate env import
  const envCount = (s.match(/from '\.\.\/\.\.\/\.\.\/config\/env\.js'/g) || []).length;
  if (envCount > 1) {
    // keep first existing env import if present; remove the one we just added if file already had env
    const firstEnv = s.indexOf("import { env } from '../../../config/env.js';");
    const secondEnv = s.indexOf("import { env } from '../../../config/env.js';", firstEnv + 1);
    if (firstEnv >= 0 && secondEnv >= 0) {
      s = s.slice(0, secondEnv) + s.slice(secondEnv).replace("import { env } from '../../../config/env.js';\n", '');
    }
  }

  if (!s.includes('ENABLE_FARM_ACTIVITY_INVOICE_OCR')) {
    const marker =
      "    if (!media.imageBase64) {\n      await sendText(\n        captured.phone,\n        imageQualityMessage(captured.language, 'unsupported')\n      );\n      return;\n    }";
    const insert =
      "    const invoiceCaption = (msg.text ?? '').trim();\n    const looksLikeInvoice =\n      env.ENABLE_FARM_ACTIVITY_ASSISTANT &&\n      env.ENABLE_FARM_ACTIVITY_INVOICE_OCR &&\n      (/invoice|receipt|bill|രസീത്|ബിൽ|चालान|ರಸೀದಿ|ரசீது/i.test(invoiceCaption) ||\n        /document/i.test(msg.msgType) ||\n        Boolean(media.fileName && /\\.(pdf|jpe?g|png)$/i.test(media.fileName)));\n    if (looksLikeInvoice && media.imageBase64 && senders) {\n      try {\n        const buffer = Buffer.from(media.imageBase64, 'base64');\n        const invoice = await farmActivityInvoiceEvidenceService.extract({\n          farmerId: captured.farmerId,\n          source: {\n            messageId: msg.messageId,\n            channel: 'whatsapp',\n            text: invoiceCaption || undefined,\n          },\n          media: {\n            kind: /pdf/i.test(media.imageMimeType ?? '') || /\\.pdf$/i.test(media.fileName ?? '') ? 'pdf' : 'image',\n            mimeType: media.imageMimeType ?? 'image/jpeg',\n            fileName: media.fileName,\n            buffer,\n            mediaId: msg.messageId,\n          },\n        });\n        if (invoice.ok && invoice.draftEvidence.purchaseSubEvents.length) {\n          const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);\n          const handled = await farmActivityAssistantService.tryHandleInbound({\n            farmerId: captured.farmerId,\n            phone: captured.phone,\n            language: captured.language,\n            text: invoiceCaption || 'invoice purchase',\n            messageId: msg.messageId,\n            sessionState: session.state,\n            send: senders,\n            modality: 'text',\n            conversationSessionId: session.id,\n            blockId: session.active_block_id ?? null,\n          });\n          if (handled) return;\n        }\n      } catch (err) {\n        logger.warn({ err, farmerId: captured.farmerId }, 'Farm activity invoice OCR path failed');\n      }\n    }\n\n    if (!media.imageBase64) {\n      await sendText(\n        captured.phone,\n        imageQualityMessage(captured.language, 'unsupported')\n      );\n      return;\n    }";
    if (!s.includes(marker)) throw new Error('invoice marker not found');
    s = s.replace(marker, insert);
  }

  fs.writeFileSync(path, s);
  console.log('invoice pipeline patched');
}

patchPipelineInvoice();
