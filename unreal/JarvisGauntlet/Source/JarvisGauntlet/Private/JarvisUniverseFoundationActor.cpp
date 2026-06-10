// Copyright Epic Games, Inc. All Rights Reserved.

#include "JarvisUniverseFoundationActor.h"

#include "Camera/CameraComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr int32 AnchorCount = 3;
	const FVector VoidCameraLocation(0.0f, -520000.0f, 95000.0f);
	const FVector VoidCameraTarget(0.0f, 1200000.0f, -190000.0f);

	FName AnchorComponentName(int32 Index)
	{
		return FName(*FString::Printf(TEXT("VoidEdgeReference_%d"), Index));
	}

	FName NebulaComponentName(int32 Index)
	{
		static const FName ComponentNames[] = {
			TEXT("GAUNTLET_Void_Nebula_Edge_A"),
			TEXT("GAUNTLET_Void_Nebula_Edge_B"),
			TEXT("GAUNTLET_Void_Nebula_Edge_C"),
		};

		return ComponentNames[Index];
	}

	FName FogSheetComponentName(int32 Index)
	{
		static const FName ComponentNames[] = {
			TEXT("GAUNTLET_Void_Nebula_Fog_A"),
			TEXT("GAUNTLET_Void_Nebula_Fog_B"),
			TEXT("GAUNTLET_Void_Nebula_Fog_C"),
		};

		return ComponentNames[Index];
	}
}

