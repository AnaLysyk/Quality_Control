import "server-only";

import type { AuthUser } from "@/lib/jwtAuth";

/**
 * Test Data Hub Security Guardrails
 *
 * Enforce critical security rules:
 * 1. PromptDataGuardrail — AI never receives raw sensitive content
 * 2. GitHubPublishGuardrail — Prevent committing sensitive data to GitHub
 * 3. RunnerAssetGuardrail — Validate permissions before asset resolution
 */

export type SensitivityLevel = "public" | "internal" | "restricted" | "sensitive";
export type AssetEncoding = "file" | "base64" | "json" | "text";

/**
 * Guardrail Error — thrown when security rule is violated
 */
export class GuardrailViolation extends Error {
  constructor(
    public guardrailName: "PromptDataGuardrail" | "GitHubPublishGuardrail" | "RunnerAssetGuardrail",
    message: string,
  ) {
    super(message);
    this.name = "GuardrailViolation";
  }
}

/**
 * PromptDataGuardrail
 *
 * Ensures AI/LLM never receives raw sensitive content.
 * AI gets only:
 * - assetId
 * - label
 * - assetType
 * - mimeType
 * - sensitivity
 * - usage intent
 *
 * AI never gets:
 * - base64Value (raw)
 * - file content (raw)
 * - actual biometric data
 * - actual PDF/document content
 */
export class PromptDataGuardrail {
  static validateAssetForPrompt(
    asset: {
      id: string;
      key: string;
      label: string;
      assetType: string;
      mimeType?: string | null;
      sensitivity: SensitivityLevel;
      base64Value?: string | null;
      storagePath?: string | null;
    },
    options?: {
      includeSensitiveMetadata?: boolean;
    },
  ): {
    assetId: string;
    key: string;
    label: string;
    assetType: string;
    mimeType?: string | null;
    sensitivity: SensitivityLevel;
  } {
    // Never include actual content
    if (asset.base64Value && asset.sensitivity !== "public") {
      throw new GuardrailViolation("PromptDataGuardrail", `Cannot send ${asset.sensitivity} asset Base64 to prompt`);
    }

    if (asset.storagePath && asset.sensitivity !== "public") {
      throw new GuardrailViolation("PromptDataGuardrail", `Cannot reference ${asset.sensitivity} asset file path in prompt`);
    }

    // Return safe metadata only
    return {
      assetId: asset.id,
      key: asset.key,
      label: asset.label,
      assetType: asset.assetType,
      mimeType: asset.mimeType,
      sensitivity: asset.sensitivity,
    };
  }

  static validateAssetsForCodeGeneration(
    assets: Array<{
      id: string;
      key: string;
      assetType: string;
      sensitivity: SensitivityLevel;
      base64Value?: string | null;
    }>,
  ): string {
    // Check each asset
    for (const asset of assets) {
      if (asset.sensitivity !== "public" && asset.base64Value) {
        throw new GuardrailViolation(
          "PromptDataGuardrail",
          `Sensitive asset ${asset.key} contains Base64 — cannot generate code with inline data`,
        );
      }
    }

    return "OK";
  }
}

/**
 * GitHubPublishGuardrail
 *
 * Prevents committing sensitive data to GitHub.
 * Checks for:
 * - Base64 data in test files
 * - data:image URIs
 * - Asset file paths in code
 * - Temporary download URLs with tokens
 * - storage paths
 * - Sensitive content indicators
 */
export class GitHubPublishGuardrail {
  // Patterns that indicate sensitive data
  private static readonly SENSITIVE_PATTERNS = [
    /base64['\"]?\s*[:=]\s*['\"][^'\"]{100,}/, // Long Base64 string
    /data:image\/[^;]+;base64,/, // data:image URI
    /asset.*['\"].*base64/, // Reference to Base64 content
    /download.*expires.*token/, // Temporary download URL pattern
    /storagePath.*['\"][^'\"]+/, // Storage path reference
    /biometri[a-z]*.*=.*buffer/i, // Biometric buffer assignment
  ];

  static validateCodeBeforePublish(
    code: string,
    context?: {
      filePath?: string;
      assetIds?: string[];
    },
  ): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check for sensitive patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(code)) {
        violations.push(`Detected sensitive data pattern: ${pattern.source}`);
      }
    }

    // Check for asset IDs (these are OK, we want them)
    const assetIdPattern = /asset_[a-z0-9_]+/gi;
    const assetIds = code.match(assetIdPattern) || [];

    if (assetIds.length > 0) {
      // Asset IDs should be used with fixture, not inline
      const inlineBase64Check = assetIds.filter((id) => {
        // Check if this asset ID is followed by "base64Value" or similar
        const afterId = code.substring(code.indexOf(id) + id.length, code.indexOf(id) + id.length + 100);
        return /base64|buffer|data:/i.test(afterId);
      });

      if (inlineBase64Check.length > 0) {
        violations.push("Asset IDs should not be followed by inline content (base64/buffer/data)");
      }
    }

    return {
      safe: violations.length === 0,
      violations,
    };
  }

