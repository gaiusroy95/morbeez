import type { AdvisoryLanguage } from '../ai/types.js';

export type CopilotUiLocale = 'en' | 'hi' | 'ml' | 'ta' | 'kn';

export function normalizeCopilotLocale(value?: string | null): CopilotUiLocale {
  const v = String(value ?? 'en').trim().toLowerCase();
  if (v === 'hi' || v === 'ml' || v === 'ta' || v === 'kn') return v;
  return 'en';
}

type MsgKey =
  | 'imagesLoaded'
  | 'photosAvailable'
  | 'imageAnalysisTitle'
  | 'detected'
  | 'wantAnnotated'
  | 'overlayEnabled'
  | 'registeredDoseApplied'
  | 'resistanceFrac'
  | 'phytotoxicityLow'
  | 'safetyPpe'
  | 'missingInfoSend'
  | 'questionsSent'
  | 'extracting'
  | 'runningValidations'
  | 'dosageAsk'
  | 'dosageOk'
  | 'validationsAttached'
  | 'clarifyDiagnosis'
  | 'askLabelDose'
  | 'askDilution'
  | 'dilutionAsk'
  | 'askSendFarmerQs'
  | 'farmerQIntro'
  | 'farmerQPh'
  | 'farmerQEc'
  | 'farmerQFungicide'
  | 'farmerQRain'
  | 'navOpeningNext'
  | 'navOpeningPrevious'
  | 'navNoNext'
  | 'navNoPrevious'
  | 'navAtFirst'
  | 'navAtLast'
  | 'farmerConfirmThanks'
  | 'farmerAnswersRecorded'
  | 'farmerPreviewConfirmPrompt';

