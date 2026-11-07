/**
 * Demo workspace dataset.
 *
 * Used when NEXT_PUBLIC_USE_MOCK is not "false". Shapes match the API
 * contracts in src/types; evidence hashes are real SHA-256 digests of
 * `excerpt|locator`, so in-browser verification is genuine.
 */

import type { Project, ProjectMember } from "@/types/project.types";
import type { ResearchRun } from "@/types/research.types";
import type { Report, ReportVersion, HumanDecision } from "@/types/report.types";
import type { PlatformNotification } from "@/types/notification.types";
import type {
  RunCompletionDataPoint,
  TokenExpenditureDataPoint,
  LatencyDistributionBucket,
  AgentPerformanceMetric,
  PlatformKpiSnapshot,
} from "@/types/analytics.types";
import type {
  SourceRecord,
  ResearchSchedule,
  PromptVersion,
  ModelConfig,
  QualityGate,
  GoldenSample,
} from "@/types/platform.types";

export const DEMO_USER = {
  id: "usr_lead_001",
  name: "Muhammad Shoaib",
  email: "muhammad.shoaib@platform.local",
  title: "Project owner",
};

// ── Projects ──────────────────────────────────────────────────────

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_intel_001",
    name: "Frontier AI & Market Economics",
    description:
      "Agent orchestration architectures, inference economics and latency budgets — and where the published numbers disagree.",
    ownerId: "usr_lead_001",
    membersCount: 6,
    stats: { totalRuns: 14, completedRuns: 12, totalReports: 8, totalSources: 42, contradictionsFound: 6 },
    createdAt: "2026-09-20T08:00:00Z",
    updatedAt: "2026-09-25T14:30:00Z",
  },
  {
    id: "proj_semicon_002",
    name: "Advanced Semiconductor Supply Chains",
    description:
      "2nm/3nm lithography yield curves, export controls and material sourcing across jurisdictions.",
    ownerId: "usr_lead_001",
    membersCount: 2,
    stats: { totalRuns: 9, completedRuns: 8, totalReports: 5, totalSources: 31, contradictionsFound: 4 },
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-09-25T11:15:00Z",
  },
];

// ── Research runs ─────────────────────────────────────────────────

export const MOCK_RESEARCH_RUNS: ResearchRun[] = [
  {
    id: "run_9a2f4c",
    projectId: "proj_intel_001",
    researchQuestionId: "rq_01",
    questionText:
      "What are the empirical throughput and latency trade-offs between dense pgvector search and hybrid BM25 + Reciprocal Rank Fusion under high-concurrency loads?",
    state: "EVIDENCE_ANALYSIS",
    currentStage: "EVIDENCE",
    progressPercent: 62,
    createdBy: "usr_lead_001",
    creatorName: "Muhammad Shoaib",
    config: {
      maxSources: 25,
      embeddingModel: "text-embedding-3-large (3072-dim)",
      rerankerThreshold: 0.82,
      enableContradictionDetection: true,
      maxRepairAttempts: 3,
      primaryModelId: "gpt-4o-v1",
      fallbackModelId: "gemini-1.5-flash-v1",
    },
    startedAt: "2026-09-25T15:45:00Z",
    createdAt: "2026-09-25T15:44:30Z",
    updatedAt: "2026-09-25T15:52:10Z",
    sourceCount: 18,
    evidenceCount: 74,
    contradictionCount: 3,
  },
  {
    id: "run_7c0a9f",
    projectId: "proj_intel_001",
    researchQuestionId: "rq_03",
    questionText:
      "Evaluating deterministic unit conversion vs LLM heuristic classification in cross-source financial metrics.",
    state: "VALIDATING",
    currentStage: "VALIDATION",
    progressPercent: 92,
    createdBy: "usr_m2_lead",
    creatorName: "Abdullah Malik",
    config: {
      maxSources: 15,
      embeddingModel: "text-embedding-3-large",
      rerankerThreshold: 0.85,
      enableContradictionDetection: true,
      maxRepairAttempts: 3,
      primaryModelId: "claude-3-5-sonnet-v1",
    },
    startedAt: "2026-09-25T14:10:00Z",
    createdAt: "2026-09-25T14:09:00Z",
    updatedAt: "2026-09-25T14:26:00Z",
    sourceCount: 12,
    evidenceCount: 45,
    contradictionCount: 1,
  },
  {
    id: "run_8b1e3d",
    projectId: "proj_intel_001",
    researchQuestionId: "rq_02",
    questionText:
      "Comparative energy efficiency benchmarks for speculative decoding across 70B parameter models deployed on H100 vs B200 clusters.",
    state: "COMPLETED",
    currentStage: "VALIDATION",
    progressPercent: 100,
    createdBy: "usr_m1_lead",
    creatorName: "Talha Rehman",
    config: {
      maxSources: 30,
      embeddingModel: "text-embedding-3-large",
      rerankerThreshold: 0.8,
      enableContradictionDetection: true,
      maxRepairAttempts: 3,
      primaryModelId: "gpt-4o-v1",
    },
    startedAt: "2026-09-25T11:00:00Z",
    completedAt: "2026-09-25T11:18:42Z",
    createdAt: "2026-09-25T10:59:15Z",
    updatedAt: "2026-09-25T11:18:42Z",
    sourceCount: 22,
    evidenceCount: 96,
    contradictionCount: 4,
    reportId: "rep_energy_benchmarks_v1",
  },
  {
    id: "run_semicon_001",
    projectId: "proj_semicon_002",
    researchQuestionId: "rq_04",
    questionText:
      "How ready is High-NA EUV for 2nm volume production, and which supply chain bottlenecks matter most through 2027?",
    state: "COMPLETED",
    currentStage: "VALIDATION",
    progressPercent: 100,
    createdBy: "usr_lead_001",
    creatorName: "Muhammad Shoaib",
    config: {
      maxSources: 20,
      embeddingModel: "text-embedding-3-large",
      rerankerThreshold: 0.82,
      enableContradictionDetection: true,
      maxRepairAttempts: 3,
      primaryModelId: "gemini-1.5-pro-v1",
    },
    startedAt: "2026-09-24T16:02:00Z",
    completedAt: "2026-09-24T16:21:30Z",
    createdAt: "2026-09-24T16:00:00Z",
    updatedAt: "2026-09-24T18:30:00Z",
    sourceCount: 17,
    evidenceCount: 63,
    contradictionCount: 5,
    reportId: "rep_semicon_litho_01",
  },
  {
    id: "run_5e8b1a",
    projectId: "proj_semicon_002",
    researchQuestionId: "rq_05",
    questionText: "Germanium and gallium export restrictions: measured impact on substrate lead times since 2024.",
    state: "FAILED",
    currentStage: "RETRIEVAL",
    progressPercent: 41,
    createdBy: "usr_m2_lead",
    creatorName: "Abdullah Malik",
    config: { maxSources: 20, embeddingModel: "text-embedding-3-large", enableContradictionDetection: true, maxRepairAttempts: 3 },
    startedAt: "2026-09-22T16:20:00Z",
    completedAt: "2026-09-22T16:45:00Z",
    createdAt: "2026-09-22T16:19:00Z",
    updatedAt: "2026-09-22T16:45:00Z",
    sourceCount: 9,
    evidenceCount: 0,
    contradictionCount: 0,
    error: "Retrieval failed after 3 repair attempts: upstream search provider returned 429 (rate limited).",
  },
  {
    id: "run_4d2c8b",
    projectId: "proj_intel_001",
    researchQuestionId: "rq_06",
    questionText: "Total cost of ownership for self-hosted 70B inference vs managed APIs at 10M tokens/day.",
    state: "CANCELLED",
    currentStage: "DISCOVERY",
    progressPercent: 24,
    createdBy: "usr_lead_001",
    creatorName: "Muhammad Shoaib",
    config: { maxSources: 25, embeddingModel: "text-embedding-3-large", enableContradictionDetection: false, maxRepairAttempts: 3 },
    startedAt: "2026-09-21T10:58:00Z",
    completedAt: "2026-09-21T11:03:00Z",
    createdAt: "2026-09-21T10:57:30Z",
    updatedAt: "2026-09-21T11:03:00Z",
    sourceCount: 6,
    evidenceCount: 0,
    contradictionCount: 0,
  },
];