  static throwIfUnsafe(
    code: string,
    context?: {
      filePath?: string;
      assetIds?: string[];
    },
  ): void {
    const result = this.validateCodeBeforePublish(code, context);

    if (!result.safe) {
      throw new GuardrailViolation(
        "GitHubPublishGuardrail",
        `Cannot publish code with sensitive data. Violations:\n${result.violations.join("\n")}`,
      );
    }
  }
}

/**
 * RunnerAssetGuardrail
 *
 * Validates that test runner has permission and valid context
 * before resolving asset.
 */
export class RunnerAssetGuardrail {
  static validateResolutionContext(context: {
    user: AuthUser | null;
    companySlug: string;
    projectId?: string | null;
    assetId: string;
    assetSensitivity: SensitivityLevel;
    purpose: "playwright" | "test_execution" | "documentation";
  }): { valid: boolean; reason?: string } {
    // Must be authenticated
    if (!context.user) {
      return { valid: false, reason: "User not authenticated" };
    }

    // Check company access
    const companySlugs = Array.isArray(context.user.companySlugs)
      ? context.user.companySlugs
      : [context.user.companySlug].filter(Boolean);

    if (!companySlugs.includes(context.companySlug)) {
      return { valid: false, reason: "No access to this company" };
    }

    // Check sensitivity access
    const maxSensitivity = this.getMaxSensitivity(context.user);
    const levels: SensitivityLevel[] = ["public", "internal", "restricted", "sensitive"];
    const maxIndex = levels.indexOf(maxSensitivity);
    const assetIndex = levels.indexOf(context.assetSensitivity);

    if (assetIndex > maxIndex) {
      return { valid: false, reason: `Sensitivity level ${context.assetSensitivity} not allowed for your role` };
    }

    // Check purpose validity
    if (!["playwright", "test_execution", "documentation"].includes(context.purpose)) {
      return { valid: false, reason: "Invalid purpose" };
    }

    return { valid: true };
  }

  static throwIfInvalid(context: {
    user: AuthUser | null;
    companySlug: string;
    projectId?: string | null;
    assetId: string;
    assetSensitivity: SensitivityLevel;
    purpose: "playwright" | "test_execution" | "documentation";
  }): void {
    const result = this.validateResolutionContext(context);

    if (!result.valid) {
      throw new GuardrailViolation("RunnerAssetGuardrail", result.reason || "Resolution context invalid");
    }
  }

  private static getMaxSensitivity(user: AuthUser | null): SensitivityLevel {
    if (!user) return "public";
    if (user.isGlobalAdmin) return "sensitive";

    const role = user.role || user.companyRole || user.globalRole || "";

    if (["admin", "company_admin", "leader_tc", "technical_support"].includes(role)) {
      return "restricted";
    }

    if (["support", "it_dev", "dev"].includes(role)) {
      return "internal";
    }

    return "public";
  }
}

/**
 * Asset Usage Policy Validation
 *
 * Checks if an operation violates the asset's usage policy.
 */
export interface AssetUsagePolicy {
  allowPlaywrightUpload?: boolean;
  allowApiMultipart?: boolean;
  allowBase64Api?: boolean;
  allowPromptMetadata?: boolean;
  allowPromptContent?: boolean;
  allowGithubCommit?: boolean;
  allowReportMetadata?: boolean;
  allowReportContent?: boolean;
}

export class UsagePolicyValidator {
  static validateUsage(
    policy: AssetUsagePolicy | null | undefined,
    usage: "playwright_upload" | "api_multipart" | "api_base64" | "prompt_metadata" | "prompt_content" | "github_commit" | "report_metadata" | "report_content",
  ): { allowed: boolean; reason?: string } {
    if (!policy) {
      // No policy = allow standard usage
      const restrictedUsage = ["api_base64", "prompt_content", "github_commit", "report_content"];
      if (restrictedUsage.includes(usage)) {
        return { allowed: false, reason: "No policy defined for this usage" };
      }
      return { allowed: true };
    }

    const checks: Record<string, boolean | undefined> = {
      playwright_upload: policy.allowPlaywrightUpload,
      api_multipart: policy.allowApiMultipart,
      api_base64: policy.allowBase64Api,
      prompt_metadata: policy.allowPromptMetadata,
      prompt_content: policy.allowPromptContent,
      github_commit: policy.allowGithubCommit,
      report_metadata: policy.allowReportMetadata,
      report_content: policy.allowReportContent,
    };

    const allowed = checks[usage] !== false;

    return {
      allowed,
      reason: allowed ? undefined : `Usage "${usage}" not allowed by policy`,
    };
  }

  static throwIfNotAllowed(
    policy: AssetUsagePolicy | null | undefined,
    usage: "playwright_upload" | "api_multipart" | "api_base64" | "prompt_metadata" | "prompt_content" | "github_commit" | "report_metadata" | "report_content",
  ): void {
    const result = this.validateUsage(policy, usage);

    if (!result.allowed) {
      throw new GuardrailViolation("RunnerAssetGuardrail", result.reason || "Usage not allowed by policy");
    }
  }
}
