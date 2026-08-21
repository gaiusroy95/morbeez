import { isNonDiagnosisAgricultureCategory } from '../pipeline/crop-photo-evidence.util.js';
import { responseComposerService } from '../pipeline/response-composer.service.js';
import { createCropAdvisorTask } from '../pipeline/crop-advisor-tasks.service.js';
const COPY = {
    disease_stress: {
        en: { lead: '', question: '', expertEscalation: '' },
        ml: { lead: '', question: '', expertEscalation: '' },
        ta: { lead: '', question: '', expertEscalation: '' },
        kn: { lead: '', question: '', expertEscalation: '' },
        hi: { lead: '', question: '', expertEscalation: '' },
    },
    insect: {
        en: {
            lead: 'Possible insect or pest activity noticed.',
            question: 'Do you see live insects, eggs, or chewing damage on leaves?',
            expertEscalation: 'Pest identification needs expert review.\n\nOur crop advisor team will contact you within 4 hours.',
        },
        ml: {
            lead: 'കീടാക്രമണം സാധ്യതയുണ്ട്.',
            question: 'ജീവനുള്ള കീടങ്ങൾ, മുട്ട, അല്ലെങ്കിൽ ഇല കടിച്ചിട്ടുണ്ടോ?',
            expertEscalation: 'കീടം തിരിച്ചറിയാൻ വിദഗ്ധ പരിശോധന വേണം.\n\nക്രോപ്പ് അഡ്വൈസർ ടീം 4 മണിക്കൂറിനുള്ളിൽ ബന്ധപ്പെടും.',
        },
        ta: {
            lead: 'பூச்சி தாக்கம் சாத்தியம்.',
            question: 'உயிருள்ள பூச்சி, முட்டை, அல்லது இலை கடிப்பு உள்ளதா?',
            expertEscalation: 'பூச்சி அடையாளம் நிபுணர் பார்வை தேவை.\n\nஎங்கள் அணி 4 மணி நேரத்தில் தொடர்பு கொள்ளும்.',
        },
        kn: {
            lead: 'ಕೀಟ ಹಾನಿ ಸಾಧ್ಯತೆ.',
            question: 'ಜೀವಂತ ಕೀಟ, ಮೊಟ್ಟೆ, ಅಥವಾ ಎಲೆ ಕಚ್ಚುವಿಕೆ ಕಾಣುತ್ತೀರಾ?',
            expertEscalation: 'ಕೀಟ ಗುರುತಿಸಲು ತಜ್ಞರ ಪರಿಶೀಲನೆ ಬೇಕು.\n\nನಮ್ಮ ತಂಡ 4 ಗಂಟೆಗಳಲ್ಲಿ ಸಂಪರ್ಕಿಸುತ್ತದೆ.',
        },
        hi: {
            lead: 'कीट / कीट संभावना है।',
            question: 'क्या जीवित कीट, अंडे, या पत्ती काटने के निशान दिख रहे हैं?',
            expertEscalation: 'कीट पहचान के लिए विशेषज्ञ समीक्षा जरूरी है।\n\nहमारी टीम 4 घंटे में संपर्क करेगी।',
        },
    },
    weed: {
        en: {
            lead: 'Possible weed detected near the crop area.',
            question: 'Is it spreading rapidly across the field?',
            expertEscalation: 'Weed identification needs further review.\n\nOur crop advisor team will help confirm this within 4 hours.',
        },
        ml: {
            lead: 'വിളയുടെ അടുത്ത് അനാവശ്യ പുല്ല്/കളം സാധ്യത.',
            question: 'ഇത് വേഗത്തിൽ നിലം മുഴുവൻ പടരുന്നുണ്ടോ?',
            expertEscalation: 'കളം തിരിച്ചറിയാൻ വിദഗ്ധ സഹായം വേണം.\n\nടീം 4 മണിക്കൂറിനുള്ളിൽ ബന്ധപ്പെടും.',
        },
        ta: {
            lead: 'பயிர் பகுதியில் களை சாத்தியம்.',
            question: 'வயல் முழுவதும் விரைவாக பரவுகிறதா?',
            expertEscalation: 'களை அடையாளம் மேலும் பரிசோதனை தேவை.\n\nஎங்கள் அணி 4 மணி நேரத்தில் உதவும்.',
        },
        kn: {
            lead: 'ಬೆಳೆ ಪ್ರದೇಶದಲ್ಲಿ ಕಳೆ ಸಾಧ್ಯತೆ.',
            question: 'ಇದು ತ್ವರಿತವಾಗಿ ಎಲ್ಲೆಡೆ ಹರಡುತ್ತಿದೆಯೇ?',
            expertEscalation: 'ಕಳೆ ಗುರುತಿಸಲು ಮೇಲಿನ ಪರಿಶೀಲನೆ ಬೇಕು.\n\nತಂಡ 4 ಗಂಟೆಗಳಲ್ಲಿ ಸಂಪರ್ಕಿಸುತ್ತದೆ.',
        },
        hi: {
            lead: 'फसल क्षेत्र में खरपतवार की संभावना।',
            question: 'क्या यह तेजी से पूरे खेत में फैल रहा है?',
            expertEscalation: 'खरपतवार पहचान के लिए और समीक्षा चाहिए।\n\nटीम 4 घंटे में संपर्क करेगी।',
        },
    },
    root_soil: {
        en: {
            lead: 'Possible root or soil-side issue.',
            question: 'Are roots becoming soft or is there a foul smell?',
            expertEscalation: 'Root condition needs expert review.\n\nOur crop advisor team will contact you within 4 hours.',
        },
        ml: {
            lead: 'വേര്/മണ്ണ് പ്രശ്നം സാധ്യത.',
            question: 'വേരുകൾ മൃദുവാകുന്നുണ്ടോ, ദുർഗന്ധമുണ്ടോ?',
            expertEscalation: 'വേരിന്റെ നില വിദഗ്ധ പരിശോധന വേണം.\n\nടീം 4 മണിക്കൂറിനുള്ളിൽ ബന്ധപ്പെടും.',
        },
        ta: {
            lead: 'வேர் / மண் பிரச்சனை சாத்தியம்.',
            question: 'வேர்கள் மென்மையாகிறதா, துர்நாற்றம் உள்ளதா?',
            expertEscalation: 'வேர் நிலை நிபுணர் பார்வை தேவை.\n\nஅணி 4 மணி நேரத்தில் தொடர்பு கொள்ளும்.',
        },
        kn: {
            lead: 'ಬೇರು / ಮಣ್ಣಿನ ಸಮಸ್ಯೆ ಸಾಧ್ಯತೆ.',
            question: 'ಬೇರು ಮೃದುವಾಗುತ್ತಿದೆಯೇ, ದುರ್ವಾಸನೆ ಇದೆಯೇ?',
            expertEscalation: 'ಬೇರು ಸ್ಥಿತಿಗೆ ತಜ್ಞರ ಪರಿಶೀಲನೆ ಬೇಕು.\n\nತಂಡ 4 ಗಂಟೆಗಳಲ್ಲಿ ಸಂಪರ್ಕಿಸುತ್ತದೆ.',
        },
        hi: {
            lead: 'जड़ / मिट्टी की समस्या संभव है।',
            question: 'क्या जड़ें नरम हो रही हैं या बदबू है?',
            expertEscalation: 'जड़ की स्थिति के लिए विशेषज्ञ समीक्षा जरूरी है।\n\nटीम 4 घंटे में संपर्क करेगी।',
        },
    },
    compatibility: {
        en: {
            lead: 'Spray mixing / compatibility question noted.',
            question: 'Which two products are you planning to mix in the tank?',
            expertEscalation: 'Tank-mix safety needs expert review.\n\nOur crop advisor team will contact you within 4 hours.',
        },
        ml: {
            lead: 'സ്പ്രേ മിശ്രണം / പൊരുത്തം ചോദ്യം.',
            question: 'ടാങ്കിൽ ഏത് രണ്ട് ഉൽപ്പന്നങ്ങൾ ചേർക്കാൻ പ്ലാൻ ചെയ്യുന്നു?',
            expertEscalation: 'ടാങ്ക് മിശ്രണ സുരക്ഷയ്ക്ക് വിദഗ്ധ സഹായം വേണം.\n\nടീം 4 മണിക്കൂറിനുള്ളിൽ ബന്ധപ്പെടും.',
        },
        ta: {
            lead: 'தெளிப்பு கலப்பு / பொருந்துதல் கேள்வி.',
            question: 'டாங்கில் எந்த இரண்டு பொருட்களை கலக்க திட்டம்?',
            expertEscalation: 'கலப்பு பாதுகாப்புக்கு நிபுணர் பார்வை தேவை.\n\nஅணி 4 மணி நேரத்தில் தொடர்பு கொள்ளும்.',
        },
        kn: {
            lead: 'ಸ್ಪ್ರೇ ಮಿಶ್ರಣ / ಹೊಂದಾಣಿಕೆ ಪ್ರಶ್ನೆ.',
            question: 'ಟ್ಯಾಂಕിൽ ಯಾವ ಎರಡು ಉತ್ಪನ್ನಗಳನ್ನು ಮಿಶ್ರಣ ಮಾಡಲು ಯೋಜಿಸಿದ್ದೀರಿ?',
            expertEscalation: 'ಮಿಶ್ರಣ ಸುರಕ್ಷತೆಗೆ ತಜ್ಞರ ಪರಿಶೀಲನೆ ಬೇಕು.\n\nತಂಡ 4 ಗಂಟೆಗಳಲ್ಲಿ ಸಂಪರ್ಕಿಸುತ್ತದೆ.',
        },
        hi: {
            lead: 'स्प्रे मिक्स / संगतता प्रश्न।',
            question: 'टैंक में कौन से दो उत्पाद मिलाने की योजना है?',
            expertEscalation: 'मिक्स सुरक्षा के लिए विशेषज्ञ समीक्षा जरूरी है।\n\nटीम 4 घंटे में संपर्क करेगी।',
        },
    },
    cultivation: {
        en: {
            lead: 'This looks like a product / fertilizer / bag photo, not a crop leaf problem.',
            question: 'For crop diagnosis, send a close photo of the affected leaves or plant.',
            expertEscalation: 'We cannot diagnose crop disease from a product bag photo.\n\nSend a clear leaf/plant photo, or type *call* for help.',
        },
        ml: {
            lead: 'ഇത് വിളയുടെ ഇല അല്ല, ഉൽപ്പന്നം / വളം ബാഗ് ഫോട്ടോ ആണെന്ന് തോന്നുന്നു.',
            question: 'രോഗനിർണയത്തിന് ബാധിത ഇലയുടെ അടുത്ത ഫോട്ടോ അയയ്ക്കുക.',
            expertEscalation: 'ഉൽപ്പന്നം ബാഗ് ഫോട്ടോയിൽ നിന്ന് രോഗനിർണയം സാധ്യമല്ല.\n\nവ്യക്തമായ ഇല ഫോട്ടോ അയയ്ക്കുക, അല്ലെങ്കിൽ *call*.',
        },
        ta: {
            lead: 'இது பயிர் இலை அல்ல; உரம் / பொருள் பை படம் போல் உள்ளது.',
            question: 'நோய் கண்டறிய பாதிக்கப்பட்ட இலையின் அருகில் படம் அனுப்பவும்.',
            expertEscalation: 'பொருள் பை படத்தில் இருந்து நோய் கண்டறிய முடியாது.\n\nதெளிவான இலை படம் அனுப்பவும் அல்லது *call*.',
        },
        kn: {
            lead: 'ಇದು ಬೆಳೆ ಎಲೆ ಅಲ್ಲ; ಗೊಬ್ಬರ / ಉತ್ಪನ್ನ ಚೀಲ ಫೋಟೋ ಎನಿಸುತ್ತದೆ.',
            question: 'ರೋಗನಿರ್ಣಯಕ್ಕೆ ಬಾಧಿತ ಎಲೆಯ ಹತ್ತಿರದ ಫೋಟೋ ಕಳುಹಿಸಿ.',
            expertEscalation: 'ಉತ್ಪನ್ನ ಚೀಲ ಫೋಟೋದಿಂದ ರೋಗನಿರ್ಣಯ ಸಾಧ್ಯವಿಲ್ಲ.\n\nಸ್ಪಷ್ಟ ಎಲೆ ಫೋಟೋ ಕಳುಹಿಸಿ ಅಥವಾ *call*.',
        },
        hi: {
            lead: 'यह फसल पत्ती नहीं, खाद / प्रोडक्ट बैग की फोटो लगती है।',
            question: 'निदान के लिए प्रभावित पत्ती की करीबी फोटो भेजें।',
            expertEscalation: 'प्रोडक्ट बैग फोटो से रोग निदान संभव नहीं।\n\nसाफ पत्ती फोटो भेजें, या *call* लिखें।',
        },
    },
    unknown_low_conf: {
        en: {
            lead: 'This photo does not clearly show the crop or leaf problem.',
            question: 'Please send one close photo of the affected leaves or plant (good light, fill the frame).',
            expertEscalation: 'We could not diagnose from this image.\n\nSend a clear crop/leaf photo, or type *call* for expert help.',
        },
        ml: {
            lead: 'ഈ ഫോട്ടോയിൽ വിള/ഇല പ്രശ്നം വ്യക്തമല്ല.',
            question: 'ബാധിത ഇലയുടെ അടുത്ത വ്യക്തമായ ഫോട്ടോ അയയ്ക്കുക (നല്ല വെളിച്ചം).',
            expertEscalation: 'ഈ ചിത്രത്തിൽ നിന്ന് രോഗനിർണയം സാധ്യമല്ല.\n\nവ്യക്തമായ വിള ഫോട്ടോ അയയ്ക്കുക, അല്ലെങ്കിൽ *call*.',
        },
        ta: {
            lead: 'இந்த படத்தில் பயிர் / இலை பிரச்சனை தெளிவாக இல்லை.',
            question: 'பாதிக்கப்பட்ட இலையின் அருகில் தெளிவான படம் அனுப்பவும்.',
            expertEscalation: 'இந்த படத்தில் இருந்து நோய் கண்டறிய முடியவில்லை.\n\nதெளிவான பயிர் படம் அனுப்பவும் அல்லது *call*.',
        },
        kn: {
            lead: 'ಈ ಫೋಟೋದಲ್ಲಿ ಬೆಳೆ / ಎಲೆ ಸಮಸ್ಯೆ ಸ್ಪಷ್ಟವಿಲ್ಲ.',
            question: 'ಬಾಧಿತ ಎಲೆಯ ಹತ್ತಿರದ ಸ್ಪಷ್ಟ ಫೋಟೋ ಕಳುಹಿಸಿ.',
            expertEscalation: 'ಈ ಚಿತ್ರದಿಂದ ರೋಗನಿರ್ಣಯ ಸಾಧ್ಯವಿಲ್ಲ.\n\nಸ್ಪಷ್ಟ ಬೆಳೆ ಫೋಟೋ ಕಳುಹಿಸಿ ಅಥವಾ *call*.',
        },
        hi: {
            lead: 'इस फोटो में फसल / पत्ती की समस्या साफ नहीं दिख रही।',
            question: 'प्रभावित पत्ती की करीबी साफ फोटो भेजें।',
            expertEscalation: 'इस तस्वीर से निदान संभव नहीं।\n\nसाफ फसल फोटो भेजें, या *call* लिखें।',
        },
    },
};
export const assessmentPlaybookService = {
    resolve(classification, language, options) {
        const cat = classification.category;
        const copy = COPY[cat]?.[language] ?? COPY[cat]?.en ?? COPY.unknown_low_conf.en;
        // Never run Crop Doctor on non-crop / unclear / product-bag photos.
        if (options?.hasCropMedia && isNonDiagnosisAgricultureCategory(cat)) {
            return {
                action: 'reply',
                message: responseComposerService.compose({
                    body: copy.lead || COPY.unknown_low_conf.en.lead,
                    validationQuestion: copy.question || COPY.unknown_low_conf.en.question,
                    footer: responseComposerService.advisoryDisclaimer(language),
                }),
            };
        }
        if (options?.hasCropMedia && cat !== 'compatibility') {
            return { action: 'continue_diagnosis' };
        }
        if (cat === 'disease_stress' || cat === 'cultivation') {
            return { action: 'continue_diagnosis' };
        }
        const lowConfidence = classification.confidence < 0.62;
        const noMedia = !options?.hasCropMedia;
        if (lowConfidence && (cat === 'insect' || cat === 'unknown_low_conf') && noMedia) {
            return {
                action: 'reply',
                message: copy.expertEscalation,
                escalate: true,
            };
        }
        if (cat === 'compatibility') {
            const jarNote = language === 'ml'
                ? '\n\nവലിയ സ്പ്രേയ്ക്ക് മുമ്പ് jar test നടത്താൻ ശുപാർശ ചെയ്യുന്നു.'
                : '\n\nJar test is recommended before large-scale spraying.';
            return {
                action: 'reply',
                message: responseComposerService.compose({
                    body: copy.lead + jarNote,
                    validationQuestion: copy.question,
                    footer: responseComposerService.advisoryDisclaimer(language),
                }),
            };
        }
        return {
            action: 'reply',
            message: responseComposerService.compose({
                body: copy.lead,
                validationQuestion: copy.question,
                footer: responseComposerService.advisoryDisclaimer(language),
            }),
            escalate: lowConfidence,
        };
    },
    async applyEscalation(farmerId, category, notes) {
        await createCropAdvisorTask({
            farmerId,
            title: `WhatsApp ${category} — expert review`,
            notes: notes ?? `Playbook escalation for ${category}`,
            priority: 'high',
        });
    },
};
//# sourceMappingURL=assessment-playbook.service.js.map