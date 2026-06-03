import { createJobPosting, createJobSource, type JobPosting } from "./contract";
import { JobScoutProfileSchema, type JobScoutProfile } from "./ranking";

export const DEFAULT_JOB_SCOUT_PROFILE_ID =
  "job-scout-profile:fixture" as const;

export function buildDefaultJobScoutProfile(): JobScoutProfile {
  return JobScoutProfileSchema.parse({
    profile_id: DEFAULT_JOB_SCOUT_PROFILE_ID,
    cybersecurity_interest: 0.92,
    ai_ml_interest: 0.95,
    graduate_role_preference: 0.96,
    remote_preference: 0.82,
    uk_preference: 0.94,
    salary_expectation: {
      currency: "GBP",
      min_amount: 32000,
      max_amount: null,
      period: "year",
      disclosed: true,
    },
    skill_tags: [
      "ai",
      "applied-ai",
      "cybersecurity",
      "python",
      "typescript",
      "ml",
      "security",
      "llm",
      "cloud",
    ],
    preferred_role_tags: [
      "ai",
      "security",
      "ml-infrastructure",
      "applied-ai",
      "cybersecurity",
    ],
    preferred_work_modes: ["remote", "hybrid", "flexible"],
    preferred_location_types: ["uk", "global"],
    metadata_only: true,
  });
}

export function buildFixtureJobPostings(): JobPosting[] {
  const greenhouse = createJobSource({
    source_id: "source:greenhouse",
    source_type: "greenhouse",
    display_name: "Greenhouse",
    base_url: "https://boards.greenhouse.io",
    live_integration_supported: false,
    scraping_supported: false,
    api_call_supported: false,
  });
  const linkedin = createJobSource({
    source_id: "source:linkedin",
    source_type: "linkedin",
    display_name: "LinkedIn",
    base_url: "https://www.linkedin.com/jobs",
    live_integration_supported: false,
    scraping_supported: false,
    api_call_supported: false,
  });
  const lever = createJobSource({
    source_id: "source:lever",
    source_type: "lever",
    display_name: "Lever",
    base_url: "https://jobs.lever.co",
    live_integration_supported: false,
    scraping_supported: false,
    api_call_supported: false,
  });

  return [
    createJobPosting({
      posting_id: "job:applied-ai-security-graduate",
      title: "Graduate Applied AI Security Engineer",
      company: {
        company_id: "company:sentinel-ai",
        name: "Sentinel AI Labs",
        domain: "sentinel.example",
        size_band: "scaleup",
      },
      location_label: "London, UK",
      location_type: "uk",
      work_mode: "hybrid",
      role_level: "graduate",
      salary: {
        currency: "GBP",
        min_amount: 38000,
        max_amount: 45000,
        period: "year",
        disclosed: true,
      },
      source: greenhouse,
      url: "https://boards.greenhouse.io/sentinel/jobs/applied-ai-security-graduate",
      tags: ["ai", "applied-ai", "security", "cybersecurity"],
      posted_at: "2026-06-01T09:00:00.000Z",
      requirements: {
        required_skill_tags: ["python", "security", "ai"],
        preferred_skill_tags: ["typescript", "llm", "cloud"],
        years_experience_min: 0,
        degree_required: false,
        sponsorship_available: null,
        graduate_friendly: true,
      },
      metadata: metadata(),
    }),
    createJobPosting({
      posting_id: "job:ml-infra-junior",
      title: "Junior ML Infrastructure Engineer",
      company: {
        company_id: "company:vectorworks",
        name: "VectorWorks Systems",
        domain: "vectorworks.example",
        size_band: "enterprise",
      },
      location_label: "Remote UK",
      location_type: "uk",
      work_mode: "remote",
      role_level: "junior",
      salary: {
        currency: "GBP",
        min_amount: 35000,
        max_amount: 42000,
        period: "year",
        disclosed: true,
      },
      source: lever,
      url: "https://jobs.lever.co/vectorworks/ml-infra-junior",
      tags: ["ml", "ml-infrastructure", "cloud"],
      posted_at: "2026-05-30T09:00:00.000Z",
      requirements: {
        required_skill_tags: ["python", "cloud", "kubernetes"],
        preferred_skill_tags: ["ml", "typescript"],
        years_experience_min: 1,
        degree_required: false,
        sponsorship_available: null,
        graduate_friendly: true,
      },
      metadata: metadata(),
    }),
    createJobPosting({
      posting_id: "job:senior-frontend-onsite",
      title: "Senior Frontend Engineer",
      company: {
        company_id: "company:retail-platform",
        name: "Retail Platform Group",
        domain: "retail.example",
        size_band: "enterprise",
      },
      location_label: "New York, US",
      location_type: "us",
      work_mode: "onsite",
      role_level: "senior",
      salary: {
        currency: "USD",
        min_amount: 120000,
        max_amount: 150000,
        period: "year",
        disclosed: true,
      },
      source: linkedin,
      url: "https://www.linkedin.com/jobs/view/senior-frontend-engineer",
      tags: ["frontend", "react"],
      posted_at: "2026-06-02T09:00:00.000Z",
      requirements: {
        required_skill_tags: ["react", "frontend", "design-systems"],
        preferred_skill_tags: ["typescript"],
        years_experience_min: 5,
        degree_required: false,
        sponsorship_available: false,
        graduate_friendly: false,
      },
      metadata: metadata(),
    }),
  ];
}

function metadata() {
  return {
    metadata_only: true,
    raw_description_included: false,
    application_submission_supported: false,
    scraping_attempted: false,
    network_call_attempted: false,
    provider_call_attempted: false,
    automation_attempted: false,
  } as const;
}