AJarvisUniverseFoundationActor::AJarvisUniverseFoundationActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = true;

	UniverseName = TEXT("Universe_01");
	bReadOnlyVisual = true;
	GalaxyAnchorDistance = 900000.0f;
	bShowDomainLabels = false;
	StarCount = 26000;
	StarfieldRadius = 500000.0f;
	NebulaWispCount = 7200;
	LivingVoidTimeSeconds = 0.0f;

	UniverseRoot = CreateDefaultSubobject<USceneComponent>(TEXT("UniverseRoot"));
	SetRootComponent(UniverseRoot);

	StarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Starfield_Mid"));
	StarfieldInstances->SetupAttachment(UniverseRoot);
	StarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	NearStarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Starfield_Near"));
	NearStarfieldInstances->SetupAttachment(UniverseRoot);
	NearStarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	WarmStarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Starfield_Far_Warm"));
	WarmStarfieldInstances->SetupAttachment(UniverseRoot);
	WarmStarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	WhiteStarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Starfield_Far"));
	WhiteStarfieldInstances->SetupAttachment(UniverseRoot);
	WhiteStarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	UltraFarStarfieldInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Starfield_UltraFar"));
	UltraFarStarfieldInstances->SetupAttachment(UniverseRoot);
	UltraFarStarfieldInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	NearDustInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Dust_Near"));
	NearDustInstances->SetupAttachment(UniverseRoot);
	NearDustInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	BrightStarFlareInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Bright_Flares"));
	BrightStarFlareInstances->SetupAttachment(UniverseRoot);
	BrightStarFlareInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	GalaxyAnchorInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_Nebula_Core_Knots"));
	GalaxyAnchorInstances->SetupAttachment(UniverseRoot);
	GalaxyAnchorInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	NebulaWispInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("GAUNTLET_Void_MicroFilaments"));
	NebulaWispInstances->SetupAttachment(UniverseRoot);
	NebulaWispInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		UInstancedStaticMeshComponent* DomainNebula = CreateDefaultSubobject<UInstancedStaticMeshComponent>(NebulaComponentName(Index));
		DomainNebula->SetupAttachment(UniverseRoot);
		DomainNebula->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		DomainNebulaInstances.Add(DomainNebula);

		UInstancedStaticMeshComponent* FogSheet = CreateDefaultSubobject<UInstancedStaticMeshComponent>(FogSheetComponentName(Index));
		FogSheet->SetupAttachment(UniverseRoot);
		FogSheet->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		DomainFogSheetInstances.Add(FogSheet);
	}

	CommandGridInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("SubtleCommandGrid"));
	CommandGridInstances->SetupAttachment(UniverseRoot);
	CommandGridInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	CoreBeamInstances = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("CentralEnergyAxis"));
	CoreBeamInstances->SetupAttachment(UniverseRoot);
	CoreBeamInstances->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	HumanGateReserveMarker = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HumanGateReserveMarker"));
	HumanGateReserveMarker->SetupAttachment(UniverseRoot);
	HumanGateReserveMarker->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HumanGateReserveMarker->SetRelativeScale3D(FVector(6.0f));
	HumanGateReserveMarker->SetVisibility(false);
	HumanGateReserveMarker->SetHiddenInGame(true);

	HumanGateReserveLabel = CreateDefaultSubobject<UTextRenderComponent>(TEXT("HumanGateReserveLabel"));
	HumanGateReserveLabel->SetupAttachment(UniverseRoot);
	HumanGateReserveLabel->SetText(FText::FromString(TEXT("Human Gate Reserve")));
	HumanGateReserveLabel->SetHorizontalAlignment(EHTA_Center);
	HumanGateReserveLabel->SetTextRenderColor(FColor(120, 210, 255));
	HumanGateReserveLabel->SetWorldSize(1400.0f);
	HumanGateReserveLabel->SetRelativeLocation(FVector(0.0f, 0.0f, 2800.0f));
	HumanGateReserveLabel->SetRelativeRotation(FRotator(62.0f, 0.0f, 0.0f));
	HumanGateReserveLabel->SetVisibility(false);
	HumanGateReserveLabel->SetHiddenInGame(true);

	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		UTextRenderComponent* Label = CreateDefaultSubobject<UTextRenderComponent>(AnchorComponentName(Index));
		Label->SetupAttachment(UniverseRoot);
		Label->SetHorizontalAlignment(EHTA_Center);
		Label->SetTextRenderColor(FColor(150, 210, 255));
		Label->SetWorldSize(1800.0f);
		Label->SetVisibility(false);
		Label->SetHiddenInGame(true);
		GalaxyLabels.Add(Label);
	}

	OverviewCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("OverviewCamera"));
	OverviewCamera->SetupAttachment(UniverseRoot);
	OverviewCamera->SetRelativeLocation(FVector(0.0f, -188000.0f, 36000.0f));
	OverviewCamera->SetRelativeRotation(FRotator(-10.8f, 0.0f, 0.0f));
	OverviewCamera->SetFieldOfView(78.0f);

	ChamberLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("VoidScaleReferenceLight"));
	ChamberLight->SetupAttachment(UniverseRoot);
	ChamberLight->SetIntensity(0.0f);
	ChamberLight->SetAttenuationRadius(180000.0f);
	ChamberLight->SetUseInverseSquaredFalloff(false);
	ChamberLight->SetLightFalloffExponent(1.0f);
	ChamberLight->SetLightColor(FLinearColor(0.20f, 0.55f, 1.0f));

	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		UPointLightComponent* GalaxyLight = CreateDefaultSubobject<UPointLightComponent>(
			*FString::Printf(TEXT("GalaxyGlowLight_%d"), Index));
		GalaxyLight->SetupAttachment(UniverseRoot);
		GalaxyLight->SetIntensity(135000.0f);
		GalaxyLight->SetAttenuationRadius(62000.0f);
		GalaxyLight->SetUseInverseSquaredFalloff(false);
		GalaxyLight->SetLightFalloffExponent(1.0f);
		GalaxyLight->SetSourceRadius(900.0f);
		GalaxyLight->SetSoftSourceRadius(2400.0f);
		GalaxyGlowLights.Add(GalaxyLight);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMeshFinder(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMeshFinder.Succeeded())
	{
		SphereMesh = SphereMeshFinder.Object;
		StarfieldInstances->SetStaticMesh(SphereMesh);
		NearStarfieldInstances->SetStaticMesh(SphereMesh);
		WarmStarfieldInstances->SetStaticMesh(SphereMesh);
		WhiteStarfieldInstances->SetStaticMesh(SphereMesh);
		UltraFarStarfieldInstances->SetStaticMesh(SphereMesh);
		NearDustInstances->SetStaticMesh(SphereMesh);
		BrightStarFlareInstances->SetStaticMesh(SphereMesh);
		GalaxyAnchorInstances->SetStaticMesh(SphereMesh);
		NebulaWispInstances->SetStaticMesh(SphereMesh);
		for (UInstancedStaticMeshComponent* DomainNebula : DomainNebulaInstances)
		{
			DomainNebula->SetStaticMesh(SphereMesh);
		}
		HumanGateReserveMarker->SetStaticMesh(SphereMesh);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMeshFinder(TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (CubeMeshFinder.Succeeded())
	{
		CubeMesh = CubeMeshFinder.Object;
		BrightStarFlareInstances->SetStaticMesh(CubeMesh);
		CommandGridInstances->SetStaticMesh(CubeMesh);
		CoreBeamInstances->SetStaticMesh(CubeMesh);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> FogSheetMeshFinder(TEXT("/Engine/EngineVolumetrics/FogEnvironment/Mesh/S_EV_FogVolume_Sphere_01.S_EV_FogVolume_Sphere_01"));
	if (FogSheetMeshFinder.Succeeded())
	{
		FogSheetMesh = FogSheetMeshFinder.Object;
		for (UInstancedStaticMeshComponent* FogSheet : DomainFogSheetInstances)
		{
			FogSheet->SetStaticMesh(FogSheetMesh);
		}
	}

	static ConstructorHelpers::FObjectFinder<UMaterialInterface> EmissiveMaterialFinder(TEXT("/Engine/EngineMaterials/EmissiveMeshMaterial.EmissiveMeshMaterial"));
	if (EmissiveMaterialFinder.Succeeded())
	{
		EmissiveMaterial = EmissiveMaterialFinder.Object;
		EmissiveMaterial->CheckMaterialUsage_Concurrent(MATUSAGE_InstancedStaticMeshes);
		StarfieldInstances->SetMaterial(0, EmissiveMaterial);
	}

	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BasicShapeMaterialFinder(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (BasicShapeMaterialFinder.Succeeded())
	{
		BasicShapeMaterial = BasicShapeMaterialFinder.Object;
		BasicShapeMaterial->CheckMaterialUsage_Concurrent(MATUSAGE_InstancedStaticMeshes);
		StarfieldInstances->SetMaterial(0, BasicShapeMaterial);
		NearStarfieldInstances->SetMaterial(0, BasicShapeMaterial);
		WarmStarfieldInstances->SetMaterial(0, BasicShapeMaterial);
		WhiteStarfieldInstances->SetMaterial(0, BasicShapeMaterial);
		UltraFarStarfieldInstances->SetMaterial(0, BasicShapeMaterial);
		NearDustInstances->SetMaterial(0, BasicShapeMaterial);
		BrightStarFlareInstances->SetMaterial(0, BasicShapeMaterial);
		GalaxyAnchorInstances->SetMaterial(0, BasicShapeMaterial);
		NebulaWispInstances->SetMaterial(0, BasicShapeMaterial);
		for (UInstancedStaticMeshComponent* DomainNebula : DomainNebulaInstances)
		{
			DomainNebula->SetMaterial(0, BasicShapeMaterial);
		}
		CommandGridInstances->SetMaterial(0, BasicShapeMaterial);
		CoreBeamInstances->SetMaterial(0, BasicShapeMaterial);
		HumanGateReserveMarker->SetMaterial(0, BasicShapeMaterial);
	}

	static ConstructorHelpers::FObjectFinder<UMaterialInterface> FogSheetMaterialFinder(TEXT("/Engine/EngineVolumetrics/FogEnvironment/Materials/M_EV_FogEnvironment_Master_01.M_EV_FogEnvironment_Master_01"));
	if (FogSheetMaterialFinder.Succeeded())
	{
		FogSheetMaterial = FogSheetMaterialFinder.Object;
		FogSheetMaterial->CheckMaterialUsage_Concurrent(MATUSAGE_InstancedStaticMeshes);
		for (UInstancedStaticMeshComponent* FogSheet : DomainFogSheetInstances)
		{
			FogSheet->SetMaterial(0, FogSheetMaterial);
		}
	}

	ConfigureGalaxyAnchors();
	ConfigureLabels();
	ConfigureGalaxyGlowLights();
	ConfigureMaterials();
}

void AJarvisUniverseFoundationActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	LivingVoidTimeSeconds += DeltaSeconds;

	const float SlowDrift = LivingVoidTimeSeconds * 0.010f;
	for (int32 Index = 0; Index < DomainNebulaInstances.Num(); ++Index)
	{
		if (UInstancedStaticMeshComponent* DomainNebula = DomainNebulaInstances[Index])
		{
			DomainNebula->SetRelativeRotation(FRotator(SlowDrift * (Index + 1), SlowDrift * 2.0f, SlowDrift * -0.7f));
		}

		if (DomainFogSheetInstances.IsValidIndex(Index))
		{
			if (UInstancedStaticMeshComponent* FogSheet = DomainFogSheetInstances[Index])
			{
				FogSheet->SetRelativeRotation(FRotator(SlowDrift * -0.45f * (Index + 1), SlowDrift * 0.35f, SlowDrift * 0.9f));
			}
		}
	}

	if (NebulaWispInstances)
	{
		NebulaWispInstances->SetRelativeRotation(FRotator(SlowDrift * -0.4f, SlowDrift * 0.9f, 0.0f));
	}

	if (NearDustInstances)
	{
		NearDustInstances->SetRelativeLocation(FVector(
			FMath::Sin(LivingVoidTimeSeconds * 0.019f) * 7.0f,
			FMath::Sin(LivingVoidTimeSeconds * 0.035f) * 16.0f,
			FMath::Cos(LivingVoidTimeSeconds * 0.017f) * 5.0f));
	}

	if (NearStarfieldInstances)
	{
		NearStarfieldInstances->SetRelativeLocation(FVector(
			FMath::Sin(LivingVoidTimeSeconds * 0.010f) * 14.0f,
			FMath::Cos(LivingVoidTimeSeconds * 0.007f) * 18.0f,
			0.0f));
	}

	if (StarfieldInstances)
	{
		StarfieldInstances->SetRelativeRotation(FRotator(0.0f, SlowDrift * 0.10f, SlowDrift * -0.06f));
	}

	if (WhiteStarfieldInstances)
	{
		WhiteStarfieldInstances->SetRelativeRotation(FRotator(SlowDrift * 0.04f, SlowDrift * -0.035f, 0.0f));
	}

	if (WarmStarfieldInstances)
	{
		WarmStarfieldInstances->SetRelativeRotation(FRotator(SlowDrift * -0.025f, SlowDrift * 0.03f, SlowDrift * 0.015f));
	}

	if (UltraFarStarfieldInstances)
	{
		UltraFarStarfieldInstances->SetRelativeRotation(FRotator(SlowDrift * 0.006f, SlowDrift * -0.004f, 0.0f));
	}
}

bool AJarvisUniverseFoundationActor::ShouldTickIfViewportsOnly() const
{
	return true;
}

void AJarvisUniverseFoundationActor::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);

	ConfigureGalaxyAnchors();
	ConfigureLabels();
	ConfigureGalaxyGlowLights();
	ConfigureMaterials();
	BuildStarfield();
	BuildNearDust();
	BuildGalaxyAnchors();
	BuildNebulaWisps();
	BuildCommandGrid();
	BuildCoreBeam();
}