const CATALOG: Record<CopilotUiLocale, Record<MsgKey, string>> = {
  en: {
    imagesLoaded: 'Images loaded.',
    photosAvailable: '{n} photo(s) available.',
    imageAnalysisTitle: 'AI Image Analysis',
    detected: 'Detected',
    wantAnnotated: 'Would you like AI annotated images?',
    overlayEnabled: 'AI Overlay Enabled\n\nPossible disease regions highlighted.',
    registeredDoseApplied: 'Registered dosage applied for {product}.',
    resistanceFrac: 'Resistance Management: FRAC rotation OK · Risk LOW',
    phytotoxicityLow: 'Phytotoxicity: LOW',
    safetyPpe: 'Safety: PPE required · REI 24h · Harvest interval recorded',
    missingInfoSend: 'Missing information — send these questions to farmer?',
    questionsSent: 'Questions sent to the farmer via WhatsApp.',
    extracting: 'Understood. Extracting expert recommendations…',
    runningValidations: 'Running automatic validations…',
    dosageAsk: 'Dosage: {message}',
    dosageOk: 'Dosage validated.',
    validationsAttached:
      'Compatibility, weather, FRAC, phytotoxicity, and safety checks attached to the structured preview.',
    clarifyDiagnosis: 'Which diagnosis and treatment should I apply to the draft?',
    askLabelDose:
      'Manufacturer label dose detected. Use the registered label dosage for this formulation?',
    askDilution:
      'What spray tank / dilution volume should I record (liters of water)?',
    dilutionAsk: 'Dilution: {message}',
    askSendFarmerQs: 'Send these missing-field questions to the farmer?',
    farmerQIntro: 'Morbeez expert follow-up — please reply with:',
    farmerQPh: 'Current soil pH?',
    farmerQEc: 'Current soil EC?',
    farmerQFungicide: 'Any fungicide sprayed during the last 7 days?',
    farmerQRain: 'Did symptoms start after continuous rainfall?',
    navOpeningNext: 'Opening next pending case…',
    navOpeningPrevious: 'Opening previous case…',
    navNoNext: 'No more cases in your queue. You are on the last case.',
    navNoPrevious: 'No previous case — you are on the first case.',
    navAtFirst: 'You are on the first case.',
    navAtLast: 'You are on the last case.',
    farmerConfirmThanks: 'Thank you — your recommendation is confirmed. Our team will follow up as planned.',
    farmerAnswersRecorded: 'Thank you. Your answers were recorded for the expert review.',
    farmerPreviewConfirmPrompt:
      '\n\nReply YES to confirm this advice, or reply EDIT if something needs to change.',
  },
  hi: {
    imagesLoaded: 'तस्वीरें लोड हो गईं।',
    photosAvailable: '{n} तस्वीर(ें) उपलब्ध।',
    imageAnalysisTitle: 'AI तस्वीर विश्लेषण',
    detected: 'पाया गया',
    wantAnnotated: 'क्या AI एनोटेटेड तस्वीरें चाहिए?',
    overlayEnabled: 'AI ओवरले चालू\n\nसंभावित रोग वाले भाग चिह्नित।',
    registeredDoseApplied: '{product} के लिए पंजीकृत खुराक लगाई गई।',
    resistanceFrac: 'प्रतिरोध प्रबंधन: FRAC रोटेशन ठीक · जोखिम कम',
    phytotoxicityLow: 'फाइटोtoxicity: कम',
    safetyPpe: 'सुरक्षा: PPE ज़रूरी · REI 24 घंटे · कटाई अंतराल दर्ज',
    missingInfoSend: 'अधूरी जानकारी — ये सवाल किसान को भेजें?',
    questionsSent: 'सवाल WhatsApp पर किसान को भेज दिए।',
    extracting: 'समझ गया। विशेषज्ञ सलाह निकाल रहा हूँ…',
    runningValidations: 'स्वचालित जाँच चल रही है…',
    dosageAsk: 'खुराक: {message}',
    dosageOk: 'खुराक जाँच पूरी।',
    validationsAttached:
      'मिक्स, मौसम, FRAC, फाइटोtoxicity और सुरक्षा जाँच संरचित पूर्वावलोकन में जुड़ी हैं।',
    clarifyDiagnosis: 'ड्राफ्ट में कौन सा निदान और उपचार लगाऊँ?',
    askLabelDose: 'निर्माता लेबल खुराक मिली। पंजीकृत लेबल खुराक लगाएँ?',
    askDilution: 'स्प्रे टैंक / पतला करने के लिए कितने लीटर पानी दर्ज करूँ?',
    dilutionAsk: 'पतला करना: {message}',
    askSendFarmerQs: 'ये अधूरे-फ़ील्ड सवाल किसान को भेजें?',
    farmerQIntro: 'Morbeez विशेषज्ञ फॉलो-अप — कृपया जवाब दें:',
    farmerQPh: 'वर्तमान मिट्टी pH?',
    farmerQEc: 'वर्तमान मिट्टी EC?',
    farmerQFungicide: 'पिछले 7 दिनों में कोई फफूंदनाशक छिड़का?',
    farmerQRain: 'लगातार बारिश के बाद लक्षण शुरू हुए?',
    navOpeningNext: 'अगला लंबित केस खोल रहे हैं…',
    navOpeningPrevious: 'पिछला केस खोल रहे हैं…',
    navNoNext: 'और केस नहीं — आप आखिरी केस पर हैं।',
    navNoPrevious: 'पिछला केस नहीं — आप पहले केस पर हैं।',
    navAtFirst: 'आप पहले केस पर हैं।',
    navAtLast: 'आप आखिरी केस पर हैं।',
    farmerConfirmThanks: 'धन्यवाद — आपकी सलाह पुष्टि हो गई। टीम नियोजित अनुसार फॉलो-अप करेगी।',
    farmerAnswersRecorded: 'धन्यवाद। आपके जवाब विशेषज्ञ समीक्षा में दर्ज हो गए।',
    farmerPreviewConfirmPrompt:
      '\n\nपुष्टि के लिए YES भेजें, या बदलाव के लिए EDIT लिखें।',
  },
  ml: {
    imagesLoaded: 'ഫോട്ടോകൾ ലോഡ് ആയി.',
    photosAvailable: '{n} ഫോട്ടോ(കൾ) ലഭ്യം.',
    imageAnalysisTitle: 'AI ഫോട്ടോ വിശകലനം',
    detected: 'കണ്ടെത്തി',
    wantAnnotated: 'AI അടയാളപ്പെടുത്തിയ ഫോട്ടോകൾ വേണോ?',
    overlayEnabled: 'AI ഓവർലേ ഓണാണ്\n\nസാധ്യമായ രോഗ ഭാഗങ്ങൾ അടയാളപ്പെടുത്തി.',
    registeredDoseApplied: '{product}-ന് രജിസ്റ്റർ ഡോസ് ഇട്ടു.',
    resistanceFrac: 'പ്രതിരോധ മാനേജ്മെന്റ്: FRAC ശരി · റിസ്ക് കുറവ്',
    phytotoxicityLow: 'ഫൈറ്റോടോക്സിസിറ്റി: കുറവ്',
    safetyPpe: 'സുരക്ഷ: PPE ആവശ്യം · REI 24 മണിക്കൂർ · വിളവെടുപ്പ് ഇടവേള രേഖപ്പെടുത്തി',
    missingInfoSend: 'കുറവുള്ള വിവരം — ഈ ചോദ്യങ്ങൾ കർഷകന് അയയ്ക്കട്ടെ?',
    questionsSent: 'ചോദ്യങ്ങൾ WhatsApp വഴി കർഷകന് അയച്ചു.',
    extracting: 'മനസ്സിലായി. വിദഗ്ധ ശുപാർശകൾ എടുക്കുന്നു…',
    runningValidations: 'സ്വയം പരിശോധന നടക്കുന്നു…',
    dosageAsk: 'ഡോസ്: {message}',
    dosageOk: 'ഡോസ് പരിശോധിച്ചു.',
    validationsAttached:
      'മിക്സ്, കാലാവസ്ഥ, FRAC, ഫൈറ്റോടോക്സിസിറ്റി, സുരക്ഷാ പരിശോധനകൾ പ്രിവ്യൂവിൽ ചേർത്തു.',
    clarifyDiagnosis: 'ഡ്രാഫ്റ്റിൽ ഏത് നിർണയവും ചികിത്സയും ഇടണം?',
    askLabelDose: 'നിർമ്മാതാവിന്റെ ലേബൽ ഡോസ് കണ്ടു. രജിസ്റ്റർ ലേബൽ ഡോസ് ഇടട്ടെ?',
    askDilution: 'സ്പ്രേ ടാങ്ക് / തളർത്താൻ എത്ര ലിറ്റർ വെള്ളം രേഖപ്പെടുത്തണം?',
    dilutionAsk: 'തളർത്തൽ: {message}',
    askSendFarmerQs: 'ഈ ചോദ്യങ്ങൾ കർഷകന് അയയ്ക്കട്ടെ?',
    farmerQIntro: 'Morbeez വിദഗ്ധ ഫോളോ-അപ്പ് — ദയവായി മറുപടി തരൂ:',
    farmerQPh: 'ഇപ്പോഴത്തെ മണ്ണ് pH?',
    farmerQEc: 'ഇപ്പോഴത്തെ മണ്ണ് EC?',
    farmerQFungicide: 'കഴിഞ്ഞ 7 ദിവസം ഫംഗിസൈഡ് തളിച്ചോ?',
    farmerQRain: 'തുടർച്ചയായ മഴയ്ക്ക് ശേഷം ലക്ഷണങ്ങൾ തുടങ്ങിയോ?',
    navOpeningNext: 'അടുത്ത കാത്തിരിക്കുന്ന കേസ് തുറക്കുന്നു…',
    navOpeningPrevious: 'മുമ്പത്തെ കേസ് തുറക്കുന്നു…',
    navNoNext: 'കൂടുതൽ കേസുകൾ ഇല്ല — അവസാന കേസിലാണ്.',
    navNoPrevious: 'മുമ്പത്തെ കേസ് ഇല്ല — ആദ്യ കേസിലാണ്.',
    navAtFirst: 'നിങ്ങൾ ആദ്യ കേസിലാണ്.',
    navAtLast: 'നിങ്ങൾ അവസാന കേസിലാണ്.',
    farmerConfirmThanks: 'നന്ദി — നിങ്ങളുടെ ഉപദേശം സ്ഥിരീകരിച്ചു.',
    farmerAnswersRecorded: 'നന്ദി. നിങ്ങളുടെ ഉത്തരങ്ങൾ രേഖപ്പെടുത്തി.',
    farmerPreviewConfirmPrompt:
      '\n\nസ്ഥിരീകരിക്കാൻ YES അയയ്ക്കുക, മാറ്റം വേണമെങ്കിൽ EDIT എഴുതുക.',
  },
  ta: {
    imagesLoaded: 'படங்கள் ஏற்றப்பட்டன.',
    photosAvailable: '{n} படம்(கள்) கிடைக்கின்றன.',
    imageAnalysisTitle: 'AI பட பகுப்பாய்வு',
    detected: 'கண்டறியப்பட்டது',
    wantAnnotated: 'AI குறித்த படங்கள் வேண்டுமா?',
    overlayEnabled: 'AI ஓவர்லே இயக்கம்\n\nசாத்தியமான நோய் பகுதிகள் குறிக்கப்பட்டன.',
    registeredDoseApplied: '{product}க்கு பதிவு அளவு பயன்படுத்தப்பட்டது.',
    resistanceFrac: 'எதிர்ப்பு மேலாண்மை: FRAC சரி · ஆபத்து குறைவு',
    phytotoxicityLow: 'பைட்டோடாக்சிசிட்டி: குறைவு',
    safetyPpe: 'பாதுகாப்பு: PPE தேவை · REI 24 மணி · அறுவடை இடைவெளி பதிவு',
    missingInfoSend: 'குறைந்த தகவல் — இந்த கேள்விகளை விவசாயிக்கு அனுப்பவா?',
    questionsSent: 'கேள்விகள் WhatsApp வழியாக விவசாயிக்கு அனுப்பப்பட்டன.',
    extracting: 'புரிந்தது. நிபுணர் பரிந்துரைகளை எடுக்கிறேன்…',
    runningValidations: 'தானியங்கி சரிபார்ப்பு நடக்கிறது…',
    dosageAsk: 'அளவு: {message}',
    dosageOk: 'அளவு சரிபார்க்கப்பட்டது.',
    validationsAttached:
      'கலவை, வானிலை, FRAC, பைட்டோடாக்சிசிட்டி, பாதுகாப்பு சரிபார்ப்புகள் முன்னோட்டத்தில் இணைக்கப்பட்டன.',
    clarifyDiagnosis: 'வரைவில் எந்த நோயறிதல் மற்றும் சிகிச்சை போட வேண்டும்?',
    askLabelDose: 'உற்பத்தியாளர் லேபிள் அளவு கண்டறியப்பட்டது. பதிவு லேபிள் அளவு பயன்படுத்தவா?',
    askDilution: 'ஸ்ப்ரே டேங்க் / தண்ணீர் கலப்பு எத்தனை லிட்டர் பதிவு செய்ய வேண்டும்?',
    dilutionAsk: 'தண்ணீர் கலப்பு: {message}',
    askSendFarmerQs: 'இந்த கேள்விகளை விவசாயிக்கு அனுப்பவா?',
    farmerQIntro: 'Morbeez நிபுணர் பின்தொடர்வு — பதிலளிக்கவும்:',
    farmerQPh: 'தற்போதைய மண் pH?',
    farmerQEc: 'தற்போதைய மண் EC?',
    farmerQFungicide: 'கடந்த 7 நாட்களில் பூஞ்சைக்கொல்லி தெளித்தீர்களா?',
    farmerQRain: 'தொடர் மழைக்குப் பிறகு அறிகுறிகள் தொடங்கினவா?',
    navOpeningNext: 'அடுத்த நிலுவை கேஸைத் திறக்கிறது…',
    navOpeningPrevious: 'முந்தைய கேஸைத் திறக்கிறது…',
    navNoNext: 'மேலும் கேஸ்கள் இல்லை — கடைசி கேஸில்.',
    navNoPrevious: 'முந்தைய கேஸ் இல்லை — முதல் கேஸில்.',
    navAtFirst: 'நீங்கள் முதல் கேஸில்.',
    navAtLast: 'நீங்கள் கடைசி கேஸில்.',
    farmerConfirmThanks: 'நன்றி — உங்கள் பரிந்துரை உறுதிப்படுத்தப்பட்டது.',
    farmerAnswersRecorded: 'நன்றி. உங்கள் பதில்கள் பதிவு செய்யப்பட்டன.',
    farmerPreviewConfirmPrompt:
      '\n\nஉறுதிப்படுத்த YES அனுப்புங்கள், மாற்றம் வேண்டுமானால் EDIT எழுதுங்கள்.',
  },
  kn: {
    imagesLoaded: 'ಚಿತ್ರಗಳು ಲೋಡ್ ಆಯಿತು.',
    photosAvailable: '{n} ಚಿತ್ರ(ಗಳು) ಲಭ್ಯ.',
    imageAnalysisTitle: 'AI ಚಿತ್ರ ವಿಶ್ಲೇಷಣೆ',
    detected: 'ಕಂಡುಬಂದಿದೆ',
    wantAnnotated: 'AI ಅನೋಟೇಟೆಡ್ ಚಿತ್ರಗಳು ಬೇಕೇ?',
    overlayEnabled: 'AI ಓವರ್‌ಲೇ ಆನ್\n\nಸಂಭಾವ್ಯ ರೋಗ ಭಾಗಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ.',
    registeredDoseApplied: '{product}ಗೆ ನೋಂದಾಯಿತ ಡೋಸ್ ಅನ್ವಯಿಸಲಾಗಿದೆ.',
    resistanceFrac: 'ಪ್ರತಿರೋಧ ನಿರ್ವಹಣೆ: FRAC ಸರಿ · ಅಪಾಯ ಕಡಿಮೆ',
    phytotoxicityLow: 'ಫೈಟೊಟಾಕ್ಸಿಸಿಟಿ: ಕಡಿಮೆ',
    safetyPpe: 'ಸುರಕ್ಷತೆ: PPE ಅಗತ್ಯ · REI 24 ಗಂಟೆ · ಕೊಯ್ಲು ಅಂತರ ದಾಖಲು',
    missingInfoSend: 'ಕೊರತೆಯ ಮಾಹಿತಿ — ಈ ಪ್ರಶ್ನೆಗಳನ್ನು ರೈತರಿಗೆ ಕಳುಹಿಸುವುದೇ?',
    questionsSent: 'ಪ್ರಶ್ನೆಗಳನ್ನು WhatsApp ಮೂಲಕ ರೈತರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.',
    extracting: 'ಅರ್ಥವಾಯಿತು. ತಜ್ಞ ಶಿಫಾರಸುಗಳನ್ನು ತೆಗೆಯುತ್ತಿದ್ದೇನೆ…',
    runningValidations: 'ಸ್ವಯಂ ಪರಿಶೀಲನೆ ನಡೆಯುತ್ತಿದೆ…',
    dosageAsk: 'ಡೋಸ್: {message}',
    dosageOk: 'ಡೋಸ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ.',
    validationsAttached:
      'ಮಿಶ್ರಣ, ಹವಾಮಾನ, FRAC, ಫೈಟೊಟಾಕ್ಸಿಸಿಟಿ ಮತ್ತು ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆಗಳು ಪೂರ್ವವೀಕ್ಷಣೆಯಲ್ಲಿ ಸೇರಿವೆ.',
    clarifyDiagnosis: 'ಡ್ರಾಫ್ಟ್‌ಗೆ ಯಾವ ನಿರ್ಣಯ ಮತ್ತು ಚಿಕಿತ್ಸೆ ಅನ್ವಯಿಸಲಿ?',
    askLabelDose: 'ತಯಾರಕರ ಲೇಬಲ್ ಡೋಸ್ ಕಂಡುಬಂದಿದೆ. ನೋಂದಾಯಿತ ಲೇಬಲ್ ಡೋಸ್ ಬಳಸುವುದೇ?',
    askDilution: 'ಸ್ಪ್ರೇ ಟ್ಯಾಂಕ್ / ನೀರಿನ ಪ್ರಮಾಣ ಎಷ್ಟು ಲೀಟರ್ ದಾಖಲಿಸಬೇಕು?',
    dilutionAsk: 'ನೀರಿನ ಪ್ರಮಾಣ: {message}',
    askSendFarmerQs: 'ಈ ಪ್ರಶ್ನೆಗಳನ್ನು ರೈತರಿಗೆ ಕಳುಹಿಸುವುದೇ?',
    farmerQIntro: 'Morbeez ತಜ್ಞ ಫಾಲೋ-ಅಪ್ — ದಯವಿಟ್ಟು ಉತ್ತರಿಸಿ:',
    farmerQPh: 'ಪ್ರಸ್ತುತ ಮಣ್ಣು pH?',
    farmerQEc: 'ಪ್ರಸ್ತುತ ಮಣ್ಣು EC?',
    farmerQFungicide: 'ಕಳೆದ 7 ದಿನಗಳಲ್ಲಿ ಯಾವುದೇ ಶಿಲೀಂಧ್ರನಾಶಕ ಸಿಂಪಡಿಸಿದ್ದೀರಾ?',
    farmerQRain: 'ನಿರಂತರ ಮಳೆಯ ನಂತರ ಲಕ್ಷಣಗಳು ಪ್ರಾರಂಭವಾದವೇ?',
    navOpeningNext: 'ಮುಂದಿನ ಬಾಕಿ ಕೇಸ್ ತೆರೆಯುತ್ತಿದೆ…',
    navOpeningPrevious: 'ಹಿಂದಿನ ಕೇಸ್ ತೆರೆಯುತ್ತಿದೆ…',
    navNoNext: 'ಇನ್ನೂ ಕೇಸ್‌ಗಳಿಲ್ಲ — ಕೊನೆಯ ಕೇಸ್‌ನಲ್ಲಿದ್ದೀರಿ.',
    navNoPrevious: 'ಹಿಂದಿನ ಕೇಸ್ ಇಲ್ಲ — ಮೊದಲ ಕೇಸ್‌ನಲ್ಲಿದ್ದೀರಿ.',
    navAtFirst: 'ನೀವು ಮೊದಲ ಕೇಸ್‌ನಲ್ಲಿದ್ದೀರಿ.',
    navAtLast: 'ನೀವು ಕೊನೆಯ ಕೇಸ್‌ನಲ್ಲಿದ್ದೀರಿ.',
    farmerConfirmThanks: 'ಧನ್ಯವಾದ — ನಿಮ್ಮ ಸಲಹೆ ದೃಢೀಕರಿಸಲಾಗಿದೆ.',
    farmerAnswersRecorded: 'ಧನ್ಯವಾದ. ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ.',
    farmerPreviewConfirmPrompt:
      '\n\nದೃಢೀಕರಿಸಲು YES ಕಳುಹಿಸಿ, ಬದಲಾವಣೆ ಬೇಕಾದರೆ EDIT ಬರೆಯಿರಿ.',
  },
};

export function copilotMsg(
  locale: CopilotUiLocale | string | null | undefined,
  key: MsgKey,
  vars?: Record<string, string | number>
): string {
  const lang = normalizeCopilotLocale(locale);
  let text = CATALOG[lang][key] ?? CATALOG.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function defaultFarmerQuestions(locale: CopilotUiLocale | string | null | undefined): string[] {
  return [
    copilotMsg(locale, 'farmerQPh'),
    copilotMsg(locale, 'farmerQEc'),
    copilotMsg(locale, 'farmerQFungicide'),
    copilotMsg(locale, 'farmerQRain'),
  ];
}

export function toAdvisoryLanguage(
  value?: string | null
): AdvisoryLanguage {
  const v = normalizeCopilotLocale(value);
  return v;
}