// ── Reports ───────────────────────────────────────────────────────

export const MOCK_REPORTS: Report[] = [
  {
    id: "rep_energy_benchmarks_v1",
    projectId: "proj_intel_001",
    researchQuestionId: "rq_02",
    currentVersion: 2,
    latestVersionId: "rep_v2_energy",
    title: "Speculative Decoding Energy & Latency Benchmarks: H100 vs B200",
    createdAt: "2026-09-25T11:20:00Z",
    updatedAt: "2026-09-25T13:45:00Z",
  },
  {
    id: "rep_semicon_litho_01",
    projectId: "proj_semicon_002",
    researchQuestionId: "rq_04",
    currentVersion: 1,
    latestVersionId: "rep_v1_semicon",
    title: "2nm/3nm EUV Lithography Yields & Critical Supply Chain Bottlenecks",
    createdAt: "2026-09-24T16:00:00Z",
    updatedAt: "2026-09-24T18:30:00Z",
  },
];

export const MOCK_REPORT_VERSIONS: Record<string, ReportVersion> = {
  rep_v1_energy: {
    id: "rep_v1_energy",
    reportId: "rep_energy_benchmarks_v1",
    versionNumber: 1,
    researchRunId: "run_8b1e3d",
    title: "Speculative Decoding Energy & Latency Benchmarks: H100 vs B200 (Initial Draft)",
    summary:
      "An early look at inference throughput scaling and energy use for speculative decoding on current accelerator clusters.",
    createdBy: "usr_m1_lead",
    createdAt: "2026-09-25T11:20:00Z",
    isDraft: false,
    evidenceSetHash: "043f768a9e247aabe0f5b80f9b9227de08e31ab1ba5e88527fe6d5bab3bff15e",
    contradictions: [
      {
        id: "contra_v1_01",
        type: "NUMERIC_CONFLICT",
        entity: "NVIDIA B200 speculative token acceptance rate",
        metric: "Acceptance rate α",
        claimA: "DeepSeek v3 technical paper reports average acceptance rate of 78.4% on GSM8K using a 7B draft model.",
        claimB: "Independent MLCommons submission shows 69.1% acceptance rate on an identical prompt distribution.",
        valueA: "78.4%",
        valueB: "69.1%",
        timePeriodA: "2026-Q1",
        timePeriodB: "2026-Q2",
        isDeterministic: true,
        resolution: "Under investigation. Suspected temperature variation.",
      },
    ],
    sections: [
      {
        id: "sec_v1_01",
        order: 1,
        title: "Executive summary & cluster architecture",
        contentMarkdown:
          "Speculative decoding accelerates autoregressive generation by employing a smaller draft model to propose candidate tokens, subsequently verified in parallel by the target model [1]. Preliminary tests indicate substantial joule reductions on B200 architectures.",
        claims: [
          {
            id: "clm_v1_01",
            sectionId: "sec_v1_01",
            text: "Speculative decoding accelerates autoregressive generation by employing a smaller draft model to propose candidate tokens.",
            citations: [
              {
                id: "cit_v1_01",
                citationNumber: 1,
                claimId: "clm_v1_01",
                evidenceId: "ev_801",
                documentChunkId: "chk_092a",
                documentVersionId: "doc_v1.3",
                sourceVersionId: "src_v4.1",
                sourceTitle: "Leviathan et al., Fast Inference from Transformers via Speculative Decoding",
                sourceUrl: "https://arxiv.org/abs/2211.17192",
                excerpt:
                  "We introduce speculative decoding, an algorithm allowing sampling multiple tokens per transformer call from a target model by running a small draft model.",
                locator: "Page 2, Abstract Section, lines 14-22",
                evidenceHash: "3d7c66f153ad4ecdb96f4c1cb027d9d6f6733b9754409aec77710773bf244573",
                verified: true,
                retrievedAt: "2026-09-25T11:04:12Z",
                retrievalScore: 0.91,
                ocrConfidence: 0.99,
              },
            ],
            hasContradiction: false,
          },
        ],
      },
      {
        id: "sec_v1_02",
        order: 2,
        title: "Initial latency measurements",
        contentMarkdown: "Draft model verification overhead remains sub-linear with batch size up to 16 concurrent requests.",
        claims: [],
      },
    ],
  },

  rep_v2_energy: {
    id: "rep_v2_energy",
    reportId: "rep_energy_benchmarks_v1",
    versionNumber: 2,
    researchRunId: "run_8b1e3d",
    title: "Speculative Decoding Energy & Latency Benchmarks: H100 vs B200",
    summary:
      "How speculative decoding scales in throughput and energy across H100 and B200 clusters, where the published numbers disagree, and what we would deploy. Every citation resolves to an immutable document chunk with a verifiable SHA-256 hash.",
    createdBy: "usr_m1_lead",
    createdAt: "2026-09-25T13:45:00Z",
    isDraft: false,
    evidenceSetHash: "a23f4174fa107a5c6afe0e9de6888af5459f97e9d47e4674429c29a2730f35a5",
    contradictions: [
      {
        id: "contra_01",
        type: "NUMERIC_CONFLICT",
        entity: "NVIDIA B200 speculative token acceptance rate",
        metric: "Acceptance rate α",
        claimA: "DeepSeek v3 technical paper reports average acceptance rate of 78.4% on GSM8K using a 7B draft model.",
        claimB: "Independent MLCommons submission shows 69.1% acceptance rate on an identical prompt distribution.",
        valueA: "78.4%",
        valueB: "69.1%",
        timePeriodA: "2026-Q1",
        timePeriodB: "2026-Q2",
        isDeterministic: true,
        resolution:
          "Calculation Service traced the gap to sampling temperature (T=0.0 vs T=0.7). Re-evaluated at T=0.0, the MLCommons figure is 77.9%.",
      },
      {
        id: "contra_02",
        type: "DIRECT_CONTRADICTION",
        entity: "FP8 tensor memory bandwidth saturation point",
        metric: "Context window threshold",
        claimA: "Hardware telemetry logs indicate memory saturation occurs at 16,384 tokens under uncompressed KV-cache.",
        claimB: "Vendor application note asserts zero bandwidth saturation up to 32,768 tokens.",
        valueA: "16,384 tokens",
        valueB: "32,768 tokens",
        isDeterministic: false,
        resolution:
          "Advisory: the vendor note assumes PagedAttention with 4-bit KV quantisation; the telemetry run used native uncompressed 16-bit keys.",
      },
      {
        id: "contra_03",
        type: "TEMPORAL_DIFFERENCE",
        entity: "H100 SXM5 sustained power draw",
        metric: "TDP (W)",
        claimA: "2024 initial datasheet listed sustained power consumption at 700 W peak per module.",
        claimB: "2026 firmware revision 545.23 throttles the sustained ceiling to 650 W under the thermal envelope.",
        valueA: "700 W",
        valueB: "650 W",
        timePeriodA: "2024-H1",
        timePeriodB: "2026-Q1",
        isDeterministic: true,
        resolution: "Confirmed via firmware release notes; 650 W is the current operational baseline.",
      },
      {
        id: "contra_04",
        type: "METHODOLOGY_DIFFERENCE",
        entity: "Draft model latency profiling",
        metric: "Time to first token",
        claimA: "Kernel trace measures TTFT excluding PCIe host-to-device weight loading (12.4 ms).",
        claimB: "End-to-end client SDK measures TTFT including network round trip and deserialisation (34.8 ms).",
        valueA: "12.4 ms",
        valueB: "34.8 ms",
        isDeterministic: false,
        resolution:
          "Both are valid: kernel TTFT isolates the accelerator, client TTFT is what users feel. The report quotes both, labelled.",
      },
    ],
    sections: [
      {
        id: "sec_01",
        order: 1,
        title: "Executive summary & cluster architecture",
        contentMarkdown:
          "Speculative decoding accelerates autoregressive generation by employing a smaller draft model to propose candidate tokens, subsequently verified in parallel by the target model [1]. Deploying on B200 Tensor Core architecture delivers a 2.4x reduction in joules-per-token compared to baseline FP16 execution on H100 [2].",
        claims: [
          {
            id: "clm_01",
            sectionId: "sec_01",
            text: "Speculative decoding accelerates autoregressive generation by employing a smaller draft model to propose candidate tokens, subsequently verified in parallel by the target model.",
            citations: [
              {
                id: "cit_01",
                citationNumber: 1,
                claimId: "clm_01",
                evidenceId: "ev_801",
                documentChunkId: "chk_092a",
                documentVersionId: "doc_v1.3",
                sourceVersionId: "src_v4.1",
                sourceTitle: "Leviathan et al., Fast Inference from Transformers via Speculative Decoding",
                sourceUrl: "https://arxiv.org/abs/2211.17192",
                excerpt:
                  "We introduce speculative decoding, an algorithm allowing sampling multiple tokens per transformer call from a target model by running a small draft model.",
                locator: "Page 2, Abstract Section, lines 14-22",
                evidenceHash: "3d7c66f153ad4ecdb96f4c1cb027d9d6f6733b9754409aec77710773bf244573",
                verified: true,
                retrievedAt: "2026-09-25T11:04:12Z",
                retrievalScore: 0.91,
                ocrConfidence: 0.99,
              },
            ],
            hasContradiction: false,
          },
          {
            id: "clm_02",
            sectionId: "sec_01",
            text: "Deploying on B200 Tensor Core architecture delivers a 2.4x reduction in joules-per-token compared to baseline FP16 execution on H100.",
            citations: [
              {
                id: "cit_02",
                citationNumber: 2,
                claimId: "clm_02",
                evidenceId: "ev_802",
                documentChunkId: "chk_108b",
                documentVersionId: "doc_v2.0",
                sourceVersionId: "src_v5.2",
                sourceTitle: "NVIDIA Blackwell Architecture Whitepaper (Table 4: Power Curves)",
                sourceUrl: "https://nvidia.com/blackwell-architecture-spec.pdf",
                excerpt:
                  "In speculative inference configurations with 8-bit quantization, energy dissipation per generated token drops from 12.8 mJ on H100 to 5.3 mJ on B200.",
                locator: "Page 18, Table 4, Row 3",
                evidenceHash: "2096d0512952ddff93de428cefddb3c45393b3517a7cc0b48b66f853b48e4509",
                verified: true,
                retrievedAt: "2026-09-25T11:05:40Z",
                retrievalScore: 0.86,
                ocrConfidence: 0.94,
              },
            ],
            hasContradiction: false,
          },
        ],
      },
      {
        id: "sec_02",
        order: 2,
        title: "Throughput scaling & acceptance rate dynamics",
        contentMarkdown:
          "Empirical latency measurements over 100k requests show draft acceptance rate decays quadratically with increasing prompt entropy [3]. Using FP8 matrix multiplication kernels across an 8-GPU interconnect yields an aggregate throughput of 4,820 tokens/sec at batch size 32 [4].",
        claims: [
          {
            id: "clm_03",
            sectionId: "sec_02",
            text: "Empirical latency measurements over 100k requests show draft acceptance rate decays quadratically with increasing prompt entropy.",
            citations: [
              {
                id: "cit_03",
                citationNumber: 3,
                claimId: "clm_03",
                evidenceId: "ev_803",
                documentChunkId: "chk_119c",
                documentVersionId: "doc_v1.0",
                sourceVersionId: "src_v3.2",
                sourceTitle: "Chen et al., Accelerating LLM Inference with Speculative Sampling",
                sourceUrl: "https://arxiv.org/abs/2302.01318",
                excerpt:
                  "Empirical latency measurements over 100k requests show draft acceptance rate decays quadratically with increasing prompt entropy.",
                locator: "Section 4.2, Paragraph 3, Figure 6",
                evidenceHash: "2738a35bf63a71627f991919ebde8d3c3ff04ca1d0d87e32e528fe973b225f02",
                verified: true,
                retrievedAt: "2026-09-25T11:07:02Z",
                retrievalScore: 0.88,
                ocrConfidence: 0.97,
              },
            ],
            hasContradiction: false,
          },
          {
            id: "clm_04",
            sectionId: "sec_02",
            text: "Using FP8 matrix multiplication kernels across an 8-GPU interconnect yields an aggregate throughput of 4,820 tokens/sec at batch size 32.",
            citations: [
              {
                id: "cit_04",
                citationNumber: 4,
                claimId: "clm_04",
                evidenceId: "ev_804",
                documentChunkId: "chk_204d",
                documentVersionId: "doc_v3.1",
                sourceVersionId: "src_v6.0",
                sourceTitle: "MLCommons Inference v4.1 Technical Results",
                sourceUrl: "https://mlcommons.org/inference-v41-results",
                excerpt:
                  "Using FP8 matrix multiplication kernels across 8-GPU interconnect yields an aggregate throughput of 4,820 tokens/sec at batch size 32.",
                locator: "Section 5.1, Benchmark Summary Table 2",
                evidenceHash: "4d51005c775842549fafdf2ffeb9b3d40f9fc78940c644b02274dc661e75b0bb",
                verified: true,
                retrievedAt: "2026-09-25T11:08:31Z",
                retrievalScore: 0.83,
                ocrConfidence: 0.96,
              },
            ],
            hasContradiction: true,
            contradictionIds: ["contra_01"],
          },
        ],
      },
      {
        id: "sec_03",
        order: 3,
        title: "Memory bandwidth & context window saturation",
        contentMarkdown:
          "Memory bandwidth saturation on SXM5 interfaces occurs when sequence length exceeds 16,384 tokens with uncompressed KV-cache [5]. Beyond this boundary, KV-cache paging is required to avoid a sudden latency cliff.",
        claims: [
          {
            id: "clm_05",
            sectionId: "sec_03",
            text: "Memory bandwidth saturation on SXM5 interfaces occurs when sequence length exceeds 16,384 tokens with uncompressed KV-cache.",
            citations: [
              {
                id: "cit_05",
                citationNumber: 5,
                claimId: "clm_05",
                evidenceId: "ev_805",
                documentChunkId: "chk_310e",
                documentVersionId: "doc_v2.4",
                sourceVersionId: "src_v7.1",
                sourceTitle: "Hardware Telemetry Audit: GPU Memory Subsystem Saturation",
                sourceUrl: "https://internal-telemetry.corp.net/audits/gpu-mem-sxm5",
                excerpt:
                  "Memory bandwidth saturation on SXM5 interfaces occurs when sequence length exceeds 16,384 tokens with uncompressed KV-cache.",
                locator: "Technical Appendix C, Equation 12",
                evidenceHash: "8440168f21d87cead36b90c5b35ccf34306fb38b952a09d05e7d7aa31bdbfbf3",
                verified: true,
                retrievedAt: "2026-09-25T11:10:15Z",
                retrievalScore: 0.79,
                ocrConfidence: 0.92,
              },
            ],
            hasContradiction: true,
            contradictionIds: ["contra_02"],
          },
        ],
      },
      {
        id: "sec_04",
        order: 4,
        title: "Recommendations & operating boundaries",
        contentMarkdown:
          "For production deployments running models above 70B parameters, we recommend a 7B-parameter distilled draft model on dedicated L40S or B200 instances with FP8-quantised KV-cache. This gives the best cost efficiency while preserving target model output parity.",
        claims: [],
      },
    ],
  },

  rep_v1_semicon: {
    id: "rep_v1_semicon",
    reportId: "rep_semicon_litho_01",
    versionNumber: 1,
    researchRunId: "run_semicon_001",
    title: "2nm/3nm EUV Lithography Yields & Critical Supply Chain Bottlenecks",
    summary:
      "High-NA EUV tool availability, defect density targets and export-control exposure for leading-edge fabrication. Most of the apparent disagreements turn out to be differences in scope or definition.",
    createdBy: "usr_lead_001",
    createdAt: "2026-09-24T18:30:00Z",
    isDraft: false,
    evidenceSetHash: "969afe07a30508ac500c988c8319a3f1f7a62b0aa83bc83112d6c9ab8654b267",
    contradictions: [
      {
        id: "contra_semi_01",
        type: "SCOPE_DIFFERENCE",
        entity: "TSMC N2 wafer pricing",
        metric: "Price per wafer (USD)",
        claimA: "Fab analyst report quotes $28,000 per wafer for initial commercial production runs.",
        claimB: "Customer consortium filing indicates $34,500 per wafer inclusive of packaging and shuttle margins.",
        valueA: "$28,000",
        valueB: "$34,500",
        unitA: "USD (bare wafer)",
        unitB: "USD (packaged system)",
        isDeterministic: false,
        resolution: "Scope difference: A is bare silicon; B includes CoWoS advanced packaging overhead.",
      },
      {
        id: "contra_semi_02",
        type: "UNIT_DIFFERENCE",
        entity: "EUV light source power",
        metric: "Source power rating",
        claimA: "ASML technical specification lists source power as 500 Watts at intermediate focus.",
        claimB: "Japanese supplier document states 0.5 kiloWatts under continuous laser pulsing.",
        valueA: "500",
        valueB: "0.5",
        unitA: "W",
        unitB: "kW",
        isDeterministic: true,
        resolution: "Calculation Service confirmed exact equivalence: 500 W = 0.5 kW. No material conflict exists.",
      },
      {
        id: "contra_semi_03",
        type: "DEFINITION_DIFFERENCE",
        entity: "Fab yield definition",
        metric: "Yield (%)",
        claimA: "Commercial press states 3nm defect-free yield stands at 82%.",
        claimB: "Independent IEEE audit reports 68% die yield under automotive safety certification standards.",
        valueA: "82%",
        valueB: "68%",
        isDeterministic: false,
        resolution:
          "Definition difference: the press figure is functional wafer yield excluding edge die; the audit measures automotive zero-defect die yield.",
      },
      {
        id: "contra_semi_04",
        type: "ENTITY_AMBIGUITY",
        entity: "High-NA EUV tool (EXE:5000 vs EXE:5200)",
        metric: "Wafers per hour",
        claimA: "Tool delivers 185 wafers per hour under full production illumination.",
        claimB: "Tool is limited to 145 wafers per hour in the initial R&D pilot line.",
        isDeterministic: false,
        resolution: "Different tools: A refers to the EXE:5200 production system, B to the EXE:5000 pilot.",
      },
      {
        id: "contra_semi_05",
        type: "INSUFFICIENT_CONTEXT",
        entity: "Germanium substrate thermal expansion coefficient",
        metric: "CTE (ppm/K)",
        claimA: "Coefficient reported as 5.9 ppm/K without a temperature reference.",
        claimB: "Material science handbook reports 6.2 ppm/K at 300 K.",
        isDeterministic: false,
        resolution: "Not enough context: source A omits the temperature range needed for a thermal budget calculation.",
      },
    ],
    sections: [
      {
        id: "sec_semi_01",
        order: 1,
        title: "Lithography roadmap & High-NA readiness",
        contentMarkdown:
          "Commercial transition to 2nm nodes needs 0.55 NA High-NA EUV systems to avoid complex multi-patterning [1]. The early adoption curve shows a wide yield gap between consumer-grade and automotive-certified dies.",
        claims: [
          {
            id: "clm_semi_01",
            sectionId: "sec_semi_01",
            text: "Commercial transition to 2nm nodes needs 0.55 NA High-NA EUV systems to avoid complex multi-patterning.",
            citations: [
              {
                id: "cit_semi_01",
                citationNumber: 1,
                claimId: "clm_semi_01",
                evidenceId: "ev_s01",
                documentChunkId: "chk_s_041",
                documentVersionId: "doc_irds_2026",
                sourceVersionId: "src_irds_v2",
                sourceTitle: "IEEE IRDS: Lithography Roadmap 2026",
                sourceUrl: "https://irds.ieee.org/editions/2026/lithography",
                excerpt:
                  "High-NA (0.55) EUV is required for single-exposure patterning of the tightest metal pitches at the 2nm node and beyond.",
                locator: "Table LITH-2, note 4",
                evidenceHash: "4a540151ba97dba9a122e6b4d636b8fddc20c08200e3005c5a42464339ccee90",
                verified: true,
                retrievedAt: "2026-09-24T16:08:44Z",
                retrievalScore: 0.9,
                ocrConfidence: 0.98,
              },
            ],
            hasContradiction: false,
          },
        ],
      },
      {
        id: "sec_semi_02",
        order: 2,
        title: "Where the bottlenecks are",
        contentMarkdown:
          "Leading-edge capacity remains concentrated in two regions [2], and export restrictions on germanium and gallium have lengthened substrate lead times. Packaging, not lithography, is the near-term constraint for AI accelerators.",
        claims: [
          {
            id: "clm_semi_02",
            sectionId: "sec_semi_02",
            text: "Leading-edge capacity remains concentrated in two regions.",
            citations: [
              {
                id: "cit_semi_02",
                citationNumber: 2,
                claimId: "clm_semi_02",
                evidenceId: "ev_s02",
                documentChunkId: "chk_s_112",
                documentVersionId: "doc_doc_review_v1",
                sourceVersionId: "src_commerce_v1",
                sourceTitle: "Semiconductor Supply Chain Resilience Review",
                sourceUrl: "https://www.commerce.gov/semiconductor-review",
                excerpt:
                  "More than 90 percent of leading-edge logic capacity is located in two geographic regions.",
                locator: "Executive Summary, paragraph 3",
                evidenceHash: "080580a64a530254bdc9727f13dc5f1d8049cc636765769519ed18ae8fa7651e",
                verified: true,
                retrievedAt: "2026-09-24T16:11:20Z",
                retrievalScore: 0.87,
                ocrConfidence: 0.99,
              },
            ],
            hasContradiction: false,
          },
        ],
      },
    ],
  },
};

