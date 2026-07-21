import { supabase } from '../../../lib/supabase.js';
import { conversationSessionService } from '../conversation-session.service.js';
/** Whether farmer finished language → acre → plot → planting date. */
export const onboardingFlowService = {
    async isComplete(farmerId) {
        const ctx = await conversationSessionService.getContext(farmerId);
        if (ctx.onboardingComplete === true)
            return true;
        if (ctx.onboardingComplete === false)
            return false;
        const { data: session } = await supabase
            .from('conversation_sessions')
            .select('state')
            .eq('farmer_id', farmerId)
            .eq('channel', 'whatsapp')
            .maybeSingle();
        if (session?.state === 'language_select' || session?.state === 'onboarding_minimal') {
            return false;
        }
        const { data: block } = await supabase
            .from('farm_blocks')
            .select('planting_date, acreage_decimal, crop_type')
            .eq('farmer_id', farmerId)
            .is('archived_at', null)
            .order('is_primary', { ascending: false })
            .limit(1)
            .maybeSingle();
        return Boolean(block?.planting_date && block?.acreage_decimal != null && block?.crop_type?.trim());
    },
    async markComplete(farmerId) {
        await conversationSessionService.patchContext(farmerId, {
            onboardingStep: undefined,
            onboardingAcreageBucket: undefined,
            onboardingComplete: true,
        });
        await conversationSessionService.setState(farmerId, 'main_menu');
    },
    currentStepPrompt(step, lang) {
        if (step === 'pincode') {
            return pincodePrompt(lang);
        }
        if (step === 'acreage') {
            return lang === 'ml'
                ? 'ദയവായി ആദ്യം ഏക്കർ തിരഞ്ഞെടുക്കുക.'
                : 'Please choose your cultivation area (acre) first.';
        }
        if (step === 'crop' || step === 'custom_crop') {
            return lang === 'ml'
                ? 'ദയവായി നിങ്ങളുടെ പ്ലോട്ട് (വിള) തിരഞ്ഞെടുക്കുക.'
                : 'Please select your crop plot next.';
        }
        if (step === 'planting_date') {
            return plantingDatePrompt(lang);
        }
        return lang === 'ml'
            ? 'ദയവായി ഓൺബോർഡിംഗ് ഘട്ടങ്ങൾ പൂർത്തിയാക്കുക.'
            : 'Please complete onboarding steps first.';
    },
};
export function plantingDatePrompt(lang) {
    return lang === 'ml'
        ? 'നടീൽ തീയതി DDMMYYYY ഫോർമാറ്റിൽ അയക്കുക. (ഉദാ: 28052026)'
        : 'Send Date of planting in DDMMYYYY format. (Example: 28052026)';
}
export function pincodePrompt(lang) {
    if (lang === 'ml') {
        return 'നിങ്ങളുടെ പ്രദേശത്തിന്റെ 6 അക്ക പിൻകോഡ് അയയ്ക്കുക.';
    }
    if (lang === 'ta') {
        return 'உங்கள் பகுதியின் 6 இலக்க பின்கோடை அனுப்பவும்.';
    }
    if (lang === 'kn') {
        return 'ನಿಮ್ಮ ಪ್ರದೇಶದ 6 ಅಂಕಿಯ ಪಿನ್‌ಕೋಡ್ ಕಳುಹಿಸಿ.';
    }
    if (lang === 'hi') {
        return 'अपने क्षेत्र का 6 अंकों का पिनकोड भेजें।';
    }
    return 'Please send your 6-digit area pincode.';
}
export function invalidPincodeReply(lang) {
    if (lang === 'ml') {
        return 'സാധുവായ 6 അക്ക പിൻകോഡ് അയയ്ക്കുക.';
    }
    if (lang === 'ta') {
        return 'சரியான 6 இலக்க பின்கோடை அனுப்பவும்.';
    }
    if (lang === 'kn') {
        return 'ಮಾನ್ಯ 6 ಅಂಕಿಯ ಪಿನ್‌ಕೋಡ್ ಕಳುಹಿಸಿ.';
    }
    if (lang === 'hi') {
        return 'कृपया मान्य 6 अंकों का पिनकोड भेजें।';
    }
    return 'Please send a valid 6-digit pincode.';
}
export function pincodeSavedReply(lang, district, state) {
    const place = [district, state].filter(Boolean).join(', ');
    if (lang === 'ml') {
        return `നന്ദി! പ്രദേശം: ${place}.`;
    }
    if (lang === 'ta') {
        return `நன்றி! பகுதி: ${place}.`;
    }
    if (lang === 'kn') {
        return `ಧನ್ಯವಾದ! ಪ್ರದೇಶ: ${place}.`;
    }
    if (lang === 'hi') {
        return `धन्यवाद! क्षेत्र: ${place}.`;
    }
    return `Thanks! Area: ${place}.`;
}
export function pincodePendingVerifyReply(lang, pincode) {
    if (lang === 'ml') {
        return `നന്ദി! പിൻകോഡ് ${pincode} സേവ് ചെയ്തു. ഞങ്ങളുടെ ടീം ജില്ല സ്ഥിരീകരിക്കും.`;
    }
    if (lang === 'ta') {
        return `நன்றி! பின்கோட் ${pincode} சேமிக்கப்பட்டது. எங்கள் குழு மாவட்டத்தை உறுதி செய்யும்.`;
    }
    if (lang === 'kn') {
        return `ಧನ್ಯವಾದ! ಪಿನ್‌ಕೋಡ್ ${pincode} ಉಳಿಸಲಾಗಿದೆ. ನಮ್ಮ ತಂಡ ಜಿಲ್ಲೆಯನ್ನು ದೃಢೀಕರಿಸುತ್ತದೆ.`;
    }
    if (lang === 'hi') {
        return `धन्यवाद! पिनकोड ${pincode} सेव हो गया। हमारी टीम जिले की पुष्टि करेगी।`;
    }
    return `Thanks! Pincode ${pincode} saved. Our team will confirm your district shortly.`;
}
/** Extract a 6-digit Indian PIN from free text (strips spaces/punctuation/fullwidth digits). */
export function parsePincodeInput(text) {
    const digits = String(text ?? '')
        .normalize('NFKC')
        .replace(/\D/g, '');
    return digits.length === 6 ? digits : null;
}
//# sourceMappingURL=onboarding-flow.service.js.map