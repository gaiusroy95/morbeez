import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cropDoctorFarmerReportService } from '../src/services/ai/crop-doctor-farmer-report.service.js';
import { whatsappDiagnosisRendererService } from '../src/services/whatsapp/pipeline/whatsapp-diagnosis-renderer.service.js';
import type { StructuredAdvisory } from '../src/services/ai/types.js';

const richAdvisory: StructuredAdvisory = {
  probableIssue: 'Iron deficiency (Fe)',
  confidence: 0.88,
  uncertain: false,
  severity: 'moderate',
  nutrientDeficiency: [{ nutrient: 'Iron', likelihood: 'high', signs: 'interveinal chlorosis' }],
  stressAnalysis: ['Yellowing on younger leaves'],
  treatments: [],
  dosageGuidance: [
    { product: 'Fe EDTA', rate: '2 g/L', method: 'Foliar spray', frequency: 'weekly x2' },
  ],
  precautions: ['Jar test before full tank'],
  escalationRecommended: false,
  farmerSummaryEn: 'Iron deficiency likely',
  farmerSummaryMl: '',
  recommendedProductTags: [],
  imageObservations: ['Interveinal yellowing on upper leaves', 'Veins remain green'],
  differentialDiagnosis: [
    { label: 'Nitrogen deficiency', reason: 'N deficiency usually starts on older leaves' },
  ],
  sprayTiming: 'Early morning or late evening; avoid rain within 6 hours',
  rootCorrection: 'Check soil pH — iron uptake poor above pH 7.5',
  agronomistAssessment: 'Classic Fe chlorosis pattern; foliar correction should show response in 7–10 days.',
  morbeezDataUsed: ['Soil pH 7.3', 'Humidity 78%'],
  costEstimate: [{ item: 'Fe EDTA spray', note: '~₹150–250 per acre' }],
};

describe('crop doctor farmer report', () => {
  it('builds MORBEEZ CROP DOCTOR formatted farmer report with field context', () => {
    const report = cropDoctorFarmerReportService.buildFarmerReport(richAdvisory, {
      cropType: 'Ginger',
      variety: 'Rio de Janeiro',
      dap: 125,
      location: 'Wayanad, Kerala',
      lastFertilizer: { label: 'NPK fertilizer', date: '2026-06-08', daysAgo: '30 days ago' },
      lastFoliarSpray: { label: 'No recent foliar spray recorded' },
      weather: {
        temperature: '24°C',
        humidity: '93%',
        rainfall7d: '61.4 mm',
        weather: 'Cloudy with intermittent rain',
        soilMoisture: 'Wet, risk of temporary waterlogging',
      },
      previousDisease: 'Potassium deficiency',
      soilReportLines: ['Date: 2026-07-08', 'pH: 6.8', 'EC: 0.7 dS/m'],
      soilSummary: 'Report date: 2026-07-08; pH: 6.8; EC: 0.7 dS/m',
      contextPack: {
        seasonPhase: 'monsoon',
        weatherRiskScore: 50,
        heavyRainLikely: true,
        highHeatLikely: false,
        highHumidityLikely: true,
        drainageRisk: 'high',
        diseasePriors: [],
      },
    });
    assert.match(report, /MORBEEZ CROP DOCTOR/);
    assert.match(report, /Variety: Rio de Janeiro/);
    assert.match(report, /DAP: 125 Days/);
    assert.match(report, /Location: Wayanad, Kerala/);
    assert.match(report, /Last Fertilizer: NPK fertilizer/);
    assert.match(report, /Latest Soil Test/);
    assert.match(report, /pH: 6\.8/);
    assert.match(report, /Days Ago: 30 days ago/);
    assert.match(report, /Rainfall \(Last 7 Days\): 61.4 mm/);
    assert.match(report, /Previous Disease: Potassium deficiency/);
    assert.doesNotMatch(report, /Bayesian/);
    assert.match(report, /🎯 Primary Treatment/);
    assert.match(report, /Fe EDTA\t2 g\/L\tFoliar spray/);
  });

  it('renders connected prevention and tank mix when present', () => {
    const advisory: StructuredAdvisory = {
      ...richAdvisory,
      connectedPrevention: [
        {
          connectedRisk: 'Anthracnose in humid weather',
          preventiveProduct: 'Copper oxychloride',
          dose: '2.5 g/L',
          method: 'Foliar spray',
          reason: 'High humidity after rain favours leaf spot spread in the next week.',
          riskLevel: 'high',
        },
      ],
      tankMixRecommendation:
        '✅ Recommended Tank Mix: Combine Fe EDTA and copper oxychloride in one foliar spray after a jar test.',
    };
    const report = cropDoctorFarmerReportService.buildFarmerReport(advisory, {
      cropType: 'Ginger',
      location: 'Wayanad',
    });
    assert.match(report, /Connected Prevention \(Optimized Tank Mix\)/);
    assert.match(report, /Anthracnose in humid weather/);
    assert.match(report, /Recommended Tank Mix/);
  });
});