export const MOCK_HUMAN_DECISIONS: HumanDecision[] = [
  {
    id: "dec_002",
    userId: "usr_analyst_01",
    userName: "Fatima Noor",
    projectId: "proj_intel_001",
    reportVersionId: "rep_v1_energy",
    decisionType: "NEEDS_REVISION",
    decisionValue: "More KV-cache latency benchmarks before sign-off",
    reason:
      "Version 1 doesn't look at long-context memory saturation beyond 16k tokens. Asked for additional telemetry runs before we sign off.",
    createdAt: "2026-09-25T11:45:00Z",
  },
  {
    id: "dec_001",
    userId: "usr_lead_001",
    userName: "Muhammad Shoaib",
    projectId: "proj_intel_001",
    reportVersionId: "rep_v2_energy",
    decisionType: "APPROVED",
    decisionValue: "Approved for B200 deployment planning",
    reason:
      "All five evidence hashes verified. The four conflicts are either resolved by the calculation service or explained (methodology, quantisation). Fine to use for Q4 capacity planning.",
    createdAt: "2026-09-25T14:15:00Z",
  },
];

// ── Query & mutation helpers (demo mode) ─────────────────────────

export function getReportById(reportId: string): Report | undefined {
  return MOCK_REPORTS.find((r) => r.id === reportId);
}

