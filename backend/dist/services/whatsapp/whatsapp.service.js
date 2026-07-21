import { env } from '../../config/env.js';
import { cloudWhatsAppProvider } from './providers/cloud.provider.js';
import { watiWhatsAppProvider } from './providers/wati.provider.js';
import { interaktWhatsAppProvider } from './providers/interakt.provider.js';
import { adsgyaniWhatsAppProvider } from './providers/adsgyani.provider.js';
import { whatsappInboundPipeline } from './pipeline/whatsapp-inbound.pipeline.js';
import { whatsappOutboundService } from './whatsapp-outbound.service.js';
import { logger } from '../../lib/logger.js';
import { sendReplyButtonMenu } from './whatsapp-interactive-menu.service.js';
import { extractInteractiveReplyText, resolveInboundUserText, } from './inbound-reply-text.util.js';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function simulateTypingDelay(text) {
    if (!env.WHATSAPP_TYPING_SIMULATION)
        return;
    const min = Math.max(0, env.WHATSAPP_TYPING_MIN_MS);
    const max = Math.max(min, env.WHATSAPP_TYPING_MAX_MS);
    const textFactor = Math.min(1800, Math.max(0, Math.floor(text.length * 18)));
    const jitter = Math.floor(Math.random() * (max - min + 1));
    await sleep(min + jitter + textFactor);
}
function getProvider() {
    if (env.WHATSAPP_PROVIDER === 'adsgyani')
        return adsgyaniWhatsAppProvider;
    if (env.WHATSAPP_PROVIDER === 'wati')
        return watiWhatsAppProvider;
    if (env.WHATSAPP_PROVIDER === 'interakt')
        return interaktWhatsAppProvider;
    return cloudWhatsAppProvider;
}
/** Ads Gyani Settings → API & Webhook: { contact, message } */
export function parseAdsGyaniWebhook(payload) {
    const contact = payload.contact;
    const message = payload.message;
    const fromRaw = String(contact?.phone_number ??
        payload.from ??
        payload.phone_number ??
        payload.wa_id ??
        payload.sender ??
        '').replace(/\D/g, '');
    if (!fromRaw)
        return null;
    let msgType = String(message?.type ?? message?.message_type ?? payload.type ?? payload.message_type ?? 'text');
    const hasImage = Boolean(message?.image?.url) ||
        Boolean(message?.image?.id) ||
        Boolean(message?.media_url) ||
        Boolean(message?.header_image) ||
        Boolean(payload.media_url);
    if (hasImage && msgType === 'text')
        msgType = 'image';
    const textObj = message?.text;
    const buttonObj = message?.button;
    const interactive = message?.interactive;
    const interactiveReply = extractInteractiveReplyText(interactive);
    let text = '';
    if (interactiveReply) {
        text = interactiveReply;
    }
    else if (typeof message?.message_body === 'string' && message.message_body.trim()) {
        text = message.message_body;
    }
    else if (textObj?.body)
        text = textObj.body;
    else if (typeof message?.body === 'string')
        text = message.body;
    else if (buttonObj?.text)
        text = buttonObj.text;
    else if (typeof message?.caption === 'string')
        text = message.caption;
    else if (typeof payload.text === 'string')
        text = payload.text;
    else if (typeof payload.message === 'string')
        text = payload.message;
    else if (typeof payload.body === 'string')
        text = payload.body;
    const messageId = String(message?.id ?? message?.wamid ?? message?.message_id ?? payload.id ?? payload.message_id ?? '');
    const profileName = [contact?.first_name, contact?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || contact?.name;
    return {
        from: fromRaw,
        msgType,
        text,
        messageId,
        profileName: profileName || undefined,
        messageObject: message,
    };
}
function toInboundFromAdsGyani(payload, parsed) {
    return {
        channel: 'whatsapp_adsgyani',
        phone: parsed.from,
        messageId: parsed.messageId,
        msgType: parsed.msgType,
        text: parsed.text,
        profileName: parsed.profileName,
        rawPayload: payload,
        messageObject: parsed.messageObject,
        attribution: {
            referralSource: payload.referral_source ?? 'whatsapp',
            campaignSource: payload.campaign_source,
            affiliateSource: payload.affiliate_source,
        },
    };
}
export const whatsappService = {
    getProvider,
    async sendText(to, text) {
        try {
            await simulateTypingDelay(text);
            await getProvider().sendText(to, text);
            logger.info({ to: to.replace(/\d(?=\d{4})/g, '*'), chars: text.length }, 'WhatsApp outbound sent');
        }
        catch (err) {
            logger.error({ err, to }, 'WhatsApp outbound failed');
            throw err;
        }
    },
    async sendImage(to, imageUrl, caption) {
        const provider = getProvider();
        if (!provider.sendImage) {
            throw new Error('Current WhatsApp provider does not support image messages');
        }
        try {
            await provider.sendImage(to, imageUrl, caption);
            logger.info({ to: to.replace(/\d(?=\d{4})/g, '*') }, 'WhatsApp image sent');
        }
        catch (err) {
            logger.error({ err, to }, 'WhatsApp image send failed');
            throw err;
        }
    },
    async sendButtons(params) {
        const provider = getProvider();
        if (!provider.sendButtons) {
            const labels = params.buttons.map((b) => b.title).join(' / ');
            await this.sendText(params.to, `${params.body}\n\nReply: ${labels}`);
            return;
        }
        await provider.sendButtons(params);
    },
    /**
     * Sends menu options as reply buttons (not list/select UI).
     * WhatsApp allows max 3 buttons per message; larger menus are sent in chunks.
     */
    async sendList(params) {
        const options = params.sections.flatMap((s) => s.rows.map((r) => ({ id: r.id, title: r.title })));
        const bodyText = params.header ? `${params.header}\n\n${params.body}` : params.body;
        await sendReplyButtonMenu({
            to: params.to,
            body: bodyText,
            options,
            continuationBody: 'More options — tap a button below:',
            sendButtons: (p) => this.sendButtons(p),
        });
    },
    async sendTemplate(to, templateName, params) {
        await getProvider().sendTemplate(to, templateName, params);
    },
    async sendToFarmer(params) {
        return whatsappOutboundService.sendToFarmer(getProvider(), params);
    },
    async sendWelcomeTemplate(params) {
        return whatsappOutboundService.sendWelcomeTemplate(getProvider(), params);
    },
    async handleAdsGyaniInbound(payload) {
        if (payload.entry) {
            await this.handleCloudInbound(payload);
            return;
        }
        const parsed = parseAdsGyaniWebhook(payload);
        if (!parsed)
            return;
        const inbound = toInboundFromAdsGyani(payload, parsed);
        inbound.text = resolveInboundUserText(inbound) || inbound.text;
        await whatsappInboundPipeline.process(inbound, {
            text: (phone, text) => this.sendText(phone, text),
            list: (p) => this.sendList({
                to: p.phone,
                header: p.header,
                body: p.body,
                buttonText: p.buttonText,
                sections: p.sections,
            }),
            buttons: (p) => this.sendButtons({
                to: p.phone,
                body: p.body,
                buttons: p.buttons,
            }),
        }, {
            sendWelcomeTemplate: (phone, farmerId, profileName) => this.sendWelcomeTemplate({ phone, farmerId, profileName }),
        });
    },
    async handleCloudInbound(payload) {
        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;
        const contacts = value?.contacts;
        const statuses = value?.statuses;
        if (!messages?.length) {
            if (statuses?.length) {
                const { broadcastCampaignService } = await import('./broadcasts/broadcast-campaign.service.js');
                for (const st of statuses) {
                    const messageId = String(st.id ?? '');
                    const status = String(st.status ?? '');
                    if (!messageId)
                        continue;
                    try {
                        if (status === 'delivered') {
                            await broadcastCampaignService.recordDeliveryStatus({
                                whatsappMessageId: messageId,
                                status: 'delivered',
                            });
                        }
                        else if (status === 'read') {
                            await broadcastCampaignService.recordDeliveryStatus({
                                whatsappMessageId: messageId,
                                status: 'read',
                            });
                        }
                    }
                    catch (err) {
                        logger.warn({ err, messageId, status }, 'Broadcast delivery status update failed');
                    }
                }
                logger.debug({ statusCount: statuses.length }, 'Meta WhatsApp status webhook (delivery/read) processed');
            }
            return;
        }
        for (const msg of messages) {
            try {
                const from = String(msg.from ?? '');
                if (!from)
                    continue;
                const msgType = String(msg.type ?? 'text');
                const interactive = msg.interactive;
                const interactiveReply = extractInteractiveReplyText(interactive);
                let text = interactiveReply ?? '';
                if (!text) {
                    text =
                        msg.text?.body ??
                            msg.button?.text ??
                            '';
                }
                if (!text) {
                    text = msg.image?.caption ?? '';
                }
                const contact = contacts?.find((c) => String(c.wa_id) === from);
                const profile = contact?.profile;
                logger.info({ from, msgType, hasText: Boolean(text) }, 'WhatsApp Cloud inbound message');
                const inbound = {
                    channel: 'whatsapp_cloud',
                    phone: from,
                    messageId: String(msg.id ?? ''),
                    msgType,
                    text: text ?? '',
                    profileName: profile?.name,
                    rawPayload: msg,
                    messageObject: msg,
                    attribution: {
                        referralSource: 'whatsapp',
                        campaignSource: value?.metadata?.campaign_id,
                    },
                };
                inbound.text = resolveInboundUserText(inbound) || inbound.text;
                await whatsappInboundPipeline.process(inbound, {
                    text: (phone, t) => this.sendText(phone, t),
                    list: (p) => this.sendList({
                        to: p.phone,
                        header: p.header,
                        body: p.body,
                        buttonText: p.buttonText,
                        sections: p.sections,
                    }),
                    buttons: (p) => this.sendButtons({
                        to: p.phone,
                        body: p.body,
                        buttons: p.buttons,
                    }),
                }, {
                    sendWelcomeTemplate: (phone, farmerId, profileName) => this.sendWelcomeTemplate({ phone, farmerId, profileName }),
                });
            }
            catch (err) {
                logger.error({ err, msgId: msg.id }, 'WhatsApp inbound message processing failed');
            }
        }
    },
};
//# sourceMappingURL=whatsapp.service.js.map