void AJarvisUniverseFoundationActor::ConfigureGalaxyAnchors()
{
	const TArray<FName> DomainNames = {
		TEXT("VioletPerimeter"),
		TEXT("CyanPerimeter"),
		TEXT("AmberPerimeter"),
	};

	const TArray<FLinearColor> DomainColors = {
		FLinearColor(0.72f, 0.18f, 1.00f),
		FLinearColor(0.12f, 0.78f, 1.00f),
		FLinearColor(1.00f, 0.47f, 0.17f),
	};

	const TArray<FVector> AnchorDirections = {
		FVector(-0.72f, 0.58f, -0.18f),
		FVector(0.80f, 0.48f, -0.08f),
		FVector(0.34f, 0.86f, 0.26f),
	};

	GalaxyAnchors.Reset();
	for (int32 Index = 0; Index < AnchorCount; ++Index)
	{
		FJarvisGalaxyAnchor Anchor;
		Anchor.DomainName = DomainNames[Index];
		Anchor.Location = AnchorDirections[Index].GetSafeNormal() * GalaxyAnchorDistance;
		Anchor.DomainColor = DomainColors[Index];
		GalaxyAnchors.Add(Anchor);
	}
}

void AJarvisUniverseFoundationActor::ConfigureLabels()
{
	for (int32 Index = 0; Index < GalaxyLabels.Num() && Index < GalaxyAnchors.Num(); ++Index)
	{
		UTextRenderComponent* Label = GalaxyLabels[Index];
		if (!Label)
		{
			continue;
		}

		const FJarvisGalaxyAnchor& Anchor = GalaxyAnchors[Index];
		Label->SetText(FText::FromName(Anchor.DomainName));
		Label->SetRelativeLocation(Anchor.Location + FVector(0.0f, 0.0f, 5200.0f));
		Label->SetRelativeRotation(FRotator(60.0f, 0.0f, 0.0f));
		Label->SetVisibility(bShowDomainLabels);
		Label->SetHiddenInGame(!bShowDomainLabels);
	}
}