describe('whatsapp diagnosis renderer', () => {
  it('renders farmerReport when present', () => {
    const farmerReport = cropDoctorFarmerReportService.buildFarmerReport(richAdvisory, {
      cropType: 'Ginger',
      location: 'Wayanad',
    });
    const text = whatsappDiagnosisRendererService.render({
      advisory: { ...richAdvisory, farmerReport },
      language: 'en',
      plotLabel: 'Ginger Block A',
    });
    assert.match(text, /MORBEEZ CROP DOCTOR/);
    assert.match(text, /What We Found/);
    assert.doesNotMatch(text, /Primary issue:/);
  });

  it('renders sectioned English diagnosis with dosage table when no farmerReport', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: richAdvisory,
      language: 'en',
      plotLabel: 'Ginger Block A',
    });
    assert.match(text, /What I see/);
    assert.match(text, /Primary issue: Iron deficiency/);
    assert.match(text, /Less likely/);
    assert.match(text, /Fe EDTA · 2 g\/L · Foliar spray/);
    assert.match(text, /Spray timing/);
    assert.match(text, /Morbeez assessment/);
    assert.match(text, /Soil pH 7.3/);
    assert.ok(text.length > 400, 'should not truncate rich diagnosis');
  });

  it('renders Malayalam section headers', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: richAdvisory,
      language: 'ml',
    });
    assert.match(text, /പ്രധാന പ്രശ്നം/);
    assert.match(text, /ഉടനടി നടപടി/);
  });

  it('falls back to farmerSummary when no rich sections and no image evidence required', () => {
    const thin: StructuredAdvisory = {
      ...richAdvisory,
      farmerReport: '',
      imageObservations: [],
      differentialDiagnosis: [],
      dosageGuidance: [],
      sprayTiming: '',
      rootCorrection: '',
      agronomistAssessment: '',
      morbeezDataUsed: [],
    };
    const text = whatsappDiagnosisRendererService.render({ advisory: thin, language: 'en' });
    assert.match(text, /Iron deficiency likely/);
  });

  it('renders ranked presentation when diagnosisRanked is set', () => {
    const text = whatsappDiagnosisRendererService.render({
      advisory: {
        ...richAdvisory,
        farmerReport: '',
        diagnosisHeadline: 'Nutrient deficiency (most likely among several factors — 24% confidence)',
        diagnosisRanked: [
          { label: 'Nutrient deficiency', probability: 0.24, role: 'primary', stars: 2 },
          { label: 'Pyricularia leaf blast', probability: 0.26, role: 'disease_watch', stars: 2 },
        ],
        diseaseWatchNote: 'Humidity can favour blast — monitor for new lesions.',
        treatmentAlignmentNote: 'Treatment focuses on nutrition and field conditions.',
      },
      language: 'en',
    });
    assert.match(text, /Most likely cause/);
    assert.match(text, /Ranked possibilities/);
    assert.match(text, /Nutrient deficiency — 24%/);
    assert.match(text, /Disease watch/);
  });
});
