import { assertNoPrescription } from './no-prescribe.js';
import type { CallLanguage, CallScript, CallType } from './types.js';

type ScriptKey = CallType | 'opt_out_ack' | 'human_ack' | 'clarify';

const COPY: Record<
  ScriptKey,
  Record<CallLanguage, { opening: string; body: string; closing: string }>
> = {
  qualification: {
    en: {
      opening:
        'Hello, this is Morbeez crop assistance. I am an automated helper, not your agronomist.',
      body: 'May I note your crop, farm size, what you need help with, how you heard about us, and a good time to reach you?',
      closing: 'Reply YES to continue, or STOP CALLING if you do not want voice calls.',
    },
    ml: {
      opening: 'നമസ്കാരം, ഇത് Morbeez വിള സഹായമാണ്. ഇത് ഓട്ടോമേറ്റഡ് സഹായിയാണ്, നിങ്ങളുടെ അഗ്രോണമിസ്റ്റ് അല്ല.',
      body: 'വിള, ഏക്കർ, എന്ത് സഹായം വേണം, എങ്ങനെ അറിഞ്ഞു, വിളിക്കാൻ സൗകര്യമുള്ള സമയം എന്നിവ പറയാമോ?',
      closing: 'തുടരാൻ YES എന്ന് മറുപടി നൽകുക. വിളി വേണ്ടെങ്കിൽ STOP CALLING.',
    },
    ta: {
      opening: 'வணக்கம், இது Morbeez பயிர் உதவி. இது தானியங்கி உதவி, உங்கள் வேளாண் நிபுணர் அல்ல.',
      body: 'பயிர், ஏக்கர், எந்த உதவி வேண்டும், எப்படி தெரிந்தது, அழைக்க ஏற்ற நேரம் சொல்ல முடியுமா?',
      closing: 'தொடர YES என பதிலளிக்கவும். அழைப்பு வேண்டாம் என்றால் STOP CALLING.',
    },
    kn: {
      opening: 'ನಮಸ್ಕಾರ, ಇದು Morbeez ಬೆಳೆ ಸಹಾಯ. ಇದು ಸ್ವಯಂಚಾಲಿತ ಸಹಾಯಕ, ನಿಮ್ಮ ಕೃಷಿ ತಜ್ಞರಲ್ಲ.',
      body: 'ಬೆಳೆ, ಎಕರೆ, ಯಾವ ಸಹಾಯ ಬೇಕು, ಹೇಗೆ ತಿಳಿದಿರಿ, ಕರೆ ಮಾಡಲು ಸಮಯ ಹೇಳಬಹುದೇ?',
      closing: 'ಮುಂದುವರಿಸಲು YES ಎಂದು ಉತ್ತರಿಸಿ. ಕರೆ ಬೇಡವೆಂದರೆ STOP CALLING.',
    },
    hi: {
      opening: 'नमस्ते, यह Morbeez फसल सहायता है। यह स्वचालित सहायक है, आपके कृषि विशेषज्ञ नहीं।',
      body: 'फसल, एकड़, क्या मदद चाहिए, कैसे पता चला, और कब कॉल करना ठीक है — बता सकते हैं?',
      closing: 'जारी रखने के लिए YES लिखें। कॉल नहीं चाहिए तो STOP CALLING।',
    },
  },
  reminder: {
    en: {
      opening: 'Hello from Morbeez crop assistance (automated).',
      body: 'This is a reminder about your pending follow-up. Are you available to continue, or should we call later?',
      closing: 'Reply YES, LATER, or STOP CALLING.',
    },
    ml: {
      opening: 'Morbeez വിള സഹായം (ഓട്ടോമേറ്റഡ്).',
      body: 'താങ്കളുടെ തുടർനടപടി ഓർമ്മപ്പെടുത്തലാണ്. ഇപ്പോൾ സംസാരിക്കാമോ, അതോ പിന്നീട് വിളിക്കട്ടെ?',
      closing: 'YES, LATER, അല്ലെങ്കിൽ STOP CALLING.',
    },
    ta: {
      opening: 'Morbeez பயிர் உதவி (தானியங்கி).',
      body: 'நிலுவை தொடர்ச்சி நினைவூட்டல். இப்போது பேசலாமா, அல்லது பிறகு அழைக்கவா?',
      closing: 'YES, LATER, அல்லது STOP CALLING.',
    },
    kn: {
      opening: 'Morbeez ಬೆಳೆ ಸಹಾಯ (ಸ್ವಯಂಚಾಲಿತ).',
      body: 'ಬಾಕಿ ಫಾಲೋ-ಅಪ್ ಜ್ಞಾಪನೆ. ಈಗ ಮಾತನಾಡಬಹುದೇ, ಅಥವಾ ನಂತರ ಕರೆ ಮಾಡೋಣವೇ?',
      closing: 'YES, LATER, ಅಥವಾ STOP CALLING.',
    },
    hi: {
      opening: 'Morbeez फसल सहायता (स्वचालित)।',
      body: 'यह आपके पेंडिंग फॉलो-अप की याद है। अभी बात करें या बाद में कॉल करें?',
      closing: 'YES, LATER, या STOP CALLING।',
    },
  },
  crop_application: {
    en: {
      opening: 'Hello from Morbeez crop assistance (automated).',
      body: 'Has the recommended application for this crop stage been completed? Please say YES, NOT YET, or describe any leaf/stem symptoms. We will not prescribe a chemical on this call.',
      closing: 'If the crop looks worse, say WORSE so we can alert your assigned agronomist.',
    },
    ml: {
      opening: 'Morbeez വിള സഹായം (ഓട്ടോമേറ്റഡ്).',
      body: 'ഈ ഘട്ടത്തിലെ ശുപാർശ ചെയ്ത പ്രയോഗം പൂർത്തിയായോ? YES, NOT YET, അല്ലെങ്കിൽ ഇല/തണ്ട് ലക്ഷണം പറയുക. ഈ കോളിൽ രാസമരുന്ന് നിർദേശിക്കില്ല.',
      closing: 'വിള മോശമായാൽ WORSE എന്ന് പറയുക — നിങ്ങളുടെ അഗ്രോണമിസ്റ്റിന് അറിയിക്കും.',
    },
    ta: {
      opening: 'Morbeez பயிர் உதவி (தானியங்கி).',
      body: 'இந்த நிலைக்கான பரிந்துரைக்கப்பட்ட பயன்பாடு முடிந்ததா? YES, NOT YET, அல்லது இலை/தண்டு அறிகுறி சொல்லவும். இந்த அழைப்பில் மருந்து பரிந்துரைக்க மாட்டோம்.',
      closing: 'பயிர் மோசமாகினால் WORSE என சொல்லுங்கள் — உங்கள் வேளாண் நிபுணருக்கு தெரிவிப்போம்.',
    },
    kn: {
      opening: 'Morbeez ಬೆಳೆ ಸಹಾಯ (ಸ್ವಯಂಚಾಲಿತ).',
      body: 'ಈ ಹಂತದ ಶಿಫಾರಸು ಮಾಡಿದ ಅನ್ವಯ ಪೂರ್ಣವಾಗಿದೆಯೇ? YES, NOT YET, ಅಥವಾ ಎಲೆ/ಕಾಂಡ ಲಕ್ಷಣ ಹೇಳಿ. ಈ ಕರೆಯಲ್ಲಿ ರಾಸಾಯನಿಕ ಸೂಚಿಸುವುದಿಲ್ಲ.',
      closing: 'ಬೆಳೆ ಕೆಟ್ಟಿದ್ದರೆ WORSE ಎನ್ನಿ — ನಿಮ್ಮ ಕೃಷಿ ತಜ್ಞರಿಗೆ ತಿಳಿಸುತ್ತೇವೆ.',
    },
    hi: {
      opening: 'Morbeez फसल सहायता (स्वचालित)।',
      body: 'इस अवस्था की सुझाई गई स्प्रे/आवेदन पूरी हुई? YES, NOT YET, या पत्ती/तना लक्षण बताएँ। इस कॉल पर कोई दवा नहीं बताएँगे।',
      closing: 'फसल बिगड़ रही हो तो WORSE कहें — आपके कृषि विशेषज्ञ को सूचित करेंगे।',
    },
  },
  health_follow_up: {
    en: {
      opening: 'Hello from Morbeez crop assistance (automated).',
      body: 'How is the crop since the last check — improved, the same, or worse? Please do not apply any new chemical until your agronomist reviews.',
      closing: 'Reply IMPROVED, SAME, or WORSE.',
    },
    ml: {
      opening: 'Morbeez വിള സഹായം (ഓട്ടോമേറ്റഡ്).',
      body: 'കഴിഞ്ഞ പരിശോധനയ്ക്ക് ശേഷം വിള എങ്ങനെയുണ്ട് — മെച്ചപ്പെട്ടോ, അതേപോലെയോ, മോശമായോ? അഗ്രോണമിസ്റ്റ് നോക്കുന്നതുവരെ പുതിയ രാസമരുന്ന് ഒഴിവാക്കുക.',
      closing: 'IMPROVED, SAME, അല്ലെങ്കിൽ WORSE.',
    },
    ta: {
      opening: 'Morbeez பயிர் உதவி (தானியங்கி).',
      body: 'கடந்த சோதனைக்குப் பின் பயிர் எப்படி — மேம்பட்டதா, அதேபோலவா, மோசமா? நிபுணர் பார்க்கும் வரை புதிய மருந்து போட வேண்டாம்.',
      closing: 'IMPROVED, SAME, அல்லது WORSE.',
    },
    kn: {
      opening: 'Morbeez ಬೆಳೆ ಸಹಾಯ (ಸ್ವಯಂಚಾಲಿತ).',
      body: 'ಕೊನೆಯ ಪರಿಶೀಲನೆಯ ನಂತರ ಬೆಳೆ ಹೇಗಿದೆ — ಉತ್ತಮ, ಅದೇ, ಅಥವಾ ಕೆಟ್ಟಿದೆ? ತಜ್ಞರು ನೋಡುವವರೆಗೆ ಹೊಸ ರಾಸಾಯನಿಕ ಬೇಡ.',
      closing: 'IMPROVED, SAME, ಅಥವಾ WORSE.',
    },
    hi: {
      opening: 'Morbeez फसल सहायता (स्वचालित)।',
      body: 'पिछली जाँच के बाद फसल कैसी है — बेहतर, वैसी ही, या खराब? विशेषज्ञ देखे बिना नई दवा न डालें।',
      closing: 'IMPROVED, SAME, या WORSE।',
    },
  },
  escalation: {
    en: {
      opening: 'Hello from Morbeez crop assistance (automated).',
      body: 'We logged that the crop may be worsening. Your assigned agronomist will review. We will not prescribe a treatment on this call.',
      closing: 'Reply if you need a human callback now.',
    },
    ml: {
      opening: 'Morbeez വിള സഹായം (ഓട്ടോമേറ്റഡ്).',
      body: 'വിള മോശമാകുന്നതായി രേഖപ്പെടുത്തി. നിങ്ങളുടെ അഗ്രോണമിസ്റ്റ് പരിശോധിക്കും. ഈ കോളിൽ ചികിത്സ നിർദേശിക്കില്ല.',
      closing: 'ഇപ്പോൾ ഒരാൾ വിളിക്കണമെങ്കിൽ മറുപടി നൽകുക.',
    },
    ta: {
      opening: 'Morbeez பயிர் உதவி (தானியங்கி).',
      body: 'பயிர் மோசமாவதாக பதிவு செய்தோம். உங்கள் வேளாண் நிபுணர் பார்ப்பார். இந்த அழைப்பில் சிகிச்சை சொல்லமாட்டோம்.',
      closing: 'இப்போது மனித அழைப்பு வேண்டுமானால் பதிலளிக்கவும்.',
    },
    kn: {
      opening: 'Morbeez ಬೆಳೆ ಸಹಾಯ (ಸ್ವಯಂಚಾಲಿತ).',
      body: 'ಬೆಳೆ ಕೆಟ್ಟುತ್ತಿದೆ ಎಂದು ದಾಖಲಿಸಿದ್ದೇವೆ. ನಿಮ್ಮ ಕೃಷಿ ತಜ್ಞರು ನೋಡುತ್ತಾರೆ. ಈ ಕರೆಯಲ್ಲಿ ಚಿಕಿತ್ಸೆ ಹೇಳುವುದಿಲ್ಲ.',
      closing: 'ಈಗ ವ್ಯಕ್ತಿ ಕರೆ ಬೇಕಾದರೆ ಉತ್ತರಿಸಿ.',
    },
    hi: {
      opening: 'Morbeez फसल सहायता (स्वचालित)।',
      body: 'फसल बिगड़ने का रिकॉर्ड किया। आपके कृषि विशेषज्ञ देखेंगे। इस कॉल पर इलाज नहीं बताएँगे।',
      closing: 'अभी व्यक्ति कॉल चाहिए तो जवाब दें।',
    },
  },
  opt_out_ack: {
    en: {
      opening: 'Understood.',
      body: 'We will not place further automated voice calls to this number.',
      closing: 'You can still message us on WhatsApp if needed.',
    },
    ml: {
      opening: 'മനസ്സിലായി.',
      body: 'ഈ നമ്പറിലേക്ക് ഇനി ഓട്ടോമേറ്റഡ് വിളി ഇടില്ല.',
      closing: 'വേണമെങ്കിൽ WhatsApp-ൽ സന്ദേശം അയയ്ക്കാം.',
    },
    ta: {
      opening: 'புரிந்தது.',
      body: 'இந்த எண்ணுக்கு மேலும் தானியங்கி அழைப்பு இடமாட்டோம்.',
      closing: 'தேவைப்பட்டால் WhatsApp-ல் எழுதலாம்.',
    },
    kn: {
      opening: 'ತಿಳಿಯಿತು.',
      body: 'ಈ ಸಂಖ್ಯೆಗೆ ಮತ್ತೆ ಸ್ವಯಂಚಾಲಿತ ಕರೆ ಮಾಡುವುದಿಲ್ಲ.',
      closing: 'ಬೇಕಾದರೆ WhatsApp ನಲ್ಲಿ ಬರೆಯಬಹುದು.',
    },
    hi: {
      opening: 'समझ गए।',
      body: 'इस नंबर पर और स्वचालित कॉल नहीं करेंगे।',
      closing: 'ज़रूरत हो तो WhatsApp पर लिख सकते हैं।',
    },
  },
  human_ack: {
    en: {
      opening: 'Of course.',
      body: 'We will connect you with your assigned agronomist. The automated helper will stop this call.',
      closing: 'Thank you.',
    },
    ml: {
      opening: 'ശരി.',
      body: 'നിങ്ങളുടെ അഗ്രോണമിസ്റ്റുമായി ബന്ധിപ്പിക്കും. ഈ ഓട്ടോമേറ്റഡ് കോൾ നിർത്തുന്നു.',
      closing: 'നന്ദി.',
    },
    ta: {
      opening: 'சரி.',
      body: 'உங்கள் வேளாண் நிபுணருடன் இணைப்போம். இந்த தானியங்கி அழைப்பு நிறுத்தப்படும்.',
      closing: 'நன்றி.',
    },
    kn: {
      opening: 'ಸರಿ.',
      body: 'ನಿಮ್ಮ ಕೃಷಿ ತಜ್ಞರೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತೇವೆ. ಈ ಸ್ವಯಂಚಾಲಿತ ಕರೆ ನಿಲ್ಲುತ್ತದೆ.',
      closing: 'ಧನ್ಯವಾದಗಳು.',
    },
    hi: {
      opening: 'ज़रूर।',
      body: 'आपके कृषि विशेषज्ञ से जोड़ेंगे। यह स्वचालित कॉल रुक जाएगी।',
      closing: 'धन्यवाद।',
    },
  },
  clarify: {
    en: {
      opening: 'Sorry, I did not catch that.',
      body: 'Please reply YES if done, NOT YET if pending, WORSE if the crop is declining, or ask for an agronomist.',
      closing: 'We will not prescribe a chemical here.',
    },
    ml: {
      opening: 'മനസ്സിലായില്ല.',
      body: 'പൂർത്തിയായാൽ YES, ബാക്കിയെങ്കിൽ NOT YET, മോശമായാൽ WORSE, അല്ലെങ്കിൽ അഗ്രോണമിസ്റ്റിനെ ചോദിക്കുക.',
      closing: 'ഇവിടെ രാസമരുന്ന് നിർദേശിക്കില്ല.',
    },
    ta: {
      opening: 'புரியவில்லை.',
      body: 'முடிந்தால் YES, பாக்கியென்றால் NOT YET, மோசமானால் WORSE, அல்லது நிபுணரை கேளுங்கள்.',
      closing: 'இங்கே மருந்து பரிந்துரைக்க மாட்டோம்.',
    },
    kn: {
      opening: 'ಅರ್ಥವಾಗಲಿಲ್ಲ.',
      body: 'ಆದರೆ YES, ಬಾಕಿಯಿದ್ದರೆ NOT YET, ಕೆಟ್ಟಿದ್ದರೆ WORSE, ಅಥವಾ ತಜ್ಞರನ್ನು ಕೇಳಿ.',
      closing: 'ಇಲ್ಲಿ ರಾಸಾಯನಿಕ ಸೂಚಿಸುವುದಿಲ್ಲ.',
    },
    hi: {
      opening: 'समझ नहीं आया।',
      body: 'हो गया तो YES, बाकी है तो NOT YET, बिगड़ रहा हो तो WORSE, या विशेषज्ञ माँगें।',
      closing: 'यहाँ दवा नहीं बताएँगे।',
    },
  },
};

export function buildCallScript(params: {
  type: ScriptKey;
  language: CallLanguage;
  stageQuestion?: string | null;
  reminderLabel?: string | null;
}): CallScript {
  const pack = COPY[params.type][params.language];
  let body = pack.body;
  if (params.type === 'crop_application' && params.stageQuestion?.trim()) {
    body = `${params.stageQuestion.trim()} Please say YES, NOT YET, or describe symptoms. We will not prescribe a chemical on this call.`;
  }
  if (params.type === 'reminder' && params.reminderLabel?.trim()) {
    body = `Reminder: ${params.reminderLabel.trim()} Are you available now, or should we call later?`;
  }
  const fullText = `${pack.opening} ${body} ${pack.closing}`.replace(/\s+/g, ' ').trim();
  assertNoPrescription(fullText, `script:${params.type}:${params.language}`);
  return { language: params.language, opening: pack.opening, body, closing: pack.closing, fullText };
}