void AJarvisUniverseFoundationActor::ConfigureGalaxyGlowLights()
{
	for (int32 Index = 0; Index < GalaxyGlowLights.Num() && Index < GalaxyAnchors.Num(); ++Index)
	{
		UPointLightComponent* GalaxyLight = GalaxyGlowLights[Index];
		if (!GalaxyLight)
		{
			continue;
		}

		const FJarvisGalaxyAnchor& Anchor = GalaxyAnchors[Index];
		GalaxyLight->SetRelativeLocation(Anchor.Location);
		GalaxyLight->SetLightColor(Anchor.DomainColor);
	}
}

void AJarvisUniverseFoundationActor::ConfigureMaterials()
{
	if (!EmissiveMaterial)
	{
		return;
	}

	if (StarfieldInstances)
	{
		UMaterialInstanceDynamic* ColdStarMaterial = StarfieldInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (ColdStarMaterial)
		{
			ColdStarMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.42f, 1.15f, 3.0f, 1.0f));
			ColdStarMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.42f, 1.15f, 3.0f, 1.0f));
		}
	}

	if (NearStarfieldInstances)
	{
		UMaterialInstanceDynamic* NearStarMaterial = NearStarfieldInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (NearStarMaterial)
		{
			NearStarMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.65f, 0.95f, 1.65f, 1.0f));
			NearStarMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.65f, 0.95f, 1.65f, 1.0f));
		}
	}

	if (WarmStarfieldInstances)
	{
		UMaterialInstanceDynamic* WarmStarMaterial = WarmStarfieldInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (WarmStarMaterial)
		{
			WarmStarMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(4.2f, 1.45f, 0.35f, 1.0f));
			WarmStarMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(4.2f, 1.45f, 0.35f, 1.0f));
		}
	}

	if (WhiteStarfieldInstances)
	{
		UMaterialInstanceDynamic* WhiteStarMaterial = WhiteStarfieldInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (WhiteStarMaterial)
		{
			WhiteStarMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(3.2f, 3.8f, 5.8f, 1.0f));
			WhiteStarMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(3.2f, 3.8f, 5.8f, 1.0f));
		}
	}

	if (UltraFarStarfieldInstances)
	{
		UMaterialInstanceDynamic* UltraFarStarMaterial = UltraFarStarfieldInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (UltraFarStarMaterial)
		{
			UltraFarStarMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(1.10f, 0.80f, 0.48f, 1.0f));
			UltraFarStarMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.10f, 0.80f, 0.48f, 1.0f));
		}
	}

	if (NearDustInstances)
	{
		UMaterialInstanceDynamic* NearDustMaterial = NearDustInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (NearDustMaterial)
		{
			NearDustMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.035f, 0.070f, 0.16f, 1.0f));
			NearDustMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.035f, 0.070f, 0.16f, 1.0f));
		}
	}

	if (BrightStarFlareInstances)
	{
		UMaterialInstanceDynamic* FlareMaterial = BrightStarFlareInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (FlareMaterial)
		{
			FlareMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(4.2f, 5.2f, 7.8f, 1.0f));
			FlareMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(4.2f, 5.2f, 7.8f, 1.0f));
		}
	}

	if (GalaxyAnchorInstances)
	{
		UMaterialInstanceDynamic* GalaxyMaterial = GalaxyAnchorInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (GalaxyMaterial)
		{
			GalaxyMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(1.5f, 6.0f, 12.0f, 1.0f));
			GalaxyMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.5f, 6.0f, 12.0f, 1.0f));
		}
	}

	if (NebulaWispInstances)
	{
		UMaterialInstanceDynamic* NebulaMaterial = NebulaWispInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (NebulaMaterial)
		{
			NebulaMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.18f, 0.75f, 2.0f, 1.0f));
			NebulaMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.18f, 0.75f, 2.0f, 1.0f));
		}
	}

	for (int32 Index = 0; Index < DomainNebulaInstances.Num() && Index < GalaxyAnchors.Num(); ++Index)
	{
		UInstancedStaticMeshComponent* DomainNebula = DomainNebulaInstances[Index];
		if (!DomainNebula)
		{
			continue;
		}

		UMaterialInstanceDynamic* DomainMaterial = DomainNebula->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (DomainMaterial)
		{
			const FLinearColor Color = GalaxyAnchors[Index].DomainColor * 2.2f;
			DomainMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(Color.R, Color.G, Color.B, 1.0f));
			DomainMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(Color.R, Color.G, Color.B, 1.0f));
		}
	}

	for (int32 Index = 0; Index < DomainFogSheetInstances.Num() && Index < GalaxyAnchors.Num(); ++Index)
	{
		UInstancedStaticMeshComponent* FogSheet = DomainFogSheetInstances[Index];
		if (!FogSheet || !FogSheetMaterial)
		{
			continue;
		}

		UMaterialInstanceDynamic* FogMaterial = FogSheet->CreateDynamicMaterialInstance(0, FogSheetMaterial);
		if (FogMaterial)
		{
			const FLinearColor Color = GalaxyAnchors[Index].DomainColor * 3.5f;
			FogMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(Color.R, Color.G, Color.B, 0.42f));
			FogMaterial->SetVectorParameterValue(TEXT("Tint"), FLinearColor(Color.R, Color.G, Color.B, 0.42f));
			FogMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(Color.R, Color.G, Color.B, 1.0f));
			FogMaterial->SetScalarParameterValue(TEXT("Opacity"), 0.38f);
		}
	}

	if (CommandGridInstances)
	{
		UMaterialInstanceDynamic* GridMaterial = CommandGridInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (GridMaterial)
		{
			GridMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.22f, 1.2f, 4.8f, 1.0f));
			GridMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.22f, 1.2f, 4.8f, 1.0f));
		}
	}

	if (CoreBeamInstances)
	{
		UMaterialInstanceDynamic* CoreMaterial = CoreBeamInstances->CreateDynamicMaterialInstance(0, EmissiveMaterial);
		if (CoreMaterial)
		{
			CoreMaterial->SetVectorParameterValue(TEXT("EmissiveColor"), FLinearColor(0.8f, 3.2f, 12.0f, 1.0f));
			CoreMaterial->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.8f, 3.2f, 12.0f, 1.0f));
		}
	}
}