export function getReportVersion(versionId: string): ReportVersion | undefined {
  return MOCK_REPORT_VERSIONS[versionId];
}

export function getReportVersionsByReportId(reportId: string): ReportVersion[] {
  return Object.values(MOCK_REPORT_VERSIONS)
    .filter((v) => v.reportId === reportId)
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

export function getHumanDecisionsByReportVersion(reportVersionId: string): HumanDecision[] {
  return MOCK_HUMAN_DECISIONS.filter((d) => d.reportVersionId === reportVersionId);
}

export function recordHumanDecision(decision: Omit<HumanDecision, "id" | "createdAt">): HumanDecision {
  const newDecision: HumanDecision = {
    ...decision,
    id: `dec_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  MOCK_HUMAN_DECISIONS.push(newDecision);
  return newDecision;
}

// ── Notifications ────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: "notif_003",
    type: "CONTRADICTION_FLAGGED",
    severity: "WARNING",
    title: "3 conflicts in the retrieval benchmark run",
    message: "Numbers disagree on hybrid search latency under load. Worth a look before the report is drafted.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "run_9a2f4c",
    resourceType: "research_run",
    createdAt: "2026-09-25T15:52:10Z",
    isRead: false,
  },
  {
    id: "notif_006",
    type: "RUN_STARTED",
    severity: "INFO",
    title: "Abdullah started a run",
    message: "Deterministic unit conversion vs LLM classification in financial metrics.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "run_7c0a9f",
    resourceType: "research_run",
    createdAt: "2026-09-25T14:10:00Z",
    isRead: true,
  },
  {
    id: "notif_001",
    type: "HUMAN_DECISION_REQUIRED",
    severity: "WARNING",
    title: "Speculative decoding v2 is waiting on you",
    message: "This version needs a recorded decision before it can be published.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "rep_energy_benchmarks_v1",
    resourceType: "report",
    reportVersionId: "rep_v2_energy",
    createdAt: "2026-09-25T14:05:00Z",
    isRead: false,
  },
  {
    id: "notif_002",
    type: "RUN_COMPLETED",
    severity: "SUCCESS",
    title: "Energy benchmarks run finished",
    message: "22 sources, 96 evidence excerpts, 4 conflicts flagged. Report v2 is ready to read.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "run_8b1e3d",
    resourceType: "research_run",
    createdAt: "2026-09-25T11:18:42Z",
    isRead: false,
  },
  {
    id: "notif_004",
    type: "REPORT_PUBLISHED",
    severity: "SUCCESS",
    title: "EUV lithography report published",
    message: "Version 1 is now an immutable record.",
    projectId: "proj_semicon_002",
    projectName: "Advanced Semiconductor Supply Chains",
    resourceId: "rep_semicon_litho_01",
    resourceType: "report",
    createdAt: "2026-09-24T18:30:00Z",
    isRead: true,
  },
  {
    id: "notif_005",
    type: "MEMBER_INVITED",
    severity: "INFO",
    title: "Shoaib Malik joined as Admin",
    message: "Invited to Frontier AI & Market Economics.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "mem_005",
    resourceType: "member",
    createdAt: "2026-09-23T09:15:00Z",
    isRead: true,
  },
  {
    id: "notif_007",
    type: "RUN_FAILED",
    severity: "ERROR",
    title: "Export-restrictions run failed",
    message: "Retrieval hit the search provider's rate limit three times. Repair attempts exhausted.",
    projectId: "proj_semicon_002",
    projectName: "Advanced Semiconductor Supply Chains",
    resourceId: "run_5e8b1a",
    resourceType: "research_run",
    createdAt: "2026-09-22T16:45:00Z",
    isRead: true,
  },
  {
    id: "notif_008",
    type: "CANCELLATION_ACKNOWLEDGED",
    severity: "WARNING",
    title: "Cancellation acknowledged",
    message: "The TCO run stopped cleanly within the 10-second window.",
    projectId: "proj_intel_001",
    projectName: "Frontier AI & Market Economics",
    resourceId: "run_4d2c8b",
    resourceType: "research_run",
    createdAt: "2026-09-21T11:03:00Z",
    isRead: true,
  },
];

// ── Members ──────────────────────────────────────────────────────

export const MOCK_PROJECT_MEMBERS: ProjectMember[] = [
  { id: "mem_001", projectId: "proj_intel_001", userId: "usr_lead_001", userName: "Muhammad Shoaib", userEmail: "muhammad.shoaib@platform.local", role: "OWNER", status: "ACTIVE", createdAt: "2026-09-20T08:00:00Z" },
  { id: "mem_002", projectId: "proj_intel_001", userId: "usr_m1_lead", userName: "Talha Rehman", userEmail: "talha.rehman@platform.local", role: "ADMIN", status: "ACTIVE", invitedBy: "usr_lead_001", createdAt: "2026-09-20T08:30:00Z" },
  { id: "mem_003", projectId: "proj_intel_001", userId: "usr_m2_lead", userName: "Abdullah Malik", userEmail: "abdullah.malik@platform.local", role: "RESEARCHER", status: "ACTIVE", invitedBy: "usr_lead_001", createdAt: "2026-09-20T09:00:00Z" },
  { id: "mem_004", projectId: "proj_intel_001", userId: "usr_analyst_01", userName: "Fatima Noor", userEmail: "fatima.noor@platform.local", role: "ANALYST", status: "ACTIVE", invitedBy: "usr_m1_lead", createdAt: "2026-09-21T10:00:00Z" },
  { id: "mem_005", projectId: "proj_intel_001", userId: "usr_m5_lead", userName: "Shoaib Malik", userEmail: "shoaib.malik@platform.local", role: "ADMIN", status: "ACTIVE", invitedBy: "usr_lead_001", createdAt: "2026-09-23T09:15:00Z" },
  { id: "mem_006", projectId: "proj_intel_001", userId: "usr_viewer_01", userName: "Stakeholder Demo", userEmail: "demo.viewer@platform.local", role: "VIEWER", status: "INVITED", invitedBy: "usr_lead_001", createdAt: "2026-09-25T16:00:00Z" },
  { id: "mem_007", projectId: "proj_semicon_002", userId: "usr_lead_001", userName: "Muhammad Shoaib", userEmail: "muhammad.shoaib@platform.local", role: "OWNER", status: "ACTIVE", createdAt: "2026-09-22T10:00:00Z" },
  { id: "mem_008", projectId: "proj_semicon_002", userId: "usr_m2_lead", userName: "Abdullah Malik", userEmail: "abdullah.malik@platform.local", role: "RESEARCHER", status: "ACTIVE", invitedBy: "usr_lead_001", createdAt: "2026-09-22T10:30:00Z" },
];

export function getMembersByProjectId(projectId: string): ProjectMember[] {
  return MOCK_PROJECT_MEMBERS.filter((m) => m.projectId === projectId);
}

export function addProjectMember(member: Omit<ProjectMember, "id" | "createdAt">): ProjectMember {
  const newMember: ProjectMember = { ...member, id: `mem_${Date.now()}`, createdAt: new Date().toISOString() };
  MOCK_PROJECT_MEMBERS.push(newMember);
  return newMember;
}

export function updateMemberRole(memberId: string, newRole: ProjectMember["role"]): ProjectMember | null {
  const idx = MOCK_PROJECT_MEMBERS.findIndex((m) => m.id === memberId);
  if (idx === -1) return null;
  MOCK_PROJECT_MEMBERS[idx] = { ...MOCK_PROJECT_MEMBERS[idx], role: newRole };
  return MOCK_PROJECT_MEMBERS[idx];
}

export function removeMember(memberId: string): boolean {
  const idx = MOCK_PROJECT_MEMBERS.findIndex((m) => m.id === memberId);
  if (idx === -1) return false;
  MOCK_PROJECT_MEMBERS[idx] = { ...MOCK_PROJECT_MEMBERS[idx], status: "REMOVED" };
  return true;
}

// ── Analytics ────────────────────────────────────────────────────

export const MOCK_RUN_COMPLETION_SERIES: RunCompletionDataPoint[] = [
  { date: "2026-09-19", completed: 2, failed: 0, cancelled: 0 },
  { date: "2026-09-20", completed: 3, failed: 1, cancelled: 0 },
  { date: "2026-09-21", completed: 4, failed: 0, cancelled: 1 },
  { date: "2026-09-22", completed: 2, failed: 1, cancelled: 0 },
  { date: "2026-09-23", completed: 5, failed: 0, cancelled: 0 },
  { date: "2026-09-24", completed: 3, failed: 0, cancelled: 1 },
  { date: "2026-09-25", completed: 4, failed: 1, cancelled: 0 },
];

export const MOCK_TOKEN_EXPENDITURE_SERIES: TokenExpenditureDataPoint[] = [
  { date: "2026-09-19", promptTokens: 42000, completionTokens: 12800, totalTokens: 54800, estimatedCostUSD: 1.24 },
  { date: "2026-09-20", promptTokens: 68400, completionTokens: 19200, totalTokens: 87600, estimatedCostUSD: 1.98 },
  { date: "2026-09-21", promptTokens: 91200, completionTokens: 24600, totalTokens: 115800, estimatedCostUSD: 2.62 },
  { date: "2026-09-22", promptTokens: 54600, completionTokens: 15100, totalTokens: 69700, estimatedCostUSD: 1.58 },
  { date: "2026-09-23", promptTokens: 124800, completionTokens: 31200, totalTokens: 156000, estimatedCostUSD: 3.53 },
  { date: "2026-09-24", promptTokens: 76000, completionTokens: 22400, totalTokens: 98400, estimatedCostUSD: 2.23 },
  { date: "2026-09-25", promptTokens: 108000, completionTokens: 28800, totalTokens: 136800, estimatedCostUSD: 3.1 },
];

export const MOCK_LATENCY_DISTRIBUTION: LatencyDistributionBucket[] = [
  { bucket: "<50ms", count: 1240, percentage: 31.0 },
  { bucket: "50–100ms", count: 1580, percentage: 39.5 },
  { bucket: "100–200ms", count: 740, percentage: 18.5 },
  { bucket: "200–300ms", count: 280, percentage: 7.0 },
  { bucket: "300–500ms", count: 120, percentage: 3.0 },
  { bucket: ">500ms", count: 40, percentage: 1.0 },
];

export const MOCK_AGENT_PERFORMANCE: AgentPerformanceMetric[] = [
  { agent: "Research Planner", avgDurationMs: 1840, p95DurationMs: 3200, successRate: 99.2 },
  { agent: "Source Discovery", avgDurationMs: 4320, p95DurationMs: 7800, successRate: 97.8 },
  { agent: "Retrieval", avgDurationMs: 2180, p95DurationMs: 4100, successRate: 98.5 },
  { agent: "Evidence Analysis", avgDurationMs: 5640, p95DurationMs: 9600, successRate: 96.4 },
  { agent: "Contradiction Analysis", avgDurationMs: 3290, p95DurationMs: 5800, successRate: 99.0 },
  { agent: "Synthesis", avgDurationMs: 6120, p95DurationMs: 10400, successRate: 97.1 },
  { agent: "Report Generator", avgDurationMs: 4780, p95DurationMs: 8200, successRate: 98.9 },
  { agent: "Validation", avgDurationMs: 2960, p95DurationMs: 5100, successRate: 95.6 },
];

export const MOCK_PLATFORM_KPI: PlatformKpiSnapshot = {
  totalRuns: 23,
  completedRuns: 20,
  failedRuns: 2,
  totalTokensConsumed: 718800,
  totalEstimatedCostUSD: 16.28,
  avgRunDurationSeconds: 847,
  p95RetrievalLatencyMs: 312,
  totalReportsPublished: 13,
  totalContradictionsResolved: 10,
  totalEvidenceChunks: 311,
};

// ── Sources (rag_m2.sources) ─────────────────────────────────────

export const MOCK_SOURCES: SourceRecord[] = [
  { id: "src_v4.1", projectId: "proj_intel_001", title: "Fast Inference from Transformers via Speculative Decoding", url: "https://arxiv.org/abs/2211.17192", publisher: "arXiv (Leviathan et al.)", sourceType: "academic", publishedAt: "2023-05-18T00:00:00Z", retrievedAt: "2026-09-25T11:04:12Z", authorityLevel: 0.9, freshness: 0.42, publisherReputation: 0.85, versions: 2, chunks: 38, citedIn: 2, snapshotHash: "c7f2a19e4b8d03e6f1a2b5c8d9e0f7a6b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8" },
  { id: "src_v5.2", projectId: "proj_intel_001", title: "NVIDIA Blackwell Architecture Whitepaper", url: "https://nvidia.com/blackwell-architecture-spec.pdf", publisher: "NVIDIA", sourceType: "industry", publishedAt: "2026-03-18T00:00:00Z", retrievedAt: "2026-09-25T11:05:40Z", authorityLevel: 0.6, freshness: 0.71, publisherReputation: 0.55, versions: 3, chunks: 112, citedIn: 1, snapshotHash: "a1b2c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff" },
  { id: "src_v3.2", projectId: "proj_intel_001", title: "Accelerating LLM Inference with Speculative Sampling", url: "https://arxiv.org/abs/2302.01318", publisher: "arXiv (Chen et al.)", sourceType: "academic", publishedAt: "2023-02-02T00:00:00Z", retrievedAt: "2026-09-25T11:07:02Z", authorityLevel: 0.9, freshness: 0.38, publisherReputation: 0.85, versions: 1, chunks: 24, citedIn: 1, snapshotHash: "0f9e8d7c6b5a49382716051f2e3d4c5b6a7980112233445566778899aabbccdd" },
  { id: "src_v6.0", projectId: "proj_intel_001", title: "MLCommons Inference v4.1 Technical Results", url: "https://mlcommons.org/inference-v41-results", publisher: "MLCommons", sourceType: "industry", publishedAt: "2026-08-28T00:00:00Z", retrievedAt: "2026-09-25T11:08:31Z", authorityLevel: 0.6, freshness: 0.94, publisherReputation: 0.55, versions: 1, chunks: 57, citedIn: 1, snapshotHash: "5e4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a99887766554433221100f" },
  { id: "src_v7.1", projectId: "proj_intel_001", title: "Hardware Telemetry Audit: GPU Memory Subsystem Saturation", url: "https://internal-telemetry.corp.net/audits/gpu-mem-sxm5", publisher: "Internal telemetry", sourceType: "internal", publishedAt: "2026-09-10T00:00:00Z", retrievedAt: "2026-09-25T11:10:15Z", authorityLevel: 0.6, freshness: 0.69, publisherReputation: 0.55, versions: 4, chunks: 19, citedIn: 1, snapshotHash: "9a8b7c6d5e4f30211203f4e5d6c7b8a9908172635445362718090a0b0c0d0e0f" },
  { id: "src_doe_ai", projectId: "proj_intel_001", title: "Measuring Energy per Token on Shared Clusters", url: "https://www.energy.gov/eere/ai-energy", publisher: "U.S. Department of Energy", sourceType: "government", publishedAt: "2026-06-30T00:00:00Z", retrievedAt: "2026-09-25T11:06:05Z", authorityLevel: 0.9, freshness: 0.12, publisherReputation: 0.85, versions: 1, chunks: 41, citedIn: 0, snapshotHash: "1122334455667788990011223344556677889900aabbccddeeff001122334455" },
  { id: "src_irds_v2", projectId: "proj_semicon_002", title: "IEEE IRDS: Lithography Roadmap 2026", url: "https://irds.ieee.org/editions/2026/lithography", publisher: "IEEE", sourceType: "academic", publishedAt: "2026-04-15T00:00:00Z", retrievedAt: "2026-09-24T16:08:44Z", authorityLevel: 0.6, freshness: 0.25, publisherReputation: 0.55, versions: 2, chunks: 66, citedIn: 1, snapshotHash: "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100" },
  { id: "src_commerce_v1", projectId: "proj_semicon_002", title: "Semiconductor Supply Chain Resilience Review", url: "https://www.commerce.gov/semiconductor-review", publisher: "U.S. Department of Commerce", sourceType: "government", publishedAt: "2026-01-20T00:00:00Z", retrievedAt: "2026-09-24T16:11:20Z", authorityLevel: 0.9, freshness: 0.06, publisherReputation: 0.85, versions: 1, chunks: 88, citedIn: 1, snapshotHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
  { id: "src_asml_ar", projectId: "proj_semicon_002", title: "ASML Annual Report: EUV and High-NA Shipments", url: "https://www.asml.com/en/investors/annual-report", publisher: "ASML", sourceType: "industry", publishedAt: "2026-02-11T00:00:00Z", retrievedAt: "2026-09-24T16:09:02Z", authorityLevel: 0.6, freshness: 0.08, publisherReputation: 0.55, versions: 1, chunks: 140, citedIn: 0, snapshotHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210" },
  { id: "src_analyst_n2", projectId: "proj_semicon_002", title: "Analyst Note: N2 Wafer Pricing and Ramp", url: "https://research.example.com/n2-pricing", publisher: "Sell-side research", sourceType: "web", publishedAt: "2026-09-02T00:00:00Z", retrievedAt: "2026-09-24T16:10:31Z", authorityLevel: 0.6, freshness: 0.6, publisherReputation: 0.55, versions: 1, chunks: 9, citedIn: 0, snapshotHash: "13579bdf2468ace013579bdf2468ace013579bdf2468ace013579bdf2468ace0" },
];

// ── Schedules ────────────────────────────────────────────────────

export const MOCK_SCHEDULES: ResearchSchedule[] = [
  {
    id: "sch_001",
    projectId: "proj_intel_001",
    name: "Weekly inference pricing check",
    questionText: "How have managed-API prices per million tokens changed for frontier and mid-tier models this week?",
    frequency: "weekly",
    dayOfWeek: 1,
    time: "09:00",
    timezone: "Asia/Karachi",
    enabled: true,
    skipIfRunning: true,
    createdBy: "Muhammad Shoaib",
    lastRunAt: "2026-09-22T04:00:00Z",
    lastRunId: "run_8b1e3d",
    lastOutcome: "COMPLETED",
  },
  {
    id: "sch_002",
    projectId: "proj_intel_001",
    name: "Daily retrieval benchmark digest",
    questionText: "Summarise new retrieval and reranking benchmarks published in the last 24 hours.",
    frequency: "weekdays",
    time: "07:30",
    timezone: "Europe/London",
    enabled: true,
    skipIfRunning: true,
    createdBy: "Abdullah Malik",
    lastRunAt: "2026-09-25T06:30:00Z",
    lastOutcome: "SKIPPED_DUPLICATE",
  },
  {
    id: "sch_003",
    projectId: "proj_semicon_002",
    name: "Monthly export-control review",
    questionText: "What changed in semiconductor export-control rules and enforcement this month, by jurisdiction?",
    frequency: "monthly",
    dayOfMonth: 1,
    time: "10:00",
    timezone: "America/New_York",
    enabled: false,
    skipIfRunning: true,
    createdBy: "Muhammad Shoaib",
    lastRunAt: "2026-09-01T14:00:00Z",
    lastRunId: "run_5e8b1a",
    lastOutcome: "FAILED",
  },
];

// ── Prompt registry (agents/prompts/registry.py) ─────────────────

export const MOCK_PROMPTS: PromptVersion[] = [
  { promptId: "planner_decompose", version: "v1.0", status: "ACTIVE", template: "Decompose the research question: '{question}'. Project context: {context}", variables: ["question", "context"], createdBy: "system", createdAt: "2026-09-18T09:00:00Z" },
  { promptId: "planner_decompose", version: "v1.1", status: "DRAFT", template: "Decompose the research question: '{question}' into 3–7 tasks. For each, name the evidence category it needs. Project context: {context}", variables: ["question", "context"], createdBy: "Talha Rehman", createdAt: "2026-09-24T15:20:00Z" },
  { promptId: "evidence_extract", version: "v1.0", status: "ACTIVE", template: "Extract empirical evidence supporting claims from chunks:\n{chunks}\nDraft claims:\n{claims}", variables: ["chunks", "claims"], createdBy: "system", createdAt: "2026-09-18T09:00:00Z" },
  { promptId: "contradiction_classify", version: "v0.9", status: "DEPRECATED", template: "Do these claims conflict? 1: '{claim1}' 2: '{claim2}'", variables: ["claim1", "claim2"], createdBy: "system", createdAt: "2026-09-10T09:00:00Z" },
  { promptId: "contradiction_classify", version: "v1.0", status: "ACTIVE", template: "Analyze potential conflicts between Claim 1: '{claim1}' and Claim 2: '{claim2}'", variables: ["claim1", "claim2"], createdBy: "system", createdAt: "2026-09-18T09:00:00Z" },
  { promptId: "report_synthesize", version: "v1.0", status: "ACTIVE", template: "Write report sections from the analysis below. Every factual sentence must cite evidence ids.\n{analysis}", variables: ["analysis"], createdBy: "system", createdAt: "2026-09-18T09:00:00Z" },
];

// ── Model registry (agents/routing/configs.py) ───────────────────

export const MOCK_MODELS: ModelConfig[] = [
  { modelId: "gemini-1.5-pro-v1", name: "Gemini 1.5 Pro", provider: "google", version: "1.5-pro-002", qualityTier: "frontier", contextWindow: 1_000_000, costPer1kTokens: 0.0035, p95LatencyMs: 1200, supportedTaskTypes: ["planning", "synthesis", "analysis", "report"], isActive: true },
  { modelId: "gemini-1.5-flash-v1", name: "Gemini 1.5 Flash", provider: "google", version: "1.5-flash-002", qualityTier: "high", contextWindow: 1_000_000, costPer1kTokens: 0.00035, p95LatencyMs: 450, supportedTaskTypes: ["discovery", "retrieval", "extraction", "classification"], isActive: true },
  { modelId: "gpt-4o-v1", name: "GPT-4o", provider: "openai", version: "2024-08-06", qualityTier: "frontier", contextWindow: 128_000, costPer1kTokens: 0.005, p95LatencyMs: 1100, supportedTaskTypes: ["planning", "synthesis", "analysis", "report"], isActive: true },
  { modelId: "gpt-4o-mini-v1", name: "GPT-4o Mini", provider: "openai", version: "2024-07-18", qualityTier: "high", contextWindow: 128_000, costPer1kTokens: 0.0006, p95LatencyMs: 400, supportedTaskTypes: ["discovery", "extraction", "classification"], isActive: true },
  { modelId: "claude-3-5-sonnet-v1", name: "Claude 3.5 Sonnet", provider: "anthropic", version: "20240620", qualityTier: "frontier", contextWindow: 200_000, costPer1kTokens: 0.006, p95LatencyMs: 1400, supportedTaskTypes: ["synthesis", "analysis", "report"], isActive: true },
];

// ── Quality gates (agents/evaluation/config.py, rag/evaluation) ──

export const MOCK_QUALITY_GATES: QualityGate[] = [
  { key: "retrieval_recall_at_10", group: "Retrieval", label: "Recall@10", threshold: 0.85, measured: 0.881, direction: "min", owner: "M2", history: [0.84, 0.856, 0.87, 0.866, 0.881] },
  { key: "retrieval_precision_at_10", group: "Retrieval", label: "Precision@10", threshold: 0.75, measured: 0.772, direction: "min", owner: "M2", history: [0.71, 0.74, 0.76, 0.768, 0.772] },
  { key: "retrieval_mrr", group: "Retrieval", label: "Mean reciprocal rank", threshold: 0.7, measured: 0.734, direction: "min", owner: "M2", history: [0.69, 0.71, 0.72, 0.73, 0.734] },
  { key: "evidence_attribution_accuracy", group: "Evidence", label: "Attribution accuracy", threshold: 0.95, measured: 0.962, direction: "min", owner: "M2", history: [0.94, 0.951, 0.955, 0.96, 0.962] },
  { key: "evidence_completeness", group: "Evidence", label: "Completeness", threshold: 0.9, measured: 0.887, direction: "min", owner: "M2", history: [0.91, 0.905, 0.896, 0.891, 0.887] },
  { key: "citation_correctness", group: "Evidence", label: "Citation correctness", threshold: 0.98, measured: 0.991, direction: "min", owner: "M2", history: [0.982, 0.985, 0.989, 0.99, 0.991] },
  { key: "supported_claim_rate", group: "Generation", label: "Supported claim rate", threshold: 0.97, measured: 0.974, direction: "min", owner: "M1", history: [0.962, 0.968, 0.971, 0.973, 0.974] },
  { key: "unsupported_claim_rate", group: "Generation", label: "Unsupported claim rate", threshold: 0.03, measured: 0.026, direction: "max", owner: "M1", history: [0.038, 0.032, 0.029, 0.027, 0.026] },
  { key: "citation_coverage", group: "Generation", label: "Citation coverage", threshold: 0.95, measured: 0.958, direction: "min", owner: "M1", history: [0.94, 0.948, 0.952, 0.955, 0.958] },
  { key: "contradiction_precision", group: "Contradictions", label: "Precision", threshold: 0.8, measured: 0.842, direction: "min", owner: "M1", history: [0.8, 0.81, 0.83, 0.838, 0.842] },
  { key: "contradiction_recall", group: "Contradictions", label: "Recall", threshold: 0.8, measured: 0.806, direction: "min", owner: "M1", history: [0.78, 0.79, 0.801, 0.803, 0.806] },
  { key: "contradiction_f1", group: "Contradictions", label: "F1", threshold: 0.8, measured: 0.823, direction: "min", owner: "M1", history: [0.79, 0.8, 0.815, 0.82, 0.823] },
  { key: "system_completion_rate", group: "System", label: "Completion rate", threshold: 0.98, measured: 0.981, direction: "min", owner: "M1", history: [0.97, 0.975, 0.979, 0.98, 0.981] },
  { key: "system_failure_rate", group: "System", label: "Failure rate", threshold: 0.02, measured: 0.019, direction: "max", owner: "M1", history: [0.03, 0.025, 0.021, 0.02, 0.019] },
];

export const MOCK_GOLDEN_SAMPLES: GoldenSample[] = [
  { id: "gold-sample-001", question: "What is the economic impact of autonomous AI agents on corporate research productivity?", expectedClaims: 2, expectedCitations: 2, expectedContradictions: ["NUMERIC_CONFLICT"] },
  { id: "gold-sample-002", question: "How do deterministic verification checks compare with LLM self-critique for catching unsupported claims?", expectedClaims: 3, expectedCitations: 3, expectedContradictions: ["METHODOLOGY_DIFFERENCE"] },
  { id: "gold-sample-003", question: "Does hybrid retrieval improve citation accuracy over dense-only retrieval for technical documents?", expectedClaims: 2, expectedCitations: 3, expectedContradictions: [] },
];
