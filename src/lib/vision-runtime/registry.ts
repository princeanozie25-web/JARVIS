import type { VisionCapability } from "./contracts";
import {
  createFakeMockCameraProvider,
  createFakeObjectDetectionProvider,
  createFakeOcrProvider,
} from "./fake-providers";
import {
  isVisionProviderCapabilityAllowed,
  type VisionProvider,
  type VisionProviderAdmissionOptions,
} from "./provider";

export type VisionProviderRegistryResult =
  | {
      readonly ok: true;
      readonly registry: VisionProviderRegistry;
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly registry: null;
      readonly reason:
        | "duplicate_provider_id"
        | "forbidden_provider_capability"
        | "no_provider_for_capability";
      readonly provider_id: string | null;
      readonly capability: VisionCapability | null;
      readonly metadata_only: true;
    };

export class VisionProviderRegistry {
  private readonly providersById = new Map<string, VisionProvider>();
  private readonly providerIdsByCapability = new Map<
    VisionCapability,
    string[]
  >();

  readonly metadata_only = true;

  static createFakeOnly(): VisionProviderRegistryResult {
    return createVisionProviderRegistry([
      createFakeOcrProvider(),
      createFakeObjectDetectionProvider(),
      createFakeMockCameraProvider(),
    ]);
  }

  // 23F: optional registration-time admission carries the consent-loader
  // verdict for real_camera; omitted, rejection is identical to the
  // historical default (same reason codes).
  register(
    provider: VisionProvider,
    admission?: VisionProviderAdmissionOptions,
  ): VisionProviderRegistryResult {
    if (this.providersById.has(provider.id)) {
      return registryError(
        "duplicate_provider_id",
        provider.id,
        provider.supported_capability,
      );
    }
    if (!isVisionProviderCapabilityAllowed(provider, admission)) {
      return registryError(
        "forbidden_provider_capability",
        provider.id,
        provider.supported_capability,
      );
    }

    this.providersById.set(provider.id, provider);
    const existing =
      this.providerIdsByCapability.get(provider.supported_capability) ?? [];
    this.providerIdsByCapability.set(provider.supported_capability, [
      ...existing,
      provider.id,
    ]);

    return {
      ok: true,
      registry: this,
      metadata_only: true,
    };
  }

  getProviderByCapability(capability: VisionCapability): VisionProvider | null {
    const providerId = this.providerIdsByCapability.get(capability)?.[0];
    return providerId ? (this.providersById.get(providerId) ?? null) : null;
  }

  requireProviderByCapability(
    capability: VisionCapability,
  ): VisionProvider | VisionProviderRegistryResult {
    const provider = this.getProviderByCapability(capability);
    return (
      provider ?? registryError("no_provider_for_capability", null, capability)
    );
  }

  listProviders(): readonly VisionProvider[] {
    return [...this.providersById.values()];
  }
}

export function createVisionProviderRegistry(
  providers: readonly VisionProvider[] = [],
): VisionProviderRegistryResult {
  const registry = new VisionProviderRegistry();
  for (const provider of providers) {
    const result = registry.register(provider);
    if (!result.ok) return result;
  }
  return {
    ok: true,
    registry,
    metadata_only: true,
  };
}

function registryError(
  reason: Exclude<VisionProviderRegistryResult, { ok: true }>["reason"],
  providerId: string | null,
  capability: VisionCapability | null,
): VisionProviderRegistryResult {
  return {
    ok: false,
    registry: null,
    reason,
    provider_id: providerId,
    capability,
    metadata_only: true,
  };
}