void AJarvisUniverseFoundationActor::BuildStarfield()
{
	if (!StarfieldInstances || !SphereMesh)
	{
		return;
	}

	StarfieldInstances->ClearInstances();
	if (NearStarfieldInstances)
	{
		NearStarfieldInstances->ClearInstances();
	}
	if (WarmStarfieldInstances)
	{
		WarmStarfieldInstances->ClearInstances();
	}
	if (WhiteStarfieldInstances)
	{
		WhiteStarfieldInstances->ClearInstances();
	}
	if (UltraFarStarfieldInstances)
	{
		UltraFarStarfieldInstances->ClearInstances();
	}
	if (BrightStarFlareInstances)
	{
		BrightStarFlareInstances->ClearInstances();
	}

	FRandomStream RandomStream(210501);
	const FVector CameraLocation = VoidCameraLocation;
	const FVector CameraTarget = VoidCameraTarget;
	const FVector CameraForward = (CameraTarget - CameraLocation).GetSafeNormal();
	const FVector CameraRight = FVector::CrossProduct(FVector::UpVector, CameraForward).GetSafeNormal();
	const FVector CameraUp = FVector::CrossProduct(CameraForward, CameraRight).GetSafeNormal();

	auto ViewSpaceLocation = [&CameraLocation, &CameraForward, &CameraRight, &CameraUp](float X, float Y, float Depth)
	{
		return CameraLocation + (CameraForward * Depth) + (CameraRight * X * Depth * 0.82f) + (CameraUp * Y * Depth * 0.68f);
	};
	const FVector VanishingPoint = ViewSpaceLocation(0.0f, 0.0f, 500000.0f);

	const int32 NearStarCount = FMath::Max(1, StarCount / 7);
	const int32 MidStarCount = FMath::Max(1, StarCount / 4);
	const int32 DeepStarCount = FMath::Max(1, StarCount - MidStarCount);
	const int32 UltraFarStarCount = FMath::Max(1, StarCount);

	for (int32 Index = 0; Index < NearStarCount; ++Index)
	{
		if (!NearStarfieldInstances)
		{
			break;
		}

		const float X = RandomStream.FRandRange(-1.26f, 1.26f);
		const float Y = RandomStream.FRandRange(-0.92f, 0.92f);
		const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.44f) + FMath::Square(Y / 0.34f));
		if (CenterMask < 1.0f)
		{
			continue;
		}

		const float Depth = RandomStream.FRandRange(500.0f, 5000.0f);
		const FVector Location = ViewSpaceLocation(X, Y, Depth);
		if (Location.Size() < 5000.0f)
		{
			continue;
		}

		FTransform InstanceTransform;
		InstanceTransform.SetLocation(Location);
		InstanceTransform.SetScale3D(FVector(RandomStream.FRandRange(0.0015f, 0.010f)));
		NearStarfieldInstances->AddInstance(InstanceTransform);
	}

	for (int32 Index = 0; Index < MidStarCount; ++Index)
	{
		const float X = RandomStream.FRandRange(-1.34f, 1.34f);
		const float Y = RandomStream.FRandRange(-0.96f, 0.96f);
		const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.50f) + FMath::Square(Y / 0.38f));
		if (CenterMask < 1.0f)
		{
			continue;
		}

		const float EdgeBoost = FMath::Clamp(CenterMask - 0.72f, 0.0f, 1.0f);
		const float Depth = RandomStream.FRandRange(5000.0f, 50000.0f);
		const FVector Location = ViewSpaceLocation(X, Y, Depth);
		if (Location.Size() < 5000.0f)
		{
			continue;
		}
		const float Scale = RandomStream.FRandRange(0.004f, 0.026f) * (1.0f + EdgeBoost * 0.35f);

		FTransform InstanceTransform;
		InstanceTransform.SetLocation(Location);
		InstanceTransform.SetScale3D(FVector(Scale));
		StarfieldInstances->AddInstance(InstanceTransform);
	}

	for (int32 Index = 0; Index < DeepStarCount; ++Index)
	{
		const float X = RandomStream.FRandRange(-1.55f, 1.55f);
		const float Y = RandomStream.FRandRange(-1.08f, 1.08f);
		const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.58f) + FMath::Square(Y / 0.43f));
		if (CenterMask < 1.0f && RandomStream.RandRange(0, 8) != 0)
		{
			continue;
		}

		const float EdgeBoost = FMath::Clamp(CenterMask - 0.76f, 0.0f, 1.0f);
		const float Depth = RandomStream.FRandRange(50000.0f, StarfieldRadius);
		const FVector Location = ViewSpaceLocation(X, Y, Depth);
		if (Location.Size() < 5000.0f)
		{
			continue;
		}
		const float Scale = RandomStream.FRandRange(0.075f, 0.72f) * (1.0f + EdgeBoost * 0.60f);

		FTransform InstanceTransform;
		InstanceTransform.SetLocation(Location);
		InstanceTransform.SetScale3D(FVector(Scale));

		const int32 TemperatureBucket = RandomStream.RandRange(0, 99);
		if (TemperatureBucket > 82 && WarmStarfieldInstances)
		{
			WarmStarfieldInstances->AddInstance(InstanceTransform);
		}
		else if (TemperatureBucket > 54 && WhiteStarfieldInstances)
		{
			WhiteStarfieldInstances->AddInstance(InstanceTransform);
		}
		else
		{
			WhiteStarfieldInstances->AddInstance(InstanceTransform);
		}
	}

	for (int32 Index = 0; Index < UltraFarStarCount; ++Index)
	{
		if (!UltraFarStarfieldInstances)
		{
			break;
		}

		const float X = RandomStream.FRandRange(-1.82f, 1.82f);
		const float Y = RandomStream.FRandRange(-1.22f, 1.22f);
		const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.72f) + FMath::Square(Y / 0.52f));
		if (CenterMask < 1.0f && RandomStream.RandRange(0, 18) != 0)
		{
			continue;
		}

		const float Depth = RandomStream.FRandRange(500000.0f, 2000000.0f);
		const FVector Location = ViewSpaceLocation(X, Y, Depth);
		if (Location.Size() < 5000.0f)
		{
			continue;
		}

		const float EdgeBoost = FMath::Clamp(CenterMask - 0.90f, 0.0f, 1.0f);
		FTransform InstanceTransform;
		InstanceTransform.SetLocation(Location);
		InstanceTransform.SetScale3D(FVector(RandomStream.FRandRange(0.90f, 5.80f) * (1.0f + EdgeBoost * 0.55f)));
		UltraFarStarfieldInstances->AddInstance(InstanceTransform);
	}

	const TArray<FVector2D> BrightStarPositions = {
		FVector2D(-0.72f, 0.48f),
		FVector2D(0.08f, 0.54f),
		FVector2D(0.68f, 0.28f),
		FVector2D(-0.86f, -0.30f),
		FVector2D(0.82f, -0.42f),
		FVector2D(-0.18f, -0.56f),
	};

	for (int32 Index = 0; Index < BrightStarPositions.Num(); ++Index)
	{
		const FVector2D Position = BrightStarPositions[Index];
		const FVector Location = ViewSpaceLocation(Position.X, Position.Y, RandomStream.FRandRange(220000.0f, 480000.0f));

		FTransform CoreTransform;
		CoreTransform.SetLocation(Location);
		CoreTransform.SetScale3D(FVector(RandomStream.FRandRange(4.5f, 9.5f)));
		WhiteStarfieldInstances->AddInstance(CoreTransform);

		if (BrightStarFlareInstances && CubeMesh)
		{
			FTransform HorizontalFlare;
			HorizontalFlare.SetLocation(Location);
			HorizontalFlare.SetRotation(FRotator(0.0f, 0.0f, 0.0f).Quaternion());
			HorizontalFlare.SetScale3D(FVector(RandomStream.FRandRange(76.0f, 170.0f), 0.10f, 0.10f));
			BrightStarFlareInstances->AddInstance(HorizontalFlare);

			FTransform VerticalFlare;
			VerticalFlare.SetLocation(Location);
			VerticalFlare.SetRotation(FRotator(0.0f, 0.0f, 90.0f).Quaternion());
			VerticalFlare.SetScale3D(FVector(RandomStream.FRandRange(32.0f, 88.0f), 0.08f, 0.08f));
			BrightStarFlareInstances->AddInstance(VerticalFlare);
		}
	}

	if (BrightStarFlareInstances && CubeMesh)
	{
		constexpr int32 RadialStreakCount = 84;
		for (int32 Index = 0; Index < RadialStreakCount; ++Index)
		{
			const float Angle = RandomStream.FRandRange(0.0f, UE_TWO_PI);
			const float Radius = RandomStream.FRandRange(0.78f, 1.38f);
			const float X = FMath::Cos(Angle) * Radius;
			const float Y = FMath::Sin(Angle) * Radius * 0.72f;
			const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.54f) + FMath::Square(Y / 0.39f));
			if (CenterMask < 1.0f)
			{
				continue;
			}

			const float Depth = RandomStream.FRandRange(12000.0f, 52000.0f);
			const FVector Location = ViewSpaceLocation(X, Y, Depth);
			const FVector ToCenter = (VanishingPoint - Location).GetSafeNormal();
			const FQuat Rotation = FRotationMatrix::MakeFromX(ToCenter).ToQuat();
			const float EdgeBoost = FMath::Clamp(CenterMask - 0.7f, 0.0f, 1.0f);

			FTransform StreakTransform;
			StreakTransform.SetLocation(Location);
			StreakTransform.SetRotation(Rotation);
			StreakTransform.SetScale3D(FVector(
				RandomStream.FRandRange(2.8f, 12.0f) * (1.0f + EdgeBoost),
				RandomStream.FRandRange(0.006f, 0.018f),
				RandomStream.FRandRange(0.006f, 0.018f)));
			BrightStarFlareInstances->AddInstance(StreakTransform);
		}
	}
}

void AJarvisUniverseFoundationActor::BuildNearDust()
{
	if (!NearDustInstances || !SphereMesh)
	{
		return;
	}

	NearDustInstances->ClearInstances();

	FRandomStream RandomStream(210609);
	const FVector CameraLocation = VoidCameraLocation;
	const FVector CameraTarget = VoidCameraTarget;
	const FVector CameraForward = (CameraTarget - CameraLocation).GetSafeNormal();
	const FVector CameraRight = FVector::CrossProduct(FVector::UpVector, CameraForward).GetSafeNormal();
	const FVector CameraUp = FVector::CrossProduct(CameraForward, CameraRight).GetSafeNormal();

	auto ViewSpaceLocation = [&CameraLocation, &CameraForward, &CameraRight, &CameraUp](float X, float Y, float Depth)
	{
		return CameraLocation + (CameraForward * Depth) + (CameraRight * X * Depth * 1.12f) + (CameraUp * Y * Depth * 0.88f);
	};

	constexpr int32 DustCount = 1800;
	for (int32 Index = 0; Index < DustCount; ++Index)
	{
		const float X = RandomStream.FRandRange(-1.45f, 1.45f);
		const float Y = RandomStream.FRandRange(-0.95f, 0.95f);
		const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.58f) + FMath::Square(Y / 0.42f));
		if (CenterMask < 1.0f)
		{
			continue;
		}

		const float Depth = RandomStream.FRandRange(25.0f, 500.0f);
		const float Scale = RandomStream.FRandRange(0.00018f, 0.00115f);

		FTransform DustTransform;
		DustTransform.SetLocation(ViewSpaceLocation(X, Y, Depth));
		DustTransform.SetScale3D(FVector(Scale));
		NearDustInstances->AddInstance(DustTransform);
	}
}

void AJarvisUniverseFoundationActor::BuildGalaxyAnchors()
{
	if (!GalaxyAnchorInstances || !SphereMesh)
	{
		return;
	}

	GalaxyAnchorInstances->ClearInstances();

	for (const FJarvisGalaxyAnchor& Anchor : GalaxyAnchors)
	{
		FTransform AnchorTransform;
		AnchorTransform.SetLocation(Anchor.Location);
		AnchorTransform.SetScale3D(FVector(3.0f, 3.0f, 3.0f));
		GalaxyAnchorInstances->AddInstance(AnchorTransform);
	}
}

void AJarvisUniverseFoundationActor::BuildNebulaWisps()
{
	if (GalaxyAnchors.Num() == 0)
	{
		return;
	}

	if (NebulaWispInstances)
	{
		NebulaWispInstances->ClearInstances();
	}

	for (UInstancedStaticMeshComponent* DomainNebula : DomainNebulaInstances)
	{
		if (DomainNebula)
		{
			DomainNebula->ClearInstances();
		}
	}

	for (UInstancedStaticMeshComponent* FogSheet : DomainFogSheetInstances)
	{
		if (FogSheet)
		{
			FogSheet->ClearInstances();
		}
	}

	FRandomStream RandomStream(210507);
	const FVector CameraLocation = VoidCameraLocation;
	const FVector CameraTarget = VoidCameraTarget;
	const FVector CameraForward = (CameraTarget - CameraLocation).GetSafeNormal();
	const FVector CameraRight = FVector::CrossProduct(FVector::UpVector, CameraForward).GetSafeNormal();
	const FVector CameraUp = FVector::CrossProduct(CameraForward, CameraRight).GetSafeNormal();

	auto ViewSpaceLocation = [&CameraLocation, &CameraForward, &CameraRight, &CameraUp](float X, float Y, float Depth)
	{
		return CameraLocation + (CameraForward * Depth) + (CameraRight * X * Depth * 0.86f) + (CameraUp * Y * Depth * 0.72f);
	};

	const TArray<FVector2D> ArcCenters = {
		FVector2D(-0.92f, -0.58f),
		FVector2D(0.96f, -0.35f),
		FVector2D(0.56f, 0.78f),
	};

	const TArray<FVector2D> ArcTangents = {
		FVector2D(0.88f, 0.46f),
		FVector2D(0.74f, 0.67f),
		FVector2D(0.94f, -0.34f),
	};

	const TArray<float> ArcLengths = {
		1.32f,
		1.24f,
		1.08f,
	};

	const int32 WispsPerDomain = FMath::Max(1, NebulaWispCount / GalaxyAnchors.Num());
	for (int32 DomainIndex = 0; DomainIndex < GalaxyAnchors.Num(); ++DomainIndex)
	{
		UInstancedStaticMeshComponent* DomainNebula = DomainNebulaInstances.IsValidIndex(DomainIndex) ? DomainNebulaInstances[DomainIndex] : nullptr;
		UInstancedStaticMeshComponent* FogSheet = DomainFogSheetInstances.IsValidIndex(DomainIndex) ? DomainFogSheetInstances[DomainIndex] : nullptr;
		if (!DomainNebula)
		{
			continue;
		}

		const FJarvisGalaxyAnchor& Anchor = GalaxyAnchors[DomainIndex];
		const FVector2D ArcCenter = ArcCenters[DomainIndex];
		const FVector2D ArcTangent = ArcTangents[DomainIndex].GetSafeNormal();
		const FVector2D ArcNormal(-ArcTangent.Y, ArcTangent.X);
		const float ArcLength = ArcLengths[DomainIndex];
		const float ArcBias = (DomainIndex % 2 == 0) ? 1.0f : -1.0f;

		for (int32 Index = 0; Index < WispsPerDomain; ++Index)
		{
			const float Alpha = static_cast<float>(Index) / static_cast<float>(WispsPerDomain - 1);
			const float Curve = (Alpha - 0.5f) * 2.0f;
			const float Feather = FMath::Pow(FMath::Clamp(1.0f - FMath::Abs(Curve), 0.0f, 1.0f), 0.38f);
			const float LayerNoise = RandomStream.FRandRange(-1.0f, 1.0f);
			const float FilamentNoise = FMath::Sin((Alpha * UE_TWO_PI * 2.1f) + DomainIndex * 0.7f) * 0.11f * ArcBias;
			const float Width = RandomStream.FRandRange(-0.10f, 0.10f) + FilamentNoise;
			const float X = ArcCenter.X + (ArcTangent.X * Curve * ArcLength) + (ArcNormal.X * Width);
			const float Y = ArcCenter.Y + (ArcTangent.Y * Curve * ArcLength) + (ArcNormal.Y * Width);
			const float CenterMask = FMath::Sqrt(FMath::Square(X / 0.50f) + FMath::Square(Y / 0.33f));
			if (CenterMask < 1.0f)
			{
				continue;
			}

			const float Depth = RandomStream.FRandRange(300000.0f, 500000.0f) + (LayerNoise * 52000.0f);
			const FVector ArcLocation = ViewSpaceLocation(X, Y, Depth);

			FTransform WispTransform;
			WispTransform.SetLocation(ArcLocation);
			WispTransform.SetRotation(FRotator(
				RandomStream.FRandRange(-44.0f, 44.0f),
				FMath::RadiansToDegrees(FMath::Atan2(ArcTangent.Y, ArcTangent.X)) + RandomStream.FRandRange(-58.0f, 58.0f),
				RandomStream.FRandRange(-58.0f, 58.0f)).Quaternion());
			WispTransform.SetScale3D(FVector(
				RandomStream.FRandRange(2.2f, 9.0f) * Feather,
				RandomStream.FRandRange(0.12f, 0.62f),
				RandomStream.FRandRange(0.10f, 0.70f)));
			DomainNebula->AddInstance(WispTransform);

			if (Index % 17 == 0)
			{
				FTransform CloudBankTransform;
				CloudBankTransform.SetLocation(ArcLocation + (CameraForward * RandomStream.FRandRange(-36000.0f, 36000.0f)));
				CloudBankTransform.SetRotation(FRotator(
					RandomStream.FRandRange(-40.0f, 40.0f),
					FMath::RadiansToDegrees(FMath::Atan2(ArcTangent.Y, ArcTangent.X)) + RandomStream.FRandRange(-80.0f, 80.0f),
					RandomStream.FRandRange(-45.0f, 45.0f)).Quaternion());
				CloudBankTransform.SetScale3D(FVector(
					RandomStream.FRandRange(5.0f, 18.0f) * Feather,
					RandomStream.FRandRange(0.9f, 3.4f),
					RandomStream.FRandRange(0.7f, 2.8f)));
				DomainNebula->AddInstance(CloudBankTransform);
			}

			(void)FogSheet;
			(void)FogSheetMesh;

			if (Index % 13 == 0 && NebulaWispInstances)
			{
				FTransform SparkTransform;
				SparkTransform.SetLocation(ArcLocation + (Anchor.Location.GetSafeNormal() * RandomStream.FRandRange(-8500.0f, 8500.0f)));
				SparkTransform.SetScale3D(FVector(RandomStream.FRandRange(0.22f, 0.95f)));
				NebulaWispInstances->AddInstance(SparkTransform);
			}
		}
	}
}

void AJarvisUniverseFoundationActor::BuildCommandGrid()
{
	if (!CommandGridInstances || !CubeMesh)
	{
		return;
	}

	CommandGridInstances->ClearInstances();
}

void AJarvisUniverseFoundationActor::BuildCoreBeam()
{
	if (!CoreBeamInstances || !CubeMesh)
	{
		return;
	}

	CoreBeamInstances->ClearInstances();
}
